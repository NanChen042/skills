import { Request, Response } from 'express';
import { AIService } from '../services/aiService';
import { pool } from '../config/db';
import { ChatMessage, AIResponse, ToolCall, ChatRequest } from '../types';

const aiService = new AIService();

export const ChatController = {
    async handleChat(req: Request, res: Response) {
        const { prompt, sessionId } = req.body as ChatRequest;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // 🟢 [优化] 立即建立 SSE 连接并刷新 Header
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        try {
            console.log(`💬 User Input: ${prompt} (Session: ${sessionId || 'None'})`);
            
            const messages: ChatMessage[] = [];

            // 1. 加载历史上下文 (针对同一个 sessionId)
            if (sessionId) {
                try {
                    // 🔴 [修正 SQL] 获取最新的 10 条，并按时间正序排列
                    // 原先的写法拿到了最开始的 10 条记录，导致 AI 记不住“上一轮”说了什么
                    const query = `
                        SELECT * FROM (
                            SELECT user_prompt, ai_response, tool_calls, tool_results, id 
                            FROM skills_log 
                            WHERE session_id = ? 
                            ORDER BY id DESC 
                            LIMIT 10
                        ) AS sub 
                        ORDER BY id ASC
                    `;
                    const [rows]: [any[], any] = await pool.query(query, [sessionId]);

                    for (const row of rows) {
                        // 用户消息
                        messages.push({ role: 'user', content: row.user_prompt });

                        // AI 消息 (处理工具调用历史)
                        const toolCalls = row.tool_calls;
                        messages.push({
                            role: 'assistant',
                            content: row.ai_response || (toolCalls && toolCalls.length > 0 ? null : ''), 
                            tool_calls: (toolCalls && toolCalls.length > 0) ? toolCalls : undefined
                        });

                        // 工具执行结果
                        const toolResults = row.tool_results;
                        if (toolResults && toolResults.length > 0 && toolCalls) {
                            for (const tr of toolResults) {
                                const originalCall = toolCalls.find((tc: any) => tc.id === tr.tool_id);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: tr.tool_id,
                                    name: originalCall?.function?.name || 'unknown_tool',
                                    content: JSON.stringify(tr.result)
                                });
                            }
                        }
                    }
                    if (rows.length > 0) {
                        console.log(`📜 Loaded ${rows.length} turns of RECENT history for session: ${sessionId}`);
                    }
                } catch (historyErr) {
                    console.error('⚠️ Failed to load history:', historyErr);
                }
            }

            messages.push({ role: 'user', content: prompt });

            // 2. 探测意图: 调用 AI (Block)
            let aiResponse: AIResponse = await aiService.chat(messages);
            let firstChoice = aiResponse.choices[0];
            let assistantMessage = firstChoice.message;

            let toolCallsData: ToolCall[] = assistantMessage.tool_calls || [];
            let toolResults: any[] = [];

            // 🟢 一旦检测到工具调用意图，立即推送到前端
            if (toolCallsData.length > 0) {
                res.write(`data: ${JSON.stringify({ type: 'tool_calls', data: toolCallsData })}\n\n`);
            }

            // 3. 处理工具调用
            if (firstChoice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
                console.log('🛠️ Handling tool calls...');
                messages.push(assistantMessage as ChatMessage);
                
                for (const toolCall of assistantMessage.tool_calls) {
                    const result = await aiService.handleToolCall(toolCall);
                    toolResults.push({ tool_id: toolCall.id, result });

                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: JSON.stringify(result)
                    });
                }
            }

            // 4. 流式输出最终回答
            const stream = await aiService.chatStream(messages);
            let fullContent = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`);
                }
            }

            // 5. 持久化交互记录
            pool.query(
                'INSERT INTO skills_log (session_id, user_prompt, ai_response, tool_calls, tool_results, total_tokens) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    sessionId || null,
                    prompt, 
                    fullContent, 
                    JSON.stringify(toolCallsData), 
                    JSON.stringify(toolResults), 
                    0
                ]
            ).catch(err => console.error('❌ DB Log Error:', err));

            res.write('data: [DONE]\n\n');
            res.end();

        } catch (error: any) {
            console.error('❌ Chat Error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
            res.end();
        }
    }
};
