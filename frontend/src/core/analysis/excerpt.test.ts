import { describe, expect, it } from 'vitest';
import { buildExcerpt } from './excerpt';

describe('buildExcerpt', () => {
  it('优先保留同时出现多个人物的段落', () => {
    const text = [
      '第一段只有风景。',
      '张三与李四在桥上相遇。',
      '第三段仍然只有风景。',
    ].join('\n\n');
    const excerpt = buildExcerpt(text, ['张三', '李四'], { maxChars: 200 });
    expect(excerpt).toContain('张三与李四在桥上相遇');
    expect(excerpt).not.toContain('第一段');
  });

  it('按映射替换为确认后的姓名', () => {
    const text = '张三与李四同行。';
    const excerpt = buildExcerpt(text, ['张三', '李四'], {
      maxChars: 100,
      replacements: { 张三: '张真人' },
    });
    expect(excerpt).toContain('张真人与李四同行');
    expect(excerpt).not.toContain('张三');
  });

  it('不超过字符上限', () => {
    const paragraphs = Array.from({ length: 50 }, (_, index) => `张三李四第${index}段对话内容。`);
    const excerpt = buildExcerpt(paragraphs.join('\n\n'), ['张三', '李四'], { maxChars: 120 });
    expect(excerpt.length).toBeLessThanOrEqual(120);
  });
});
