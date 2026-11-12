import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { canvasFingerprint, normalizeCanvasData } from './fingerprint';

const node = (id: string, name: string): Node => ({
  id,
  type: 'character',
  position: { x: 10, y: 20 },
  data: { shape: 'circle', name, gender: '未知' },
});

const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  data: { color: '#333', width: 2, arrow: true },
});

describe('canvasFingerprint', () => {
  it('指纹是紧凑的十六进制字符串', () => {
    expect(canvasFingerprint([], [])).toMatch(/^[0-9a-f]{16}$/);
    expect(canvasFingerprint([node('a', '甲')], [])).toMatch(/^[0-9a-f]{16}$/);
  });

  it('节点与连线顺序变化不影响指纹', () => {
    const nodes = [node('a', '甲'), node('b', '乙')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];

    expect(canvasFingerprint(nodes, edges)).toBe(
      canvasFingerprint([...nodes].reverse(), [...edges].reverse()),
    );
  });

  it('忽略选中、拖动、测量、尺寸等瞬态字段', () => {
    const plain = [node('a', '甲')];
    const transient = [
      {
        ...node('a', '甲'),
        selected: true,
        dragging: true,
        measured: { width: 100, height: 60 },
        width: 100,
        height: 60,
      },
    ];
    const edgePlain = [edge('e1', 'a', 'b')];
    const edgeTransient = [{ ...edge('e1', 'a', 'b'), selected: true }];

    expect(canvasFingerprint(transient, edgeTransient)).toBe(
      canvasFingerprint(plain, edgePlain),
    );
  });

  it('业务内容变化会改变指纹', () => {
    const before = canvasFingerprint([node('a', '甲')], [edge('e1', 'a', 'b')]);
    const afterName = canvasFingerprint([node('a', '乙')], [edge('e1', 'a', 'b')]);
    const afterEdge = canvasFingerprint([node('a', '甲')], [edge('e2', 'a', 'b')]);

    expect(afterName).not.toBe(before);
    expect(afterEdge).not.toBe(before);
  });

  it('data 字段键顺序变化不影响指纹', () => {
    const first: Node = {
      id: 'a',
      type: 'character',
      position: { x: 0, y: 0 },
      data: { name: '甲', shape: 'circle' },
    };
    const second: Node = {
      id: 'a',
      type: 'character',
      position: { x: 0, y: 0 },
      data: { shape: 'circle', name: '甲' },
    };

    expect(canvasFingerprint([first], [])).toBe(canvasFingerprint([second], []));
  });
});

describe('normalizeCanvasData', () => {
  it('去除瞬态字段并生成快照数据', () => {
    const result = normalizeCanvasData(
      [{ ...node('a', '甲'), selected: true, width: 100, height: 60 } as Node],
      [{ ...edge('e1', 'a', 'b'), selected: true } as Edge],
    );

    expect(result.schemaVersion).toBe(1);
    expect(result.nodes[0]).toMatchObject({ id: 'a', type: 'character' });
    expect(result.nodes[0]).not.toHaveProperty('selected');
    expect(result.nodes[0]).not.toHaveProperty('width');
    expect(result.edges[0]).not.toHaveProperty('selected');
  });
});
