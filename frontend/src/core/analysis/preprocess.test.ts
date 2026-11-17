import { describe, expect, it } from 'vitest';
import { preprocessNovel } from './preprocess';

describe('preprocessNovel', () => {
  it('别名合并后共现使用规范名', () => {
    const text = [
      '猪八戒说道：“师父，俺老猪饿了。”',
      '孙悟空笑道：“八戒，莫要乱说。”',
    ].join('\n');
    const data = new TextEncoder().encode(text).buffer;
    const result = preprocessNovel(data);
    const pig = result.candidates.find((candidate) => candidate.name === '猪八戒');
    expect(pig?.aliases).toContain('八戒');
    expect(result.cooccurrences.some((pair) => (
      [pair.a, pair.b].includes('猪八戒') && [pair.a, pair.b].includes('孙悟空')
    ))).toBe(true);
    expect(result.cooccurrences.some((pair) => [pair.a, pair.b].includes('八戒'))).toBe(false);
  });

  it('解码后统计章节、人物与共现', () => {
    const text = [
      '第一章 初见',
      '张三说道：“李四，你来了。”',
      '第二章 同行',
      '李四笑道：“张三，走吧。”',
    ].join('\n');
    const data = new TextEncoder().encode(text).buffer;
    const result = preprocessNovel(data);
    expect(result.encoding).toBe('utf-8');
    expect(result.chapterCount).toBe(2);
    expect(result.candidates.map((item) => item.name)).toEqual(expect.arrayContaining(['张三', '李四']));
    expect(result.cooccurrences[0].count).toBe(2);
    expect([result.cooccurrences[0].a, result.cooccurrences[0].b].sort()).toEqual(['张三', '李四'].sort());
  });
});
