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

  it('reverseEdge 交换起点/终点与 handle，并可撤销', () => {
    useCanvasStore.setState({
      edges: [{ ...edge, sourceHandle: 's', targetHandle: 't' }],
    });

    useCanvasStore.getState().reverseEdge('e1');

    expect(useCanvasStore.getState().edges[0]).toMatchObject({
      source: 'n2',
      target: 'n1',
      sourceHandle: 't',
      targetHandle: 's',
    });

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().edges[0]).toMatchObject({
      source: 'n1',
      target: 'n2',
      sourceHandle: 's',
      targetHandle: 't',
    });
  });

  it('加载已有节点后新增角色不会复用旧节点 ID', () => {
    useCanvasStore.getState().loadState(
      [
        { id: 'n1', position: { x: 0, y: 0 }, data: { name: 'A' } },
        { id: 'n2', position: { x: 0, y: 0 }, data: { name: 'B' } },
        { id: 'n3', position: { x: 0, y: 0 }, data: { name: 'C' } },
      ],
      [],
      { x: 0, y: 0, zoom: 1 },
      2,
    );

    useCanvasStore.getState().addCharacter('circle');

    const ids = useCanvasStore.getState().nodes.map((node) => node.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids[3]).not.toBe('n1');
  });

  it('loadState 重置历史，applySnapshot 将当前内容压入撤销栈', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'old', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      past: [{ nodes: [], edges: [] }],
      future: [{ nodes: [], edges: [] }],
    });

    useCanvasStore.getState().loadState(
      [{ id: 'server', position: { x: 0, y: 0 }, data: {} }],
      [],
      { x: 1, y: 2, zoom: 1.5 },
      4,
    );

    expect(useCanvasStore.getState()).toMatchObject({
      version: 4,
      viewport: { x: 1, y: 2, zoom: 1.5 },
      past: [],
      future: [],
    });

    useCanvasStore.getState().applySnapshot(
      [{ id: 'snapshot', position: { x: 0, y: 0 }, data: {} }],
      [],
    );

    expect(useCanvasStore.getState().nodes[0].id).toBe('snapshot');
    expect(useCanvasStore.getState().past[0].nodes[0].id).toBe('server');

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes[0].id).toBe('server');
  });
});
