import type { Edge, Node } from '@xyflow/react';
import type { CanvasState } from '../../types';
import type { AnalysisResult } from './types';

const COLUMN_GAP = 240;
const ROW_GAP = 180;

export function buildCanvasFromAnalysis(result: AnalysisResult, confirmedNames: string[]): CanvasState {
  const names = [...new Set(confirmedNames.map((name) => name.trim()).filter(Boolean))];
  const infoByName = new Map(result.characters.map((character) => [character.name, character]));
  const columns = Math.max(1, Math.ceil(Math.sqrt(names.length)));
  const idByName = new Map<string, string>();

  const nodes: Node[] = names.map((name, index) => {
    const id = `n${index + 1}`;
    idByName.set(name, id);
    const info = infoByName.get(name);
    return {
      id,
      type: 'character',
      position: {
        x: (index % columns) * COLUMN_GAP,
        y: Math.floor(index / columns) * ROW_GAP,
      },
      data: {
        shape: 'circle',
        name,
        gender: info?.gender?.trim() || '未知',
        intro: info?.description?.trim() || undefined,
      },
    };
  });

  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const relation of result.relations) {
    const source = idByName.get(relation.from);
    const target = idByName.get(relation.to);
    if (!source || !target || source === target) continue;
    const type = relation.type?.trim() || '关系';
    const key = `${source}|${target}|${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      id: `e${edges.length + 1}`,
      source,
      target,
      data: {
        type,
        description: relation.description?.trim() || undefined,
        color: '#333',
        width: 2,
        arrow: true,
      },
    });
  }

  return { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 }, version: 1 };
}
