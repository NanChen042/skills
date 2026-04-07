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
            content: `你是一个集成了多种专业技能的 AI 助手。你可以通过调用工具来执行具体任务。

${skillDesc}

### 核心操作规范：
1. **上下文优先 (Context First)**：在提问前，务必检查对话历史。严禁询问用户已提供的信息（如城市名）。
2. **拒绝幻觉 (No Hallucination)**：
   - 查天气/预报必须调用 'get_weather'，严禁猜测。
   - 查当前时间必须调用 'get_current_time'，严禁使用内置时钟或随意编造。
3. **参数准确**：针对明天/周末等预报需求，必须使用 'get_weather' 的 'days' 参数。
4. **即刻调用**：如果信息足以调用工具，直接调用，不要废话确认。`
        };
    }

    /**
     * 发送常规对话请求 (非流式)
     */
    public async chat(messages: ChatMessage[]): Promise<AIResponse> {
        console.log(`🤖 Sending chat request to model: ${this.model}`);
        
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
                        content: c.message.content || null,
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
