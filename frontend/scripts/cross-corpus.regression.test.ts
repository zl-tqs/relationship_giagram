import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { preprocessNovel, type PreprocessOutcome } from '../src/core/analysis/preprocess';

// 轻量跨语料冒烟：只验证主要角色是否保留、候选数是否不超过 120。
// 语料在 resources 下且被 gitignore，缺失时整组 skip。
const corpora = [
  {
    label: '三国演义',
    file: '《三国演义》.txt',
    expected: ['孔明', '曹操', '关公', '张飞', '吕布', '刘备', '孙权', '赵云'],
  },
  {
    label: '西游记（青少版）',
    file: '西游记（青少版）-2025062113.txt',
    expected: ['唐僧', '孙悟空', '八戒', '沙僧', '玉帝'],
  },
].map((corpus) => ({
  ...corpus,
  path: resolve(process.cwd(), '../resources/novel/txt', corpus.file),
}));

for (const corpus of corpora) {
  const available = existsSync(corpus.path);
  if (!available) {
    console.warn(`[跨语料冒烟] 跳过 ${corpus.label}：未找到 ${corpus.path}`);
  }

  describe.skipIf(!available)(`${corpus.label} 本地提取冒烟`, () => {
    let result: PreprocessOutcome;

    beforeAll(() => {
      const buffer = readFileSync(corpus.path);
      const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      result = preprocessNovel(data as ArrayBuffer);
    }, 120000);

    it('主要角色保留且候选数不超过 120', () => {
      const names = result.candidates.map((candidate) => candidate.name);

      expect(result.candidates.length).toBeLessThanOrEqual(120);
      for (const expected of corpus.expected) {
        expect(names).toContain(expected);
      }
    }, 120000);
  });
}
