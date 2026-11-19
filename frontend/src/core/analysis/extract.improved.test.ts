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

  it('适配文言文说话、动作与叙事噪声', () => {
    const text = [
      '姜子牙曰：“纣王无道，吾代理封神。”',
      '子牙曰：“今日出营，明日进营。”',
      '纣王曰：“姜子牙，你敢反我？”',
      '黄飞虎曰：“末将听令。”',
      '飞虎曰：“愿随太师。”',
      '苏全忠曰：“父亲小心。”',
      '全忠曰：“孩儿明白。”',
      '哪吒应曰：“弟子愿往。”',
      '妲己曰：“大王，且听妾言。”',
      '武王曰：“太师以为如何？”',
      '子牙传令：“三军入中军。”',
      '子牙吩咐妖怪：“大呼曰，人曰，不表，不言。”',
      '燃灯道人曰：“准提道人来了。”',
      '燃灯曰：“不表此事。”',
      '准提曰：“不言也罢。”',
      '纣王囚禁大臣，百官退下，军士与士卒守在鹿台、摘星楼。',
      '万仙阵前数合，东南方向言语不断。',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toEqual(expect.arrayContaining([
      '姜子牙', '纣王', '黄飞虎', '苏全忠', '哪吒', '妲己', '武王',
      '燃灯道人', '准提道人',
    ]));
    for (const alias of ['子牙', '飞虎', '全忠', '燃灯', '准提']) {
      expect(names).not.toContain(alias);
    }
    for (const noise of [
      '大呼曰', '人曰', '不表', '不言', '出营', '进营', '吾代理封神',
      '纣王囚禁大臣', '子牙吩咐妖怪', '入中军', '百官', '军士', '士卒',
      '万仙阵', '鹿台', '摘星楼', '数合', '东南', '言语',
    ]) {
      expect(names).not.toContain(noise);
    }
  });

  it('强说话人名后追加动词或名词不形成新的更长候选', () => {
    const text = [
      '孔明说道：“军师在此。”孔明作怪。',
      '玄德说道：“贤弟。”玄德疑怪。',
      '关公说道：“大哥。”关公迎。',
      '张飞说道：“燕人。”张飞诗。',
      '黄忠说道：“老将。”赞黄忠说道：“末将愿往。”',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toEqual(expect.arrayContaining(['孔明', '玄德', '关公', '张飞', '黄忠']));
    for (const noise of ['孔明作怪', '玄德疑怪', '关公迎', '张飞诗', '赞黄忠']) {
      expect(names).not.toContain(noise);
    }
  });

  it('过滤常见地名和行政区后缀，保留强说话人证据的人名', () => {
    const text = [
      '华夏说道：“这是地名。”',
      '长城说道：“这是地名。”',
      '国家说道：“这是地名。”',
      '江南市说道：“这是城市。”',
      '青云省说道：“这是省份。”',
      '黑风岭说道：“这是山岭。”',
      '张州说道：“我是人名。”',
      '他去了A市和S省。',
    ].join('\n');
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('张州');
    for (const place of [
      '华夏', '长城', '国家', '江南市', '青云省', '黑风岭', 'A市', 'S省',
    ]) {
      expect(names).not.toContain(place);
    }
  });

  it('个人头衔优先取最短前缀，避免把动作并入姓名', () => {
    const text = '众人机模仿寇员外说道：“高太公来了。”';
    const names = extractCharacterCandidates(text).map((candidate) => candidate.name);

    expect(names).toContain('寇员外');
    expect(names).not.toContain('机模仿寇员外');
  });

  it('不把仅出现在全名内部的尾部当作别名', () => {
    const text = [
      '土行孙说道：“我先去。”',
      '土行孙笑道：“莫急。”',
      '土行孙转身走了。',
    ].join('\n');
    const candidate = extractCharacterCandidates(text).find((item) => item.name === '土行孙');

    expect(candidate?.aliases ?? []).not.toContain('行孙');
  });

  it('默认候选上限为 120', () => {
    expect(DEFAULT_CANDIDATE_LIMIT).toBe(120);
  });
});
