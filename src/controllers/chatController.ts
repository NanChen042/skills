import { Request, Response } from 'express';
import { AIService } from '../services/aiService';
import { pool } from '../config/db';
import { ChatMessage, AIResponse, ToolCall } from '../types';

const aiService = new AIService();

export const ChatController = {
    /**
     * 处理 AI 对话请求 (支持流式 SSE)
     */
    async handleChat(req: Request, res: Response) {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        try {
            console.log(`💬 User Input: ${prompt}`);
            
            // 初始化对话列表
            const messages: ChatMessage[] = [
                { role: 'user', content: prompt }
            ];

            // 1. 调用 AI 发起请求 (第一次调用，用于检测是否需要工具调用)
            let aiResponse: AIResponse = await aiService.chat(messages);
            let firstChoice = aiResponse.choices[0];
            let assistantMessage = firstChoice.message;

            let toolCallsData: ToolCall[] = assistantMessage.tool_calls || [];
            let toolResults: any[] = [];

            // 2. 如果 AI 触发了工具调用 (Function Calling)
            if (firstChoice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
                console.log('🛠️ Handling tool calls...');
                messages.push(assistantMessage);
                
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
            } else {
                // 如果没有工具调用，我们将第一次的结果作为流式的前奏（可选），
                // 但为了统一体验，我们此处重新发起一个流式请求，或者直接发送回复。
                // 为了演示流式，我们统一重新发起流式请求获取内容。
            }

            // --- 开始 SSE 流式输出 ---
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            // 发送已触发的工具调用信息给前端（如果有）
            if (toolCallsData.length > 0) {
                res.write(`data: ${JSON.stringify({ type: 'tool_calls', data: toolCallsData })}\n\n`);
            }

            // 3. 发起流式请求 (获取最终回答)
            const stream = await aiService.chatStream(messages);
            let fullContent = '';
            let totalTokens = 0;

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    res.write(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`);
                }
            }

            // 4. 将结果持久化到 MySQL (异步执行，不阻塞响应)
            pool.query(
                'INSERT INTO skills_log (user_prompt, ai_response, tool_calls, tool_results, total_tokens) VALUES (?, ?, ?, ?, ?)',
                [
                    prompt, 
                    fullContent, 
                    JSON.stringify(toolCallsData), 
                    JSON.stringify(toolResults), 
                    0 // 流式暂不方便获取精准 token，可后续估算
                ]
            ).catch(err => console.error('❌ DB Log Error:', err));

            // 结束流
            res.write('data: [DONE]\n\n');
            res.end();

        } catch (error: any) {
            console.error('❌ Chat Handling Error:', error);
            // 如果已经发送了部分内容，则无法更改状态码，只能发送错误消息包
            if (!res.headersSent) {
                res.status(500).json({ error: error.message });
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
                res.end();
            }
        }
    }
};
