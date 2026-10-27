import { Button, Space, message } from 'antd';
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { CanvasEditor } from '../components/canvas/CanvasEditor';
import { useCanvasStore } from '../stores/canvasStore';
import { loadCanvas, saveCanvas } from '../api/canvas';
import { toApiError } from '../api/client';

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!projectId) return;
    loadCanvas(projectId)
      .then((c) =>
        useCanvasStore.setState({ nodes: c.nodes, edges: c.edges, viewport: c.viewport, version: c.version }),
      )
      .catch(() => message.error('加载画布失败'));

    timer.current = window.setInterval(() => {
      const s = useCanvasStore.getState();
      saveCanvas(projectId, { nodes: s.nodes, edges: s.edges, viewport: s.viewport, version: s.version })
        .then((r) => useCanvasStore.setState({ version: r.version }))
        .catch((e) => {
          if (toApiError(e).code === 'VERSION_CONFLICT') message.warning('画布已在其他端修改，请刷新');
          else message.error('自动保存失败');
        });
    }, 3 * 60 * 1000);

    return () => clearInterval(timer.current);
  }, [projectId]);

  const onSave = async () => {
    if (!projectId) return;
    const s = useCanvasStore.getState();
    try {
      const r = await saveCanvas(projectId, {
        nodes: s.nodes,
        edges: s.edges,
        viewport: s.viewport,
        version: s.version,
      });
      useCanvasStore.setState({ version: r.version });
      message.success('已保存');
    } catch (e) {
      message.error(toApiError(e).message);
    }
  };

  return (
    <AppLayout>
      <CanvasEditor />
      <Space style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        <Button onClick={onSave}>保存</Button>
      </Space>
    </AppLayout>
  );
}
