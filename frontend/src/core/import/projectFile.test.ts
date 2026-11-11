import { describe, it, expect } from 'vitest';
import { parseProjectFile } from './projectFile';

const edge = (data: Record<string, unknown>) => ({
  id: 'e1',
  source: 'n1',
  target: 'n2',
  data,
});

describe('parseProjectFile', () => {
  it('解析当前导出的 CanvasState 并按文件名命名', () => {
    const text = JSON.stringify({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { name: 'A' } }],
      edges: [edge({ label: '旧标注', color: '#333', width: 2, arrow: true })],
      viewport: { x: 10, y: 20, zoom: 0.8 },
      version: 7,
    });

    const result = parseProjectFile('三国.json', text);

    expect(result.name).toBe('三国');
    expect(result.state.version).toBe(1);
    expect(result.state.edges[0].data).toMatchObject({ type: '旧标注' });
    expect(result.state.edges[0].data).not.toHaveProperty('label');
  });

  it('解析 .rmap 包装格式并优先使用项目名', () => {
    const text = JSON.stringify({
      format: 'rmap',
      version: 1,
      project: { name: '示例项目' },
      canvases: [
        {
          nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { name: 'A' } }],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      ],
    });

    const result = parseProjectFile('backup.rmap', text);

    expect(result.name).toBe('示例项目');
    expect(result.state.nodes).toHaveLength(1);
    expect(result.state.version).toBe(1);
  });

  it('无法识别时抛出中文错误', () => {
    expect(() => parseProjectFile('bad.json', '{"foo":1}')).toThrow('无法识别的项目文件');
  });
});
