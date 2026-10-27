import { Button, Space } from 'antd';
import { useCanvasStore } from '../../stores/canvasStore';
import { exportPng, exportJson } from '../../core/export/exporters';

export function CanvasToolbar() {
  const addCharacter = useCanvasStore((s) => s.addCharacter);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);

  const onExportPng = () => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (el) exportPng(el);
  };

  const onExportJson = () => {
    const s = useCanvasStore.getState();
    exportJson({ nodes: s.nodes, edges: s.edges, viewport: s.viewport, version: s.version });
  };

  return (
    <Space style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
      <Button onClick={() => addCharacter('circle')}>+ 圆形角色</Button>
      <Button onClick={() => addCharacter('square')}>+ 方形角色</Button>
      <Button onClick={undo} disabled={!canUndo}>撤销</Button>
      <Button onClick={redo} disabled={!canRedo}>重做</Button>
      <Button onClick={onExportPng}>导出 PNG</Button>
      <Button onClick={onExportJson}>导出 JSON</Button>
    </Space>
  );
}
