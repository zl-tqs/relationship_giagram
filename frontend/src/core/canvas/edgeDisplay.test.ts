import { describe, it, expect } from 'vitest';
import { MarkerType, type Edge } from '@xyflow/react';
import { toDisplayEdges } from './edgeDisplay';

const edgeWith = (data: Record<string, unknown>): Edge => ({
  id: 'e1',
  source: 'a',
  target: 'b',
  data,
});

describe('toDisplayEdges', () => {
  it('把关系类型显示为连线标签', () => {
    const [edge] = toDisplayEdges([edgeWith({ type: '师徒' })]);
    expect(edge.label).toBe('师徒');
  });

  it('应用颜色与粗细', () => {
    const [edge] = toDisplayEdges([edgeWith({ color: '#ff0000', width: 4 })]);
    expect(edge.style).toEqual({ stroke: '#ff0000', strokeWidth: 4 });
  });

  it('按箭头开关设置 markerEnd', () => {
    const [on] = toDisplayEdges([edgeWith({ arrow: true, color: '#00ff00' })]);
    expect(on.markerEnd).toEqual({ type: MarkerType.ArrowClosed, color: '#00ff00' });

    const [off] = toDisplayEdges([edgeWith({ arrow: false })]);
    expect(off.markerEnd).toBeUndefined();
  });

  it('缺少样式字段时使用默认值', () => {
    const [edge] = toDisplayEdges([edgeWith({})]);
    expect(edge.style).toEqual({ stroke: '#333', strokeWidth: 2 });
    expect(edge.markerEnd).toBeUndefined();
  });
});
