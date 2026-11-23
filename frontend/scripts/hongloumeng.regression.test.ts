import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { preprocessNovel, type PreprocessOutcome } from '../src/core/analysis/preprocess';

const novelPath = resolve(process.cwd(), '../resources/novel/txt/红楼梦.txt');

describe.skipIf(!existsSync(novelPath))('红楼梦本地提取回归', () => {
  let result: PreprocessOutcome;

  beforeAll(() => {
    const buffer = readFileSync(novelPath);
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    result = preprocessNovel(data as ArrayBuffer);
  }, 120000);

  it('不产生动作短语候选并保留主要人物', () => {
    const names = result.candidates.map((candidate) => candidate.name);

    expect(result.candidates.length).toBeLessThanOrEqual(120);
    // 贾宝玉/王熙凤 在正文中绝大多数以常用称呼出现，规范名本身频次很低；
    // 二者任一存在即视为保留主要人物。
    expect(names.some((name) => name === '贾宝玉' || name === '宝玉')).toBe(true);
    expect(names.some((name) => name === '王熙凤' || name === '凤姐儿' || name === '凤姐'))
      .toBe(true);
    for (const expected of [
      '林黛玉', '薛宝钗', '史湘云', '贾母',
      '王夫人', '平儿', '晴雯', '紫鹃', '尤二姐',
    ]) {
      expect(names).toContain(expected);
    }
    for (const noise of [
      '手来拉著宝玉', '著贾母', '著宝钗', '拉平儿', '推晴雯',
      '推紫鹃', '赦贾政', '纨探春', '命贾蓉', '里贾琏出来',
      '著李纨', '著香菱', '上拉著金桂',
    ]) {
      expect(names).not.toContain(noise);
    }
  }, 120000);

  it('不把红楼梦地名和泛称作为人物', () => {
    const names = result.candidates.map((candidate) => candidate.name);

    for (const noise of [
      '荣国府', '宁府', '荣府', '怡红院', '潇湘馆', '大观园',
      '奶奶', '父母', '嫂子', '老婆子', '丫头子', '并不', '收拾',
      // 全量回归中占据 top 120 的高频通用词
      '银子', '丫鬟', '瞧瞧', '况且', '伏侍', '衣服', '昨儿', '来瞧',
      '亲戚', '若不', '光景', '闲话', '园子',
    ]) {
      expect(names).not.toContain(noise);
    }
    const sister = result.candidates.find((candidate) => candidate.name === '凤姐儿');
    expect(sister?.aliases ?? []).not.toContain('姐儿');
  }, 120000);
});
