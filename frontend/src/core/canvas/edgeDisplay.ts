import { MarkerType, type Edge } from '@xyflow/react';
import type { RelationData } from '../../types';

export function toDisplayEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    const data = (edge.data ?? {}) as unknown as Partial<RelationData>;
    const color = data.color ?? '#333';
    const width = data.width ?? 2;
    return {
      ...edge,
      label: data.type,
      style: { stroke: color, strokeWidth: width },
      labelStyle: { fill: color, fontSize: 12 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
      markerEnd: data.arrow ? { type: MarkerType.ArrowClosed, color } : undefined,
    };
  });
}
