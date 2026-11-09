import type { Edge } from '@xyflow/react';
import type { CanvasState } from '../../types';

type LegacyEdgeData = Record<string, unknown> & { type?: unknown; label?: unknown };

function normalizeEdge(edge: Edge): Edge {
  const data = edge.data as LegacyEdgeData | undefined;
  if (!data || typeof data !== 'object') return edge;

  const type = typeof data.type === 'string' ? data.type : '';
  const label = typeof data.label === 'string' ? data.label : '';
  if (!type && !label) return edge;
  if (type && !('label' in data)) return edge;

  const nextData = { ...data };
  delete nextData.label;
  if (!type) nextData.type = label;
  return { ...edge, data: nextData };
}

export function normalizeCanvasState(state: CanvasState): CanvasState {
  return { ...state, edges: state.edges.map(normalizeEdge) };
}
