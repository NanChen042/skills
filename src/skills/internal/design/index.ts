import fs from 'fs';
import path from 'path';
import { ISkill } from '../../../types';

// 动态读取同目录下的 skill.md 作为 prompt
const promptPath = path.join(__dirname, 'skill.md');
const promptContent = fs.existsSync(promptPath) 
    ? fs.readFileSync(promptPath, 'utf8') 
    : undefined;

export const DesignSkill: ISkill = {
    id: 'design-skill',
    name: '前端设计专家',
    description: '提供高级 UI/UX 设计方案、配色建议、网页排版以及现代前端组件（React/Vue/HTML）的代码实现。',
    category: 'internal',
    prompt: promptContent,
    definition: {
        type: 'function',
        function: {
            name: 'ui_design_consultant',
            description: 'Get expert UI/UX design advice, professional color palettes, and modern component code. Use this for ANY design-related requests.',
            parameters: {
                type: 'object',
                properties: {
                    componentName: {
                        type: 'string',
                        description: 'The name of the UI component or page to design, e.g. "Landing Page", "User Dashboard". If not specified, use "General Theme".'
                    },
                    description: {
                        type: 'string',
                        description: 'Detailed requirements, goals, or the core problem to solve. If not specified, use "Overall Design Consultation".'
                    },
                    style: {
                        type: 'string',
                        enum: ['minimalist', 'glassmorphism', 'neumorphism', 'corporate-pro', 'vibrant-modern'],
                        description: 'Preferred visual style'
                    }
                },
                required: [] // 🟢 改为非必填，让模型在模糊提问时也能直接调用
            }
        }
    },
    handler: async (args: { componentName?: string; description?: string; style?: string }) => {
        const comp = args.componentName || '全局设计方案';
        const desc = args.description || '全方位 UI/UX 咨询';
        console.log(`🎨 [Skill: Design] Consulting for: ${comp}`);
        
        return {
            status: 'success',
            component: comp,
            consultation: {
                focus: `为“${comp}”提供 ${args.style || '现代主流'} 风格的设计方案。`,
                strategy: `针对：${desc}`,
                design_tokens: {
                    primary: '#6366f1',
                    secondary: '#a855f7',
                    background: '#f8fafc',
                    accent: '#10b981',
                    typography: 'Inter, system-ui, sans-serif'
                },
                ux_advice: [
                    '增强层次感：通过阴影 (Box Shadows) 和层级排列 (Z-index) 区分信息。',
                    '留白艺术：增加外边距和内边距，提升视觉呼吸感。',
                    '响应式优先：确保在移动端和桌面端都有极佳的交互体验。'
                ]
            }
        };
    }
};
