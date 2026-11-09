import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CanvasState } from '../../types';
import { normalizeCanvasState } from './legacy';

const makeState = (edges: Edge[]): CanvasState => ({
  nodes: [],
  edges,
  viewport: { x: 0, y: 0, zoom: 1 },
  version: 1,
});

describe('normalizeCanvasState', () => {
  it('旧 label 在 type 为空时回填为 type', () => {
    const state = makeState([
      { id: 'e1', source: 'a', target: 'b', data: { label: '师徒', color: '#f00', width: 2, arrow: true } },
    ]);

    const result = normalizeCanvasState(state);

    expect(result.edges[0].data).toEqual({ type: '师徒', color: '#f00', width: 2, arrow: true });
  });

  it('type 与 label 同时存在时以 type 为准', () => {
    const state = makeState([
      { id: 'e1', source: 'a', target: 'b', data: { type: '朋友', label: '旧标注', color: '#333', width: 2, arrow: true } },
    ]);

    const result = normalizeCanvasState(state);

    expect(result.edges[0].data).toEqual({ type: '朋友', color: '#333', width: 2, arrow: true });
  });

  it('不修改原始数据', () => {
    const edge: Edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      data: { label: '师徒', color: '#333', width: 2, arrow: true },
    };
    const state = makeState([edge]);

    normalizeCanvasState(state);

    expect(edge.data).toEqual({ label: '师徒', color: '#333', width: 2, arrow: true });
  });

  it('没有 label 的连线保持不变', () => {
    const state = makeState([
      { id: 'e1', source: 'a', target: 'b', data: { type: '朋友', color: '#333', width: 2, arrow: false } },
      { id: 'e2', source: 'b', target: 'c' },
    ]);

    const result = normalizeCanvasState(state);

    expect(result.edges).toEqual(state.edges);
  });
});
