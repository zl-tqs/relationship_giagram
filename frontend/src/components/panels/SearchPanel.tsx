import { Input, List } from 'antd';
import { useMemo, useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';

export function SearchPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const [q, setQ] = useState('');

  const hits = useMemo(
    () => nodes.filter((n) => String(n.data?.name ?? '').toLowerCase().includes(q.toLowerCase())),
    [nodes, q],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 8,
        width: 240,
        zIndex: 10,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
        padding: 8,
      }}
    >
      <Input placeholder="搜索角色名" value={q} onChange={(e) => setQ(e.target.value)} allowClear />
      {q && (
        <List
          size="small"
          dataSource={hits}
          renderItem={(n) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const el = document.querySelector(`[data-id="${n.id}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
              }}
            >
              {String(n.data?.name)}
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
