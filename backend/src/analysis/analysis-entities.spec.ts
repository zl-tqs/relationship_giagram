import { describe, expect, it } from 'vitest';

describe('analysis entities', () => {
  it('结果实体可以独立加载，不触发循环依赖', async () => {
    const module = await import('./analysis-result.entity.js');
    expect(module.AnalysisResult).toBeDefined();
  });
});
