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
