import { ISkill, WeatherData } from '../../types';

export const WeatherSkill: ISkill = {
    id: 'weather-skill',
    name: '天气查询',
    description: '查询指定城市的当前实时天气情况，包括温度、湿度和风速。',
    category: 'internal',
    definition: {
        type: 'function',
        function: {
            name: 'get_weather',
            description: 'Get the current weather for a specific city.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'The name of the city, e.g. Beijing, Shanghai'
                    }
                },
                required: ['city']
            }
        }
    },
    handler: async (args: { city: string }) => {
        console.log(`🌦️ [Skill: Weather] Fetching for: ${args.city}`);
        
        // 模拟外部 API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 500));

        const temperatures = ['18°C', '22°C', '25°C', '15°C', '30°C'];
        const conditions = ['晴朗', '多云', '小雨', '阴天', '阵雨'];
        const randomIdx = Math.floor(Math.random() * temperatures.length);

        return {
            city: args.city,
            temperature: temperatures[randomIdx],
            condition: conditions[randomIdx],
            humidity: `${Math.floor(Math.random() * 40) + 40}%`,
            wind: `${Math.floor(Math.random() * 10) + 2}m/s`
        };
    }
};
