import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { findFreeNodePosition, type PlacementContext } from './placement';

function context(overrides: Partial<PlacementContext> = {}): PlacementContext {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    width: 800,
    height: 600,
    fallback: () => ({ x: -1, y: -1 }),
    ...overrides,
  };
}

function node(id: string, x: number, y: number): Node {
  return { id, position: { x, y }, data: {} };
}

describe('findFreeNodePosition', () => {
  it('空画布放在可视区域左上角空位', () => {
    expect(findFreeNodePosition([], context())).toEqual({ x: 40, y: 40 });
  });

  it('避开已有节点占用', () => {
    const position = findFreeNodePosition([node('n1', 40, 40)], context());
    expect(position).not.toEqual({ x: 40, y: 40 });
    expect(position.x).toBeGreaterThanOrEqual(40);
    expect(position.y).toBeGreaterThanOrEqual(40);
  });

  it('当前缩放与平移时仍在可视世界坐标内', () => {
    const position = findFreeNodePosition([], context({
      viewport: { x: -100, y: -50, zoom: 2 },
      width: 800,
      height: 600,
    }));
    expect(position.x).toBeGreaterThanOrEqual(90);
    expect(position.y).toBeGreaterThanOrEqual(65);
    expect(position.x).toBeLessThan(390);
    expect(position.y).toBeLessThan(290);
  });

  it('可视区域放不下时使用回退位置', () => {
    const occupied = Array.from({ length: 100 }, (_, index) => {
      const columns = 5;
      return node(`n${index}`, 40 + (index % columns) * 164, 40 + Math.floor(index / columns) * 164);
    });
    expect(findFreeNodePosition(occupied, context())).toEqual({ x: -1, y: -1 });
  });

  it('容器尺寸无效时直接回退', () => {
    expect(findFreeNodePosition([], context({ width: 0, height: 0 }))).toEqual({ x: -1, y: -1 });
  });
});
