export interface CharacterData {
  shape: 'circle' | 'square';
  name: string;
  gender: string;
  intro?: string;
}

export interface RelationData {
  type?: string;
  label?: string;
  color: string;
  width: number;
  arrow: boolean;
}

export interface CanvasState {
  nodes: { id: string; type: string; position: { x: number; y: number }; data: CharacterData | Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; label?: string; data?: RelationData }[];
  viewport: { x: number; y: number; zoom: number };
  version: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  lastModifiedAt: string;
}
