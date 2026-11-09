import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { normalizeCanvasState } from '../canvas/legacy';
import type { CanvasState } from '../../types';

export const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function saveLocal(state: CanvasState) {
  if (isDesktop()) {
    const path = await save({ filters: [{ name: '关系图', extensions: ['rmap'] }] });
    if (!path) return;
    await writeTextFile(path, JSON.stringify(state, null, 2));
  } else {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '关系图.rmap';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

export async function loadLocal(): Promise<CanvasState | null> {
  if (!isDesktop()) return null;
  const selected = await open({ filters: [{ name: '关系图', extensions: ['rmap'] }] });
  if (!selected) return null;
  const path = Array.isArray(selected) ? selected[0] : selected;
  return normalizeCanvasState(JSON.parse(await readTextFile(path)) as CanvasState);
}
