import { describe, expect, it } from 'vitest';
import { buildCanvasFromAnalysis } from './graph';
import type { AnalysisResult } from './types';

const result: AnalysisResult = {
  characters: [
    { name: '张三', gender: '男', description: '主角' },
    { name: '李四', gender: '女', description: '同门' },
  ],
  relations: [
    { from: '张三', to: '李四', type: '同门', description: '一起长大', confidence: 'high' },
    { from: '张三', to: '不存在', type: '朋友' },
    { from: '李四', to: '李四', type: '自己' },
  ],
};

describe('buildCanvasFromAnalysis', () => {
  it('生成角色节点与合法关系边', () => {
    const state = buildCanvasFromAnalysis(result, ['张三', '李四']);
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0]).toMatchObject({
      id: 'n1',
      data: { name: '张三', gender: '男', intro: '主角', shape: 'circle' },
    });
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]).toMatchObject({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      data: { type: '同门', color: '#333', width: 2, arrow: true },
    });
    expect(state.version).toBe(1);
  });

  it('确认名单缺失时用默认信息补齐', () => {
    const state = buildCanvasFromAnalysis({ characters: [], relations: [] }, ['王五']);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].data).toMatchObject({ name: '王五', gender: '未知' });
  });
});
