import { describe, expect, it } from 'vitest';
import { extractCharacterCandidates } from './extract';

describe('候选规范化回归', () => {
  it('动作短语不吞并真实短名，count 使用原文实际次数', () => {
    const text = [
      '宝玉说道：“一。”',
      '宝玉笑道：“二。”',
      '贾母从被窝里伸出手来拉著宝玉道：“我的儿。”',
      '凤姐便拉平儿笑道：“你来。”',
      '宝钗推晴雯笑道：“你去。”',
    ].join('\n');

    const candidates = extractCharacterCandidates(text);
    const names = candidates.map((candidate) => candidate.name);

    expect(names).toContain('宝玉');
    expect(names).toContain('平儿');
    expect(names).toContain('晴雯');
    expect(names).not.toContain('手来拉著宝玉');
    expect(names).not.toContain('拉平儿');
    expect(names).not.toContain('推晴雯');
    expect(candidates.find((candidate) => candidate.name === '宝玉')?.count).toBe(3);
  });
});
