import { describe, expect, it } from 'vitest';
import { DEFAULT_CANDIDATE_LIMIT, extractCharacterCandidates } from './extract';

describe('改进后的人物提取', () => {
  it('识别非姓氏名字并合并别名', () => {
    const text = [
      '猪八戒说道：“师父，俺老猪饿了。”',
      '孙悟空笑道：“八戒，莫要乱说。”',
      '唐僧和八戒一路向西。',
    ].join('\n');
    const candidates = extractCharacterCandidates(text);
    const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]));

    expect(byName.has('猪八戒')).toBe(true);
    expect(byName.get('猪八戒')?.aliases).toContain('八戒');
    expect(byName.has('八戒')).toBe(false);
    expect(byName.has('和八戒')).toBe(false);
    expect(byName.has('师父')).toBe(false);
    expect(byName.has('要乱')).toBe(false);
    expect(byName.has('孙悟空')).toBe(true);
    expect(byName.has('唐僧')).toBe(true);
  });

  it('过滤称谓、武器、集合词和歧义泛称', () => {
    const text = [
      '乌鸡国国王说道：“那妖怪抢走了王后。”',
      '宝象国公主笑道：“父王，莫怕。”',
      '唐僧师徒一路西行，金箍棒金光闪闪。',
      '师父说道：“水面有动静。”',
      '方丈解释道：“施礼即可，别乱说话。”',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('乌鸡国国王');
    expect(names).toContain('宝象国公主');
    expect(names).toContain('唐僧');
    for (const noise of [
      '国王', '公主', '那妖怪', '金箍棒', '师父', '方丈',
      '水面', '解释', '施礼', '别乱', '唐僧师徒',
    ]) {
      expect(names).not.toContain(noise);
    }
  });

  it('补全特殊后缀姓名并抑制截断名', () => {
    const text = [
      '二郎神说道：“太白金星，你看那妖猴。”',
      '太白金星笑道：“二郎神，莫急。”',
      '白龙马说道：“俺驮师父过河。”',
      '金角大王笑道：“孙悟空，你来了。”',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toEqual(expect.arrayContaining(['二郎神', '太白金星', '白龙马', '金角大王', '孙悟空']));
    for (const truncated of ['郎神', '金星', '白金星', '白龙', '金角']) {
      expect(names).not.toContain(truncated);
    }
  });

  it('抑制姓名内部切片和单字动词造成的噪声', () => {
    const text = [
      '孙悟空见到八戒，悟空和八戒一起追妖怪。',
      '妖怪变成一道金光，悟空骂了一声。',
      '那妖怪逃走了，水面恢复了平静。',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('孙悟空');
    expect(names).toContain('八戒');
    for (const noise of ['空见', '空和八戒', '成一', '空骂', '那妖怪', '水面']) {
      expect(names).not.toContain(noise);
    }
  });

  it('默认候选上限为 120', () => {
    expect(DEFAULT_CANDIDATE_LIMIT).toBe(120);
  });
});
