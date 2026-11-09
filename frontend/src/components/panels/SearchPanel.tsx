import { Button, Input, List, Space, Typography } from 'antd';
import { useMemo } from 'react';
import { matchNodesByName } from '../../core/canvas/search';
import { useCanvasStore } from '../../stores/canvasStore';

interface SearchPanelProps {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
}

export function SearchPanel({ open, query, onQueryChange, onClose, onSelect }: SearchPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const hits = useMemo(() => matchNodesByName(nodes, query), [nodes, query]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 320,
        zIndex: 11,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
        padding: 8,
      }}
    >
      <Space.Compact style={{ width: '100%' }}>
        <Input
          autoFocus
          placeholder="搜索角色名"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          allowClear
        />
        <Button onClick={onClose}>关闭</Button>
      </Space.Compact>
      {query.trim() && (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
            {hits.length} 个匹配
          </Typography.Text>
          <List
            size="small"
            dataSource={hits}
            locale={{ emptyText: '无匹配角色' }}
            renderItem={(node) => (
              <List.Item style={{ cursor: 'pointer' }} onClick={() => onSelect(node.id)}>
                {String(node.data?.name)}
              </List.Item>
            )}
          />
        </>
      )}
    </div>
  );
}
