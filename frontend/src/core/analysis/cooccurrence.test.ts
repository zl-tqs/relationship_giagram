import { describe, expect, it } from 'vitest';
import { remapCooccurrences } from './cooccurrence';

describe('remapCooccurrences', () => {
  it('改名后合并重复关系对', () => {
    const pairs = [
      { a: '张三', b: '李四', count: 2 },
      { a: '张真人', b: '李四', count: 1 },
      { a: '张三', b: '王五', count: 1 },
    ];
    const mapped = remapCooccurrences(pairs, { 张三: '张真人' });
    expect(mapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ a: '张真人', b: '李四', count: 3 }),
        expect.objectContaining({ a: '张真人', b: '王五', count: 1 }),
      ]),
    );
  });

  it('改名后与自身重合的关系对被丢弃', () => {
    const mapped = remapCooccurrences([{ a: '张三', b: '李四', count: 2 }], { 李四: '张三' });
    expect(mapped).toEqual([]);
  });
});
