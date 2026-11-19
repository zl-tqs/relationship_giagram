import { describe, expect, it } from 'vitest';
import { buildLocalAnalysisSnapshot } from './debugSnapshot';

describe('buildLocalAnalysisSnapshot', () => {
  it('记录本地预处理结果并截断片段预览', () => {
    const snapshot = buildLocalAnalysisSnapshot(
      {
        fileName: '封神榜.txt',
        fileSize: 1024,
        encoding: 'utf-8',
        chapterCount: 100,
        textLength: 5000,
        candidates: [
          {
            name: '姜子牙',
            count: 10,
            confidence: 'high',
            aliases: ['子牙'],
          },
        ],
        cooccurrences: [{ a: '姜子牙', b: '纣王', count: 3 }],
        excerptPreview: '甲'.repeat(4000),
      },
      new Date('2026-11-19T00:00:00.000Z'),
    );

    expect(snapshot).toMatchObject({
      generatedAt: '2026-11-19T00:00:00.000Z',
      source: 'browser-preprocess',
      fileName: '封神榜.txt',
      fileSize: 1024,
      encoding: 'utf-8',
      chapters: 100,
      textLength: 5000,
      candidateCount: 1,
    });
    expect(snapshot.candidates[0].aliases).toEqual(['子牙']);
    expect(snapshot.excerptPreview).toHaveLength(3000);
    expect('text' in snapshot).toBe(false);
  });
});
