export interface WeatherData {
    city: string;
    temperature: string;
    condition: string;
    humidity: string;
    wind: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface AIResponse {
    choices: {
        message: ChatMessage;
        finish_reason: string;
    }[];
    usage?: {
        total_tokens: number;
    };
}

export interface ISkill {
    id: string;
    name: string;
    description: string;
    category: 'internal' | 'external';
    definition: {
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    };
    handler: (args: any) => Promise<any>;
}
