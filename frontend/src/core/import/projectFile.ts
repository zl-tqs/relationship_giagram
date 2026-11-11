import type { Edge, Node } from '@xyflow/react';
import { normalizeCanvasState } from '../canvas/legacy';
import type { CanvasState } from '../../types';

export interface ImportedProject {
  name: string;
  state: CanvasState;
}

type RawCanvas = {
  nodes?: unknown;
  edges?: unknown;
  viewport?: unknown;
};

type RawProjectFile = RawCanvas & {
  project?: { name?: unknown };
  canvases?: RawCanvas[];
};

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

function fileStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || '导入项目';
}

function viewportOf(value: unknown): CanvasState['viewport'] {
  if (!value || typeof value !== 'object') return DEFAULT_VIEWPORT;
  const v = value as Partial<CanvasState['viewport']>;
  if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.zoom !== 'number') {
    return DEFAULT_VIEWPORT;
  }
  return { x: v.x, y: v.y, zoom: v.zoom };
}

export function parseProjectFile(fileName: string, text: string): ImportedProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('项目文件不是有效的 JSON');
  }
  if (!raw || typeof raw !== 'object') throw new Error('无法识别的项目文件');

  const json = raw as RawProjectFile;
  const wrapped = Array.isArray(json.canvases) ? json.canvases[0] : undefined;
  const source = wrapped ?? json;
  if (!source || !Array.isArray(source.nodes) || !Array.isArray(source.edges)) {
    throw new Error('无法识别的项目文件');
  }

  const projectName =
    typeof json.project?.name === 'string' && json.project.name.trim()
      ? json.project.name.trim()
      : fileStem(fileName);

  const state = normalizeCanvasState({
    nodes: source.nodes as Node[],
    edges: source.edges as Edge[],
    viewport: viewportOf(source.viewport),
    version: 1,
  });

  return { name: projectName, state };
}
