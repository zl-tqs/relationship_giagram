import { describe, expect, it } from 'vitest';
import { preprocessNovel } from './preprocess';

describe('preprocessNovel', () => {
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
