import { Button, Card, Empty, List, Typography, message } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { toApiError } from '../api/client';

export function HomePage() {
  const recent = useProjectStore((s) => s.recent);
  const loading = useProjectStore((s) => s.loading);
  const loadRecent = useProjectStore((s) => s.loadRecent);
  const create = useProjectStore((s) => s.create);
  const navigate = useNavigate();

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

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>小说人物关系图工具</Typography.Title>
        <Button type="primary" onClick={onCreate}>新建项目</Button>
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
                ]}
              >
                <List.Item.Meta title={item.name} description={new Date(item.lastModifiedAt).toLocaleString()} />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
