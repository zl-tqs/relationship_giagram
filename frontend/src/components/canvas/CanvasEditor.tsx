import { Background, Controls, ReactFlow, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useState } from 'react';
import { ColorPicker, Input, Slider, Switch, Space, Typography } from 'antd';
import { useCanvasStore } from '../../stores/canvasStore';
import { CharacterNode } from './CharacterNode';
import { CanvasToolbar } from './CanvasToolbar';
import { CharacterModal } from '../modals/CharacterModal';
import type { CharacterData } from '../../types';

const nodeTypes: NodeTypes = { character: CharacterNode };

export function CanvasEditor() {
  const { nodes, edges, viewport, onNodesChange, onEdgesChange, updateCharacter, updateEdge } = useCanvasStore();
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const editingNode = nodes.find((n) => n.id === editingNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={(_, node) => setEditingNodeId(node.id)}
        onSelectionChange={(params) => setSelectedEdgeId(params.edges[0]?.id ?? null)}
        onConnect={(c) => {
          const id = `e${Date.now()}`;
          useCanvasStore.setState((s) => ({
            edges: [
              ...s.edges,
              { id, source: c.source ?? '', target: c.target ?? '', data: { color: '#333', width: 2, arrow: true } },
            ],
          }));
          setSelectedEdgeId(id);
        }}
        deleteKeyCode={null}
      >
        <Background />
        <Controls />
      </ReactFlow>
      <CanvasToolbar />
      {selectedEdge && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 8,
            width: 220,
            zIndex: 10,
            background: '#fff',
            padding: 12,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
          }}
        >
          <Typography.Text strong>关系样式</Typography.Text>
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
            <Input
              placeholder="关系类型（如师徒）"
              value={String(selectedEdge.data?.type ?? '')}
              onChange={(e) => updateEdge(selectedEdge.id, { type: e.target.value })}
            />
            <Input
              placeholder="标注文字"
              value={String(selectedEdge.data?.label ?? '')}
              onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value })}
            />
            <div>
              颜色{' '}
              <ColorPicker
                value={String(selectedEdge.data?.color ?? '#333')}
                onChange={(c) => updateEdge(selectedEdge.id, { color: c.toHexString() })}
              />
            </div>
            <div>
              粗细{' '}
              <Slider
                min={1}
                max={8}
                style={{ width: 140, marginLeft: 8 }}
                value={Number(selectedEdge.data?.width ?? 2)}
                onChange={(v) => updateEdge(selectedEdge.id, { width: v })}
              />
            </div>
            <div>
              箭头{' '}
              <Switch
                checked={Boolean(selectedEdge.data?.arrow)}
                onChange={(checked) => updateEdge(selectedEdge.id, { arrow: checked })}
              />
            </div>
          </Space>
        </div>
      )}
      <CharacterModal
        open={!!editingNode}
        initial={editingNode ? (editingNode.data as unknown as CharacterData) : undefined}
        onClose={() => setEditingNodeId(null)}
        onSubmit={(data) => {
          if (editingNodeId) updateCharacter(editingNodeId, data);
        }}
      />
    </div>
  );
}
