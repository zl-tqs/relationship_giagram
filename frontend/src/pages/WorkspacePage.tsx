import { Button, Input, Modal, Space, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { CanvasEditor } from '../components/canvas/CanvasEditor';
import { useCanvasStore } from '../stores/canvasStore';
import { useProjectStore } from '../stores/projectStore';
import { loadCanvas, saveCanvas } from '../api/canvas';
import { toApiError } from '../api/client';
import { KEYMAP } from '../core/shortcuts/keymap';

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const create = useProjectStore((s) => s.create);
  const timer = useRef<number | undefined>(undefined);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('未命名项目');

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

  const onSaveAs = async () => {
    const name = saveAsName.trim();
    if (!name) {
      message.warning('请输入项目名称');
      return;
    }
    try {
      const project = await create(name);
      const s = useCanvasStore.getState();
      await saveCanvas(project.id, {
        nodes: s.nodes,
        edges: s.edges,
        viewport: s.viewport,
        version: 1,
      });
      setSaveAsOpen(false);
      setSaveAsName('未命名项目');
      message.success('已另存为新项目');
      navigate(`/project/${project.id}`);
    } catch (e) {
      message.error(toApiError(e).message);
    }
  };

  useHotkeys(KEYMAP.save, () => void onSave(), { preventDefault: true }, [projectId]);
  useHotkeys(KEYMAP.saveAs, () => setSaveAsOpen(true), { preventDefault: true });

  return (
    <AppLayout>
      <CanvasEditor />
      <Space style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        <Button onClick={onSave}>保存</Button>
        <Button onClick={() => setSaveAsOpen(true)}>另存为</Button>
      </Space>
      <Modal
        open={saveAsOpen}
        title="另存为"
        okText="保存"
        cancelText="取消"
        onOk={onSaveAs}
        onCancel={() => setSaveAsOpen(false)}
      >
        <Input
          placeholder="项目名称"
          value={saveAsName}
          onChange={(e) => setSaveAsName(e.target.value)}
          onPressEnter={onSaveAs}
        />
      </Modal>
    </AppLayout>
  );
}
