import OpenAI from 'openai';
import dotenv from 'dotenv';
import { ChatMessage, AIResponse, ToolCall } from '../types';
import { skillRegistry } from '../skills/registry';

dotenv.config();

export class AIService {
    private client: OpenAI;
    private model: string;

    constructor() {
        const apiKey = (process.env.SILICONFLOW_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: 'https://api.siliconflow.cn/v1'
        });
        this.model = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.5-4B';
    }

    /**
     * 构建包含技能描述的系统提示词
     */
    private getSystemPrompt(): ChatMessage {
        const skillDesc = skillRegistry.getSkillsDescription();
        return {
            role: 'system',
            content: `你是一个全能的 AI 助手。你可以通过调用工具来执行特定的 Skill。\n\n${skillDesc}\n\n如果用户询问你拥有哪些技能、能做什么，请详细介绍上述技能库，并区分“自研 Skill”和“第三方 Skill”。你可以直接调用它们来满足用户需求。`
        };
    }

    /**
     * 发送常规对话请求 (非流式)
     */
    public async chat(messages: ChatMessage[]): Promise<AIResponse> {
        console.log(`🤖 Sending chat request to model: ${this.model}`);
        
        // 插入系统提示词
        const fullMessages = [this.getSystemPrompt(), ...messages];

        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: fullMessages as any,
                tools: skillRegistry.getToolDefinitions() as any,
                tool_choice: 'auto'
            });

            console.log(`✅ AI Response Received (Usage: ${JSON.stringify(response.usage || {})})`);
            
            return {
                choices: response.choices.map(c => ({
                    message: {
                        role: c.message.role as any,
                        content: c.message.content,
                        tool_calls: c.message.tool_calls as any
                    },
                    finish_reason: c.finish_reason
                })),
                usage: response.usage ? { total_tokens: response.usage.total_tokens } : undefined
            };
        } catch (error: any) {
            console.error('AI Request Error:', error.message);
            throw new Error(`Failed to call AI: ${error.message}`);
        }
    }

    /**
     * 发送流式对话请求
     */
    public async chatStream(messages: ChatMessage[]) {
        console.log(`📡 Opening AI Stream with model: ${this.model}`);
        
        const fullMessages = [this.getSystemPrompt(), ...messages];

        return await this.client.chat.completions.create({
            model: this.model,
            messages: fullMessages as any,
            stream: true
        });
    }

    /**
     * 处理工具调用 (分发到 Registry)
     */
    public async handleToolCall(toolCall: ToolCall): Promise<any> {
        const { name, arguments: argsString } = toolCall.function;
        console.log(`🚀 Dispatching tool call: ${name}`);
        const args = JSON.parse(argsString);
        return await skillRegistry.executeSkill(name, args);
    }
}
