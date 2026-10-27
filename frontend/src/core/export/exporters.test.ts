import { describe, it, expect, vi } from 'vitest';
import { exportJson } from './exporters';

describe('exportJson', () => {
  it('触发下载（创建 a 元素并点击）', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    exportJson({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, version: 1 });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
