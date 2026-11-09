import type { Node } from '@xyflow/react';

function nameOf(node: Node) {
  return String((node.data as { name?: unknown } | undefined)?.name ?? '').toLowerCase();
}

export function matchNodesByName(nodes: Node[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return nodes.filter((node) => nameOf(node).includes(q));
}

export function decorateNodesForSearch(nodes: Node[], query: string) {
  const matches = matchNodesByName(nodes, query);
  if (!query.trim() || matches.length === 0) {
    return { nodes, matchedIds: [] as string[] };
  }
  const matched = new Set(matches.map((node) => node.id));
  return {
    nodes: nodes.map((node) => {
      const base = node.className ? `${node.className} ` : '';
      return { ...node, className: `${base}${matched.has(node.id) ? 'search-hit' : 'search-dim'}` };
    }),
    matchedIds: [...matched],
  };
}
