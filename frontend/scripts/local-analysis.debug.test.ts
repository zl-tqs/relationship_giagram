import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildExcerpt } from '../src/core/analysis/excerpt';
import { preprocessNovel } from '../src/core/analysis/preprocess';

const novelPath = process.env.NOVEL_PATH;
const outputDir = resolve(
  process.cwd(),
  process.env.NOVEL_OUTPUT_DIR ?? '../resources/text_log',
);

describe.skipIf(!novelPath)('本地提取调试', () => {
  it('输出候选、别名、共现和摘要预览', () => {
    const source = resolve(novelPath!);
    expect(existsSync(source)).toBe(true);

    const buffer = readFileSync(source);
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const result = preprocessNovel(data as ArrayBuffer);

    const aliasMap: Record<string, string> = {};
    for (const candidate of result.candidates) {
      for (const alias of candidate.aliases ?? []) aliasMap[alias] = candidate.name;
    }
    const excerpt = buildExcerpt(
      result.text,
      result.candidates.map((candidate) => candidate.name),
      { maxChars: 12000, replacements: aliasMap },
    );

    const generatedAt = new Date();
    const output = {
      generatedAt: generatedAt.toISOString(),
      source,
      fileName: basename(source),
      encoding: result.encoding,
      chapters: result.chapterCount,
      candidateCount: result.candidates.length,
      candidates: result.candidates,
      cooccurrences: result.cooccurrences,
      excerptPreview: excerpt.slice(0, 3000),
    };

    mkdirSync(outputDir, { recursive: true });
    const stamp = generatedAt.toISOString().replace(/[:.]/g, '-');
    const outputPath = resolve(outputDir, `local-analysis-${stamp}.json`);
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

    console.table(
      result.candidates.slice(0, 40).map((candidate, index) => ({
        index: index + 1,
        name: candidate.name,
        count: candidate.count,
        confidence: candidate.confidence,
        aliases: (candidate.aliases ?? []).join(' / ') || '-',
      })),
    );
    console.log(`共 ${result.candidates.length} 位候选，完整结果写入：${outputPath}`);
    console.log(`片段预览：\n${excerpt.slice(0, 800)}`);

    expect(result.candidates.length).toBeLessThanOrEqual(120);
    expect(outputPath).toContain('local-analysis-');
  }, 120000);
});
