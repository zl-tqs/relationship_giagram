import { Button, List, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';

export function AppLayout({ children }: { children: ReactNode }) {
  const recent = useProjectStore((s) => s.recent);
  const loadRecent = useProjectStore((s) => s.loadRecent);
  const create = useProjectStore((s) => s.create);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const onCreate = async () => {
    const p = await create('未命名项目');
    navigate(`/project/${p.id}`);
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
        <Button type="primary" block onClick={onCreate}>
          新建文件
        </Button>
        <Button block onClick={loadRecent} style={{ marginTop: 8 }}>
          打开文件
        </Button>
        <List
          size="small"
          style={{ marginTop: 8, flex: 1, overflow: 'auto' }}
          dataSource={recent}
          renderItem={(item) => (
            <List.Item onClick={() => navigate(`/project/${item.id}`)} style={{ cursor: 'pointer' }}>
              {item.name}
            </List.Item>
          )}
        />
        <Button
          block
          type="text"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          退出登录
        </Button>
      </aside>
      <main style={{ flex: 1, position: 'relative' }}>{children}</main>
    </div>
  );
}
