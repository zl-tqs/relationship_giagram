import { Button, Card, Empty, List, Modal, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { toApiError } from '../api/client';
import { ProjectRenameModal } from '../components/projects/ProjectRenameModal';
import { ImportProjectButton } from '../components/projects/ImportProjectButton';
import type { ProjectSummary } from '../types';

export function HomePage() {
  const recent = useProjectStore((s) => s.recent);
  const loading = useProjectStore((s) => s.loading);
  const loadRecent = useProjectStore((s) => s.loadRecent);
  const create = useProjectStore((s) => s.create);
  const update = useProjectStore((s) => s.update);
  const remove = useProjectStore((s) => s.remove);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    loadRecent().catch(() => message.error('加载项目列表失败，请确认后端已启动'));
  }, [loadRecent]);

  const onCreate = async () => {
    try {
      const project = await create('未命名项目');
      navigate(`/project/${project.id}`);
    } catch (e) {
      message.error(toApiError(e).message);
    }
  };

  const onLogout = () => {
    logout();
    window.location.assign('/login');
  };

  const onRename = async (name: string) => {
    if (!renameTarget) return;
    try {
      await update(renameTarget.id, name);
      setRenameTarget(null);
      message.success('已重命名');
    } catch (e) {
      message.error(toApiError(e).message);
    }
  };

  const onDelete = (item: ProjectSummary) => {
    Modal.confirm({
      title: '删除项目',
      content: `确定删除「${item.name}」吗？该操作不可撤销。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove(item.id);
          message.success('已删除');
        } catch (e) {
          message.error(toApiError(e).message);
        }
      },
    });
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>小说人物关系图工具</Typography.Title>
        <Space>
          <Typography.Text type="secondary">{user?.nickname ?? '访客'}</Typography.Text>
          <ImportProjectButton />
          <Button onClick={() => navigate('/analysis')}>AI 提取小说</Button>
          <Button onClick={onLogout}>退出登录</Button>
          <Button type="primary" onClick={onCreate}>新建项目</Button>
        </Space>
      </div>
      <Card title="最近打开" style={{ marginTop: 16 }}>
        {recent.length === 0 && !loading ? (
          <Empty description="还没有项目，点击右上角新建" />
        ) : (
          <List
            loading={loading}
            dataSource={recent}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="open" type="link" onClick={() => navigate(`/project/${item.id}`)}>
                    打开
                  </Button>,
                  <Button key="rename" type="link" onClick={() => setRenameTarget(item)}>
                    重命名
                  </Button>,
                  <Button key="delete" type="link" danger onClick={() => onDelete(item)}>
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta title={item.name} description={new Date(item.lastModifiedAt).toLocaleString()} />
              </List.Item>
            )}
          />
        )}
      </Card>
      <ProjectRenameModal
        open={!!renameTarget}
        initialName={renameTarget?.name ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSubmit={onRename}
      />
    </div>
  );
}
