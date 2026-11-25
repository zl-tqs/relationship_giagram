import { describe, expect, it } from 'vitest';
import { preprocessNovel } from './preprocess';

function preprocess(text: string) {
  const data = new TextEncoder().encode(text).buffer;
  return preprocessNovel(data);
}

describe('关系称谓识别', () => {
  it('直接同位的唯一人物自动成为别名', () => {
    const result = preprocess([
      '王夫人说道：“一。”',
      '舅母王夫人笑道：“二。”',
    ].join('\n'));

    const ladyWang = result.candidates.find((candidate) => candidate.name === '王夫人');
    expect(ladyWang?.aliases).toContain('舅母');
    expect(result.relationshipMentions).toHaveLength(0);
  });

  it('无法解析的关系称谓保留在独立列表中，不进入人物候选', () => {
    const result = preprocess('舅母说道：“一。”');

    expect(result.candidates.map((candidate) => candidate.name)).not.toContain('舅母');
    expect(result.relationshipMentions).toEqual([
      expect.objectContaining({
        term: '舅母',
        count: 1,
        context: expect.stringContaining('舅母'),
      }),
    ]);
  });

  it('身份判断句中的唯一目标也可以自动归一', () => {
    const result = preprocess([
      '王夫人说道：“一。”',
      '舅母是王夫人笑道：“二。”',
    ].join('\n'));

    const ladyWang = result.candidates.find((candidate) => candidate.name === '王夫人');
    expect(ladyWang?.aliases).toContain('舅母');
    expect(result.relationshipMentions).toHaveLength(0);
  });

  it('所属上下文只记录关系称谓，不把所属人物误当目标', () => {
    const result = preprocess([
      '贾琏说道：“一。”',
      '宝玉的舅母说道：“二。”',
    ].join('\n'));

    const mention = result.relationshipMentions.find((item) => item.term === '舅母');
    expect(mention).toBeDefined();
    expect(mention?.suggestedTarget).toBeUndefined();
    expect(result.candidates.map((candidate) => candidate.name)).not.toContain('舅母');
  });

  it('多个直接目标时不自动合并', () => {
    const result = preprocess([
      '姑爷贾琏说道：“一。”',
      '姑爷贾蓉说道：“二。”',
    ].join('\n'));

    const mention = result.relationshipMentions.find((item) => item.term === '姑爷');
    expect(mention?.count).toBe(2);
    expect(mention?.suggestedTarget).toBeUndefined();
  });
});
