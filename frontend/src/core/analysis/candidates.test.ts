import { describe, expect, it } from 'vitest';
import {
  addOnlineAliases, buildOnlineCandidateRows, mergeCandidateRows, type MergeableCandidate,
} from './candidates';

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

describe('在线人物匹配', () => {
  const onlineCharacters = [
    { name: '唐僧', aliases: ['江流儿'], description: '取经人' },
    { name: '孙悟空', aliases: ['齐天大圣'], description: '猴王' },
  ];

  it('精确姓名/本地别名匹配时自动补充在线别名', () => {
    const matched = addOnlineAliases(rows, onlineCharacters);
    expect(matched.find((row) => row.key === 'monk')?.aliases)
      .toEqual(expect.arrayContaining(['三藏', '江流儿']));
  });

  it('仅在线人物默认不勾选并标记为未匹配', () => {
    const onlineRows = buildOnlineCandidateRows(rows, onlineCharacters);
    expect(onlineRows.find((row) => row.name === '唐僧')?.matched).toBe(true);
    expect(onlineRows.find((row) => row.name === '孙悟空')).toMatchObject({
      matched: false,
      selected: false,
    });
  });
});
