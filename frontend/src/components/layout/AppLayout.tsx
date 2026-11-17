import { Button, List, Modal, Space, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { toApiError } from '../../api/client';
import { pickNextProjectAfterDelete } from '../../core/projects/navigation';
import { deleteDraft } from '../../core/save/drafts';
import {
  clearManualSaved,
  clearOriginalFileName,
  clearProjectCreatedThisSession,
} from '../../core/save/flags';
import { ProjectRenameModal } from '../projects/ProjectRenameModal';
import { ImportProjectButton } from '../projects/ImportProjectButton';
import type { ProjectSummary } from '../../types';

export function AppLayout({ children }: { children: ReactNode }) {
  const recent = useProjectStore((s) => s.recent);
  const loadRecent = useProjectStore((s) => s.loadRecent);
  const create = useProjectStore((s) => s.create);
  const update = useProjectStore((s) => s.update);
  const remove = useProjectStore((s) => s.remove);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const requestLeave = useWorkspaceStore((s) => s.requestLeave);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const current = recent.find((item) => item.id === projectId);

  useEffect(() => {
    loadRecent().catch(() => message.error('加载项目列表失败，请确认后端已启动'));
  }, [loadRecent]);

  const onCreate = () => {
    requestLeave(() => {
      void (async () => {
        try {
          const p = await create('未命名项目');
          navigate(`/project/${p.id}`);
        } catch (e) {
          message.error(toApiError(e).message);
        }
      })();
    });
  };

  const onLogout = () => {
    requestLeave(() => {
      logout();
      window.location.assign('/login');
    });
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
          const next = pickNextProjectAfterDelete(recent, item.id, projectId);
          await remove(item.id);
          await deleteDraft(user?.id ?? 'anonymous', item.id);
          clearManualSaved(item.id);
          clearOriginalFileName(item.id);
          clearProjectCreatedThisSession(item.id);
          message.success('已删除');
          if (item.id === projectId) {
            if (next) {
              window.location.assign(`/project/${next.id}`);
            } else {
              const created = await create('未命名项目');
              window.location.assign(`/project/${created.id}`);
            }
          }
        } catch (e) {
          message.error(toApiError(e).message);
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 220,
          borderRight: '1px solid #eee',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography.Title level={5}>项目</Typography.Title>
        <Typography.Text type="secondary" style={{ marginBottom: 8 }}>
          当前账号：{user?.nickname ?? '访客'}
        </Typography.Text>
        {current && (
          <Typography.Text strong style={{ marginBottom: 8 }}>
            当前项目：{current.name}
          </Typography.Text>
        )}
        <Button type="primary" block onClick={onCreate}>
          新建文件
        </Button>
        <Button block onClick={() => requestLeave(() => navigate('/'))} style={{ marginTop: 8 }}>
          返回主界面
        </Button>
        <div style={{ marginTop: 8 }}>
          <ImportProjectButton block />
        </div>
        <Button
          block
          style={{ marginTop: 8 }}
          onClick={() => requestLeave(() => navigate('/analysis'))}
        >
          AI 提取小说
        </Button>
        <List
          size="small"
          style={{ marginTop: 8, flex: 1, overflow: 'auto' }}
          dataSource={recent}
          renderItem={(item) => (
            <List.Item
              onClick={() => requestLeave(() => navigate(`/project/${item.id}`))}
              style={{ cursor: 'pointer', paddingInline: 0 }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
              <Space size={0}>
                <Button
                  type="link"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget(item);
                  }}
                >
                  改名
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                >
                  删除
                </Button>
              </Space>
            </List.Item>
          )}
        />
        <Button block type="text" onClick={onLogout}>
          退出登录
        </Button>
      </aside>
      <main style={{ flex: 1, position: 'relative' }}>{children}</main>
      <ProjectRenameModal
        open={!!renameTarget}
        initialName={renameTarget?.name ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSubmit={onRename}
      />
    </div>
  );
}
