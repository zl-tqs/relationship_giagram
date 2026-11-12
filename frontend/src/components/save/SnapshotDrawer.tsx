import { Button, Drawer, Empty, List, Tag, Typography } from 'antd';
import type { SnapshotMeta } from '../../types';

interface Props {
  open: boolean;
  snapshots: SnapshotMeta[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRestore: (snapshot: SnapshotMeta) => void;
  onDelete: (snapshot: SnapshotMeta) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SnapshotDrawer({
  open,
  snapshots,
  loading,
  onClose,
  onRefresh,
  onRestore,
  onDelete,
}: Props) {
  return (
    <Drawer
      open={open}
      title="版本历史"
      width={380}
      onClose={onClose}
      extra={<Button size="small" onClick={onRefresh} loading={loading}>刷新</Button>}
    >
      {snapshots.length === 0 && !loading ? (
        <Empty description="还没有手动快照" />
      ) : (
        <List
          loading={loading}
          dataSource={snapshots}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="restore" type="link" size="small" onClick={() => onRestore(item)}>
                  恢复
                </Button>,
                <Button key="delete" type="link" size="small" danger onClick={() => onDelete(item)}>
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    {item.name} <Tag>{formatSize(item.sizeBytes)}</Tag>
                  </span>
                }
                description={new Date(item.createdAt).toLocaleString()}
              />
            </List.Item>
          )}
        />
      )}
      <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
        手动快照不会被系统自动清理。恢复前会自动生成一个安全快照，可通过撤销返回恢复前状态。
      </Typography.Paragraph>
    </Drawer>
  );
}
