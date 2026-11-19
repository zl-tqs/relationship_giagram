import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadRelationshipPrompt, renderRelationshipPrompt,
} from './prompt.js';

const input = {
  characters: ['张三', '李四'],
  cooccurrences: [{ a: '张三', b: '李四', count: 2 }],
  excerpt: '张三与李四同行。',
  hints: ['朋友', '敌人'],
};

describe('relationship prompt', () => {
  it('默认模板可加载并渲染所有占位符', () => {
    const template = loadRelationshipPrompt({ allowLocalOverride: false });
    const prompt = renderRelationshipPrompt(template, input);

    expect(prompt).toContain('张三、李四');
    expect(prompt).toContain('张三—李四（同段出现 2 次）');
    expect(prompt).toContain('朋友、敌人');
    expect(prompt).toContain('张三与李四同行');
    expect(prompt).not.toContain('{{characters}}');
  });

  it('兼容 resources 旧提示词中的模板表达式', () => {
    const template = [
      '已知人物：${characters.join(\'、\')}',
      '片段：${text}',
    ].join('\n');
    const prompt = renderRelationshipPrompt(template, input);

    expect(prompt).toContain('已知人物：张三、李四');
    expect(prompt).toContain('片段：张三与李四同行。');
  });

  it('没有占位符时追加结构化上下文', () => {
    const prompt = renderRelationshipPrompt('只输出 JSON。', input);

    expect(prompt).toContain('只输出 JSON。');
    expect(prompt).toContain('【已知人物列表】');
    expect(prompt).toContain('张三、李四');
    expect(prompt).toContain('【小说片段】');
    expect(prompt).toContain('张三与李四同行。');
  });

  it('可读取本地覆盖文件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'relationship-prompt-'));
    const file = join(dir, 'prompt.txt');
    writeFileSync(file, '自定义提示词\n人物：{{characters}}\n片段：{{text}}', 'utf8');
    try {
      const prompt = renderRelationshipPrompt(
        loadRelationshipPrompt({ overridePath: file, allowLocalOverride: false }),
        input,
      );
      expect(prompt).toContain('自定义提示词');
      expect(prompt).toContain('人物：张三、李四');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
