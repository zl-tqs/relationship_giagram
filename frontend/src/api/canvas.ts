import { api } from './client.js';
import { normalizeCanvasState } from '../core/canvas/legacy.js';
import type { CanvasState } from '../types.js';

export async function loadCanvas(projectId: string) {
  const { data } = await api.get<CanvasState>(`/projects/${projectId}/canvas`);
  return normalizeCanvasState(data);
}

export async function saveCanvas(projectId: string, state: CanvasState) {
  const { data } = await api.put<{ id: string; version: number }>(`/projects/${projectId}/canvas`, {
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    baseVersion: state.version,
  });
  return data;
}
