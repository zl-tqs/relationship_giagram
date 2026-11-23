import { describe, expect, it } from 'vitest';
import { isPhraseCandidate } from './candidateRules';
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

  it('说话人窗口产出的 5 字短语 来拉著宝玉 被剔除且不吞并 宝玉', () => {
    const text = [
      '宝玉说道：“一。”',
      '贾母伸出手来拉著宝玉道：“我的儿。”',
    ].join('\n');

    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('宝玉');
    expect(names).not.toContain('来拉著宝玉');
    expect(names).not.toContain('手来拉著宝玉');
  });

  it('复姓 上官 不被短语规则误删，且不残留 3 字截断名', () => {
    const text = [
      '上官婉儿说道：“一。”',
      '上官婉儿笑道：“二。”',
      '太平公主说道：“婉儿，你来了。”',
    ].join('\n');

    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('上官婉儿');
    expect(names).not.toContain('官婉儿');
  });

  it('不带间隔号的音译名不被短语规则误删，动作短语仍被剔除', () => {
    const text = [
      '拉尔夫说道：“一。”',
      '拉尔夫笑道：“二。”',
      '凤姐便拉平儿笑道：“你来。”',
    ].join('\n');

    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('拉尔夫');
    expect(names).toContain('平儿');
    expect(names).not.toContain('拉平儿');
  });

  it('普通长名仍可吸收只在长名内部出现的短名', () => {
    const text = [
      '贾宝玉说道：“一。”',
      '贾宝玉笑道：“二。”',
      '宝玉又道：“三。”',
    ].join('\n');

    const candidates = extractCharacterCandidates(text);
    const names = candidates.map((candidate) => candidate.name);

    expect(names).toContain('贾宝玉');
    expect(names).not.toContain('宝玉');
    expect(candidates.find((candidate) => candidate.name === '贾宝玉')?.aliases).toContain('宝玉');
  });

  it('保留完整姓名和角色称呼，不把传统字当作姓名', () => {
    const text = [
      '史湘云道：“二哥哥来了。”',
      '王熙凤笑道：“我来迟了。”',
      '王夫人说道：“宝玉，你过来。”',
      '尤二姐说道：“妹妹来了。”',
      '贾宝玉说道：“我来了。”',
      '说著贾母又笑道：“好。”',
      '应著说道：“是。”',
      '孔明云：“此计可行。”',
    ].join('\n');

    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    for (const expected of ['史湘云', '王熙凤', '王夫人', '尤二姐', '贾宝玉', '贾母', '孔明']) {
      expect(names).toContain(expected);
    }
    for (const noise of ['史湘', '王熙', '尤二', '著贾母', '应著', '孔明云']) {
      expect(names).not.toContain(noise);
    }
  });

  it('过滤泛称、动作词和地名，不生成泛称别名', () => {
    const text = [
      '林黛玉说道：“林妹妹来了。”',
      '林妹妹笑道：“姐姐好。”',
      '奶奶说道：“父母来了。”',
      '他收拾了扇子，并不理会。',
      '荣国府里，怡红院、潇湘馆、大观园都安静。',
    ].join('\n');

    const candidates = extractCharacterCandidates(text);
    const names = candidates.map((candidate) => candidate.name);

    for (const noise of [
      '奶奶', '父母', '收拾', '并不', '扇子',
      '荣国府', '怡红院', '潇湘馆', '大观园',
    ]) {
      expect(names).not.toContain(noise);
    }

    expect(names).toContain('林黛玉');
    expect(names).toContain('林妹妹');
    const sister = candidates.find((candidate) => candidate.name === '林妹妹');
    expect(sister).toBeDefined();
    expect(sister?.aliases ?? []).not.toContain('妹妹');
  });

  it('硬地名后缀在强说话人来源下仍被过滤', () => {
    const text = [
      '怡红院说道：“好。”',
      '大观园笑道：“好。”',
      '潇湘馆说道：“好。”',
      '荣国府笑道：“好。”',
      '贾宝玉说道：“好。”',
    ].join('\n');

    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('贾宝玉');
    for (const place of ['怡红院', '大观园', '潇湘馆', '荣国府', '国府']) {
      expect(names).not.toContain(place);
    }
  });

  it('泛称频次高于具体称呼时也不生成泛称别名', () => {
    const text = [
      '妹妹说道：“一。”',
      '妹妹笑道：“二。”',
      '林妹妹说道：“三。”',
    ].join('\n');

    const candidates = extractCharacterCandidates(text);
    const names = candidates.map((candidate) => candidate.name);
    const sister = candidates.find((candidate) => candidate.name === '林妹妹');

    expect(names).toContain('林妹妹');
    expect(names).not.toContain('妹妹');
    expect(sister).toBeDefined();
    expect(sister?.aliases ?? []).not.toContain('妹妹');
  });

  it('泛称说话人不进入候选', () => {
    const text = [
      '婆子说道：“一。”',
      '嬷嬷笑道：“二。”',
      '老太太说道：“三。”',
      '头子说道：“四。”',
      '姨妈笑道：“五。”',
      '姥姥说道：“六。”',
    ].join('\n');

    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toEqual([]);
  });
});

describe('isPhraseCandidate 边界', () => {
  it('间隔号音译名、复姓与音译名放行', () => {
    expect(isPhraseCandidate('保尔·柯察金')).toBe(false);
    expect(isPhraseCandidate('上官婉儿')).toBe(false);
    expect(isPhraseCandidate('拉尔夫')).toBe(false);
  });

  it('普通姓名放行', () => {
    expect(isPhraseCandidate('宝玉')).toBe(false);
    expect(isPhraseCandidate('贾宝玉')).toBe(false);
    expect(isPhraseCandidate('晴雯')).toBe(false);
  });

  it('动作短语被拒绝', () => {
    expect(isPhraseCandidate('拉平儿')).toBe(true);
    expect(isPhraseCandidate('推晴雯')).toBe(true);
    expect(isPhraseCandidate('来拉著宝玉')).toBe(true);
    expect(isPhraseCandidate('手来拉著宝玉')).toBe(true);
    expect(isPhraseCandidate('上宝玉')).toBe(true);
  });
});
