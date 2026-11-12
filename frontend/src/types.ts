import type { Node, Edge } from '@xyflow/react';

export type CharacterData = {
  shape: 'circle' | 'square';
  name: string;
  gender: string;
  intro?: string;
};

export type RelationData = {
  type?: string;
  color: string;
  width: number;
  arrow: boolean;
};

export type CanvasState = {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  version: number;
};

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  lastModifiedAt: string;
}

export interface SnapshotMeta {
  id: string;
  name: string;
  type: 'manual' | 'safety';
  baseRevision: number;
  contentHash: string | null;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
}

export interface SnapshotDetail extends SnapshotMeta {
  data: {
    schemaVersion: number;
    nodes: Node[];
    edges: Edge[];
  };
}
