import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../stores/canvasStore';

describe('canvasStore', () => {
  beforeEach(() =>
    useCanvasStore.setState({ nodes: [], edges: [], past: [], future: [], version: 1 }),
  );

  it('addCharacter 后可撤销、可重做', () => {
    const { addCharacter, undo, redo } = useCanvasStore.getState();
    addCharacter('circle');
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
    undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    redo();
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
  });

  it('removeNode 级联删除关联边', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { shape: 'circle', name: 'A', gender: '男' } }],
      edges: [{ id: 'e1', source: 'a', target: 'b', data: { color: '#333', width: 2, arrow: true } }],
    });
    useCanvasStore.getState().removeNode('a');
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });
});
