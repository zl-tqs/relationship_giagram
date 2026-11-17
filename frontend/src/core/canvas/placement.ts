import type { Node } from '@xyflow/react';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface PlacementContext {
  viewport: CanvasViewport;
  width: number;
  height: number;
  margin?: number;
  nodeSize?: number;
  gap?: number;
  fallback?: () => { x: number; y: number };
}

const DEFAULT_MARGIN = 40;
const DEFAULT_NODE_SIZE = 140;
const DEFAULT_GAP = 24;

function randomPosition() {
  return { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 };
}

function nodeFootprint(node: Node, fallbackSize: number) {
  const width = node.measured?.width ?? node.width ?? fallbackSize;
  const height = node.measured?.height ?? node.height ?? fallbackSize;
  return { width, height };
}

function overlaps(
  position: { x: number; y: number },
  size: number,
  node: Node,
  fallbackSize: number,
  gap: number,
) {
  const footprint = nodeFootprint(node, fallbackSize);
  return !(
    position.x + size + gap <= node.position.x
    || node.position.x + footprint.width + gap <= position.x
    || position.y + size + gap <= node.position.y
    || node.position.y + footprint.height + gap <= position.y
  );
}

export function findFreeNodePosition(nodes: Node[], context: PlacementContext) {
  const fallback = context.fallback ?? randomPosition;
  const zoom = context.viewport.zoom > 0 ? context.viewport.zoom : 1;
  const margin = context.margin ?? DEFAULT_MARGIN;
  const nodeSize = context.nodeSize ?? DEFAULT_NODE_SIZE;
  const gap = context.gap ?? DEFAULT_GAP;
  if (context.width <= 0 || context.height <= 0) return fallback();

  const left = (0 - context.viewport.x) / zoom + margin;
  const top = (0 - context.viewport.y) / zoom + margin;
  const right = (context.width - context.viewport.x) / zoom - margin;
  const bottom = (context.height - context.viewport.y) / zoom - margin;
  if (right - left < nodeSize || bottom - top < nodeSize) return fallback();

  const step = nodeSize + gap;
  const columns = Math.floor((right - left - nodeSize) / step) + 1;
  const rows = Math.floor((bottom - top - nodeSize) / step) + 1;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const position = { x: left + column * step, y: top + row * step };
      if (!nodes.some((node) => overlaps(position, nodeSize, node, nodeSize, gap))) {
        return position;
      }
    }
  }

  return fallback();
}
