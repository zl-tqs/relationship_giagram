import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { CharacterData, RelationData } from '../types';

const HISTORY_LIMIT = 100;

type HistoryEntry = { nodes: Node[]; edges: Edge[] };

interface CanvasStore {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  version: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
  addCharacter: (shape: 'circle' | 'square') => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  updateCharacter: (id: string, data: Partial<CharacterData>) => void;
  updateEdge: (id: string, data: Partial<RelationData>) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

let seq = 0;
const nextId = () => `n${++seq}`;

function commit(set: (partial: Partial<CanvasStore>) => void, get: () => CanvasStore) {
  const { nodes, edges, past } = get();
  if (past.length >= HISTORY_LIMIT) past.shift();
  set({ past: [...past, { nodes, edges }], future: [] });
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  version: 1,
  past: [],
  future: [],

  addCharacter: (shape) => {
    commit(set, get);
    const id = nextId();
    const node: Node = {
      id,
      type: 'character',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { shape, name: '新角色', gender: '未知' },
    };
    set({ nodes: [...get().nodes, node] });
  },

  removeNode: (id) => {
    commit(set, get);
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  removeEdge: (id) => {
    commit(set, get);
    set({ edges: get().edges.filter((e) => e.id !== id) });
  },

  updateCharacter: (id, data) => {
    commit(set, get);
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    });
  },

  updateEdge: (id, data) => {
    commit(set, get);
    set({
      edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...data } } : e)),
    });
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future],
      nodes: prev.nodes,
      edges: prev.edges,
    });
  },

  redo: () => {
    const { past, future } = get();
    const next = future[0];
    if (!next) return;
    set({
      future: future.slice(1),
      past: [...past, { nodes: get().nodes, edges: get().edges }],
      nodes: next.nodes,
      edges: next.edges,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
