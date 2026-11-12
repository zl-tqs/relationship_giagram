import type { Edge, Node } from '@xyflow/react';
import { normalizeCanvasState } from '../core/canvas/legacy';
import type { SnapshotDetail, SnapshotMeta } from '../types';
import { api } from './client';

export async function listSnapshots(projectId: string) {
  const { data } = await api.get<SnapshotMeta[]>(`/projects/${projectId}/snapshots`);
  return data;
}

export async function createSnapshot(
  projectId: string,
  payload: {
    name: string;
    baseRevision: number;
    nodes: Node[];
    edges: Edge[];
    viewport: { x: number; y: number; zoom: number };
    contentHash: string;
    idempotencyKey: string;
  },
) {
  const { data } = await api.post<{ revision: number; snapshot: SnapshotMeta }>(
    `/projects/${projectId}/snapshots`,
    {
      name: payload.name,
      baseRevision: payload.baseRevision,
      data: { schemaVersion: 1, nodes: payload.nodes, edges: payload.edges },
      viewport: payload.viewport,
      contentHash: payload.contentHash,
      idempotencyKey: payload.idempotencyKey,
    },
  );
  return data;
}

export async function getSnapshot(projectId: string, snapshotId: string) {
  const { data } = await api.get<SnapshotDetail>(`/projects/${projectId}/snapshots/${snapshotId}`);
  const normalized = normalizeCanvasState({
    nodes: data.data.nodes,
    edges: data.data.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    version: data.baseRevision,
  });
  return {
    ...data,
    data: { ...data.data, nodes: normalized.nodes, edges: normalized.edges },
  };
}

export async function restoreSnapshot(
  projectId: string,
  snapshotId: string,
  baseRevision: number,
) {
  const { data } = await api.post<{ revision: number; safetySnapshotId: string }>(
    `/projects/${projectId}/snapshots/${snapshotId}/restore`,
    { baseRevision },
  );
  return data;
}

export async function renameSnapshot(projectId: string, snapshotId: string, name: string) {
  const { data } = await api.patch<SnapshotMeta>(
    `/projects/${projectId}/snapshots/${snapshotId}`,
    { name },
  );
  return data;
}

export async function deleteSnapshot(projectId: string, snapshotId: string) {
  await api.delete(`/projects/${projectId}/snapshots/${snapshotId}`);
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
