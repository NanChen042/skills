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
    name: '前端设计方案',
    description: '提供高级 UI/UX 设计方案、配色建议及现代前端组件代码实现。',
    category: 'internal',
    prompt: promptContent,
    definition: {
        type: 'function',
        function: {
            name: 'ui_design_consultant',
            description: 'Get professional UI design advice and component code.',
            parameters: {
                type: 'object',
                properties: {
                    componentName: {
                        type: 'string',
                        description: 'The name of the UI component to design, e.g. "Login Card", "Hero Section"'
                    },
                    description: {
                        type: 'string',
                        description: 'Detailed requirements for the component'
                    },
                    style: {
                        type: 'string',
                        enum: ['minimalist', 'glassmorphism', 'neumorphism', 'corporate'],
                        description: 'Preferred visual style'
                    }
                },
                required: ['componentName', 'description']
            }
        }
    },
    handler: async (args: { componentName: string; description: string; style?: string }) => {
        console.log(`🎨 [Skill: Design] Consulting for: ${args.componentName}`);
        
        // 模拟设计顾问的初步反馈
        return {
            status: 'success',
            consultation: {
                focus: `Expertly drafting ${args.componentName} with a ${args.style || 'modern'} aesthetic.`,
                strategy: `Applying professional layout principles for: ${args.description}`,
                tokens: {
                    primary: '#6366f1',
                    secondary: '#a855f7',
                    background: '#f8fafc',
                    accent: '#10b981'
                }
            }
        };
    }
};
