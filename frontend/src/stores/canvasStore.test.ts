import { describe, it, expect, beforeEach } from 'vitest';
import type { Edge } from '@xyflow/react';
import { useCanvasStore } from './canvasStore';

const edge: Edge = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  data: { color: '#333', width: 2, arrow: true },
};

describe('canvasStore.addEdge', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      version: 1,
      past: [],
      future: [],
    });
  });

  it('新增连线后可撤销、可恢复', () => {
    useCanvasStore.getState().addEdge(edge);
    expect(useCanvasStore.getState().edges).toEqual([edge]);
    expect(useCanvasStore.getState().canUndo()).toBe(true);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().edges).toEqual([]);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().edges).toEqual([edge]);
  });

  it('全选与取消选择会标记节点和连线', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', position: { x: 0, y: 0 }, data: { name: 'A' } },
        { id: 'n2', position: { x: 0, y: 0 }, data: { name: 'B' } },
      ],
      edges: [edge],
    });

    useCanvasStore.getState().selectAll();
    expect(useCanvasStore.getState().nodes.every((n) => n.selected)).toBe(true);
    expect(useCanvasStore.getState().edges.every((e) => e.selected)).toBe(true);

    useCanvasStore.getState().clearSelection();
    expect(useCanvasStore.getState().nodes.some((n) => n.selected)).toBe(false);
    expect(useCanvasStore.getState().edges.some((e) => e.selected)).toBe(false);
  });
});
