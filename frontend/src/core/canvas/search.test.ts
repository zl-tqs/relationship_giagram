import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import { decorateNodesForSearch, matchNodesByName } from './search';

const node = (id: string, name: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { shape: 'circle', name, gender: '未知' },
});

const nodes = [node('n1', '张三'), node('n2', '李四'), node('n3', '张无忌')];

describe('search helpers', () => {
  it('按名称大小写不敏感匹配', () => {
    expect(matchNodesByName([node('n1', 'Alice')], 'ali').map((n) => n.id)).toEqual(['n1']);
  });

  it('空查询返回空匹配', () => {
    expect(matchNodesByName(nodes, '   ')).toEqual([]);
  });

  it('命中节点加高亮类，非命中节点降透明类', () => {
    const result = decorateNodesForSearch(nodes, '张');

    expect(result.matchedIds).toEqual(['n1', 'n3']);
    expect(result.nodes.find((n) => n.id === 'n1')?.className).toBe('search-hit');
    expect(result.nodes.find((n) => n.id === 'n2')?.className).toBe('search-dim');
  });

  it('无命中时不改变节点样式', () => {
    const result = decorateNodesForSearch(nodes, '不存在');

    expect(result.matchedIds).toEqual([]);
    expect(result.nodes).toBe(nodes);
  });

  it('不修改原始节点', () => {
    decorateNodesForSearch(nodes, '张');
    expect(nodes[0].className).toBeUndefined();
  });
});
