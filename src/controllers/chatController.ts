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

        try {
            console.log(`💬 User Input: ${prompt} (Session: ${sessionId || 'None'})`);
            
            const messages: ChatMessage[] = [];

            // 1. 加载历史上下文 (针对同一个 sessionId)
            if (sessionId) {
                try {
                    const [rows]: [any[], any] = await pool.query(
                        'SELECT user_prompt, ai_response, tool_calls, tool_results FROM skills_log WHERE session_id = ? ORDER BY id ASC LIMIT 10',
                        [sessionId]
                    );

                    for (const row of rows) {
                        // 添加用户提问
                        messages.push({ role: 'user', content: row.user_prompt });

                        // 添加 AI 回复及工具调用
                        const toolCalls = row.tool_calls;
                        messages.push({
                            role: 'assistant',
                            content: row.ai_response,
                            tool_calls: (toolCalls && toolCalls.length > 0) ? toolCalls : undefined
                        });

                        // 添加工具执行结果 (如果存在)
                        const toolResults = row.tool_results;
                        if (toolResults && toolResults.length > 0) {
                            for (const tr of toolResults) {
                                // 查找对应的工具名称 (由 tool_id 匹配，但日志中没存 name，只能尝试从 tool_calls 还原)
                                const originalCall = toolCalls?.find((tc: any) => tc.id === tr.tool_id);
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
                        console.log(`📜 Loaded ${rows.length} turns of history for session: ${sessionId}`);
                    }
                } catch (historyErr) {
                    console.error('⚠️ Failed to load history:', historyErr);
                }
            }

            // 添加当前消息
            messages.push({ role: 'user', content: prompt });

            // 2. 第一次调用 AI: 探测意图
            let aiResponse: AIResponse = await aiService.chat(messages);
            let firstChoice = aiResponse.choices[0];
            let assistantMessage = firstChoice.message;

            let toolCallsData: ToolCall[] = assistantMessage.tool_calls || [];
            let toolResults: any[] = [];

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

            // 4. 设置 SSE 响应头并流式输出最终回答
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            if (toolCallsData.length > 0) {
                res.write(`data: ${JSON.stringify({ type: 'tool_calls', data: toolCallsData })}\n\n`);
            }

            const stream = await aiService.chatStream(messages);
            let fullContent = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`);
                }
            }

            // 5. 持久化交互记录 (包含 session_id)
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
            if (!res.headersSent) {
                res.status(500).json({ error: error.message });
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
                res.end();
            }
        }
    }
};
