import { ISkill } from '../types';
import { WeatherSkill } from './internal/weather';
import { TimeSkill } from './external/time';
import { DesignSkill } from './internal/design';

export class SkillRegistry {
    private skills: Map<string, ISkill> = new Map();

    constructor() {
        this.register(WeatherSkill);
        this.register(TimeSkill);
        this.register(DesignSkill);
    }

    private register(skill: ISkill) {
        this.skills.set(skill.definition.function.name, skill);
    }

    /**
     * 获取所有用于 OpenAI 的工具定义
     */
    public getToolDefinitions() {
        return Array.from(this.skills.values()).map(skill => skill.definition);
    }

    /**
     * 获取所有技能的完整详细描述和指令 (Markdown 格式)
     * 用于注入系统提示词
     */
    public getSkillsDescription(): string {
        const skillsArray = Array.from(this.skills.values());
        
        let desc = '## 当前可用技能库及指令手册\n';
        
        // 分类列出简要列表
        desc += '\n### 1. 技能概览\n';
        const internal = skillsArray.filter(s => s.category === 'internal');
        const external = skillsArray.filter(s => s.category === 'external');

        desc += '#### [内部 Skill (核心业务)]:\n';
        internal.forEach(s => desc += `- ${s.name}: ${s.description}\n`);

        desc += '\n#### [第三方 Skill (通用能力)]:\n';
        external.forEach(s => desc += `- ${s.name}: ${s.description}\n`);

        // 注入详细的 Markdown Prompt 指令
        desc += '\n### 2. 技能详细执行指令 (AI 必读)\n';
        desc += '当你决定调用某个工具后，回复用户时必须严格遵守该技能对应的“技能指令”：\n\n';
        
        skillsArray.forEach(s => {
            if (s.prompt) {
                desc += `--- \n${s.prompt}\n\n`;
            } else {
                desc += `--- \n#### 技能：${s.name}\n直接根据工具返回结果回答即可。\n\n`;
            }
        });

        return desc;
    }

    /**
     * 根据名称查找并执行技能
     */
    public async executeSkill(name: string, args: any): Promise<any> {
        const skill = this.skills.get(name);
        if (!skill) {
            throw new Error(`Skill not found: ${name}`);
        }
        return await skill.handler(args);
    }
}

// 导出单例
export const skillRegistry = new SkillRegistry();
