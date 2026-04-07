import { ISkill } from '../types';
import { WeatherSkill } from './internal/weatherSkill';
import { TimeSkill } from './external/timeSkill';

export class SkillRegistry {
    private skills: Map<string, ISkill> = new Map();

    constructor() {
        this.register(WeatherSkill);
        this.register(TimeSkill);
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
     * 获取所有技能的简要描述（用于系统提示词）
     */
    public getSkillsDescription(): string {
        const internal = Array.from(this.skills.values()).filter(s => s.category === 'internal');
        const external = Array.from(this.skills.values()).filter(s => s.category === 'external');

        let desc = '当前可用技能库：\n';
        
        desc += '\n[自研 Skill (核心业务)]:\n';
        internal.forEach(s => desc += `- ${s.name}: ${s.description}\n`);

        desc += '\n[第三方 Skill (通用能力)]:\n';
        external.forEach(s => desc += `- ${s.name}: ${s.description}\n`);

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
