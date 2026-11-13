import { describe, expect, it } from 'vitest';
import { buildCooccurrences, extractCharacterCandidates } from './extract';

describe('extractCharacterCandidates', () => {
  it('从对话与叙述中抽取人物', () => {
    const text = [
      '张三说道：“李四，你终于来了。”',
      '李四笑道：“张三，好久不见。”',
      '王五站在一旁，张三与李四对视一眼。',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((item) => item.name);
    expect(names).toContain('张三');
    expect(names).toContain('李四');
    expect(names).toContain('王五');
  });

  it('支持复姓', () => {
    const text = '欧阳锋说道：“司马懿，你来了。”司马懿答道：“欧阳锋，久等。”';
    const names = extractCharacterCandidates(text).map((item) => item.name);
    expect(names).toContain('欧阳锋');
    expect(names).toContain('司马懿');
  });

  it('过滤常见词语误判', () => {
    const text = '这时候，他想起很多事情。地方很大，天下人都知道。张三说道：“走吧。”';
    const names = extractCharacterCandidates(text).map((item) => item.name);
    expect(names).not.toContain('时候');
    expect(names).not.toContain('事情');
    expect(names).not.toContain('地方');
    expect(names).not.toContain('天下');
    expect(names).toContain('张三');
  });

  it('不把姓名后的连词或副词并入姓名', () => {
    const text = [
      '张三说道：“李四，你终于来了。”',
      '李四笑道：“张三，好久不见。”',
      '张三与李四并肩而行，王五独自离开。',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((item) => item.name);
    expect(names).toContain('李四');
    expect(names).toContain('王五');
    expect(names).not.toContain('李四并');
    expect(names).not.toContain('王五独');
  });

  it('按出现频次排序并限制数量', () => {
    const text = '张三说道。张三笑道。李四说道。李四笑道。李四答道。';
    const candidates = extractCharacterCandidates(text, 1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe('李四');
  });
});

describe('buildCooccurrences', () => {
  it('统计同段落共现次数', () => {
    const text = [
      '张三与李四并肩而行。',
      '王五独自离开。',
      '张三、李四和王五同桌吃饭。',
    ].join('\n\n');
    const pairs = buildCooccurrences(text, ['张三', '李四', '王五']);
    expect(pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ a: '张三', b: '李四', count: 2 }),
        expect.objectContaining({ a: '张三', b: '王五', count: 1 }),
      ]),
    );
  });
});
