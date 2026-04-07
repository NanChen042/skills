import { ISkill } from '../../types';

export const TimeSkill: ISkill = {
    id: 'time-skill',
    name: '当前时间',
    description: '获取系统当前的完整日期和时间信息。',
    category: 'external',
    definition: {
        type: 'function',
        function: {
            name: 'get_current_time',
            description: 'Get the current system date and time.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    handler: async () => {
        const now = new Date();
        console.log(`⏰ [Skill: Time] Current time requested: ${now.toISOString()}`);
        return {
            timestamp: now.getTime(),
            formatted: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            iso: now.toISOString(),
            timezone: 'Asia/Shanghai'
        };
    }
};
