import { toPng } from 'html-to-image';
import type { CanvasState } from '../../types';

export async function exportPng(el: HTMLElement, filename = '关系图.png') {
  const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff' });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function exportJson(state: CanvasState, filename = '关系图.json') {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
