import { describe, expect, it } from 'vitest';
import { mergeCandidateRows, type MergeableCandidate } from './candidates';

const rows: MergeableCandidate[] = [
  {
    key: 'teacher',
    originalName: '师父',
    name: '唐僧',
    count: 10,
    confidence: 'high',
    selected: true,
    aliases: [],
  },
  {
    key: 'monk',
    originalName: '唐僧',
    name: '唐僧',
    count: 20,
    confidence: 'high',
    selected: false,
    aliases: ['三藏'],
  },
];

describe('mergeCandidateRows', () => {
  it('把来源候选合并到目标并保留别名与次数', () => {
    const merged = mergeCandidateRows(rows, 'teacher', 'monk');
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      key: 'monk',
      name: '唐僧',
      selected: true,
      count: 30,
    });
    expect(merged[0].aliases).toEqual(expect.arrayContaining(['师父', '三藏']));
  });

  it('来源与目标相同时不修改原数组', () => {
    expect(mergeCandidateRows(rows, 'teacher', 'teacher')).toBe(rows);
  });
});
