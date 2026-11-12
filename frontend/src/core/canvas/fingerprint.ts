import type { Edge, Node } from '@xyflow/react';

const TRANSIENT_KEYS = ['selected', 'dragging', 'measured', 'width', 'height', 'resizing'];

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function compactHash(input: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash ^ BigInt(input.charCodeAt(index))) * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

function byId<T extends { id: string }>(left: T, right: T) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function canonicalNode(node: Node) {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  };
}

function canonicalEdge(edge: Edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: edge.data,
  };
}

export function canvasFingerprint(nodes: Node[], edges: Edge[]) {
  return compactHash(stableStringify({
    nodes: nodes.map(canonicalNode).sort(byId),
    edges: edges.map(canonicalEdge).sort(byId),
  }));
}

function stripTransient<T extends Record<string, unknown>>(item: T, keys: string[]): T {
  const copy = { ...item };
  for (const key of keys) delete copy[key];
  return copy;
}

export function normalizeCanvasData(nodes: Node[], edges: Edge[]) {
  return {
    schemaVersion: 1,
    nodes: nodes.map((node) => stripTransient(node as unknown as Record<string, unknown>, TRANSIENT_KEYS)),
    edges: edges.map((edge) => stripTransient(edge as unknown as Record<string, unknown>, TRANSIENT_KEYS)),
  };
}
