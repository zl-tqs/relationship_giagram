import { Background, Controls, ReactFlow, type NodeTypes, type OnSelectionChangeParams, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ColorPicker, Input, Slider, Switch, Space, Typography } from 'antd';
import { useCanvasStore } from '../../stores/canvasStore';
import { CharacterNode } from './CharacterNode';
import { CanvasToolbar } from './CanvasToolbar';
import { CharacterModal } from '../modals/CharacterModal';
import { SearchPanel } from '../panels/SearchPanel';
import { KEYMAP } from '../../core/shortcuts/keymap';
import { toDisplayEdges } from '../../core/canvas/edgeDisplay';
import { decorateNodesForSearch } from '../../core/canvas/search';
import type { CharacterData } from '../../types';

const nodeTypes: NodeTypes = { character: CharacterNode };

export function CanvasEditor() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const updateCharacter = useCanvasStore((s) => s.updateCharacter);
  const updateEdge = useCanvasStore((s) => s.updateEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const addCharacter = useCanvasStore((s) => s.addCharacter);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const clearSelection = useCanvasStore((s) => s.clearSelection);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const editingNode = nodes.find((n) => n.id === editingNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const displayEdges = useMemo(() => toDisplayEdges(edges), [edges]);
  const search = useMemo(
    () => decorateNodesForSearch(nodes, searchOpen ? searchQuery : ''),
    [nodes, searchOpen, searchQuery],
  );

  useHotkeys(KEYMAP.undo, () => undo());
  useHotkeys(KEYMAP.redo, () => redo());
  useHotkeys(KEYMAP.newCharacter, () => addCharacter('circle'));
  useHotkeys(KEYMAP.search, () => setSearchOpen((open) => !open), { preventDefault: true });
  useHotkeys(KEYMAP.zoomIn, () => flowRef.current?.zoomIn({ duration: 200 }), { preventDefault: true });
  useHotkeys(KEYMAP.zoomOut, () => flowRef.current?.zoomOut({ duration: 200 }), { preventDefault: true });
  useHotkeys(
    KEYMAP.selectAll,
    () => {
      const state = useCanvasStore.getState();
      state.selectAll();
      setSelectedNodeIds(state.nodes.map((node) => node.id));
      setSelectedEdgeId(state.edges[0]?.id ?? null);
    },
    { preventDefault: true },
  );
  useHotkeys(
    KEYMAP.cancel,
    () => {
      setSearchOpen(false);
      setSearchQuery('');
      setEditingNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      clearSelection();
    },
    { enableOnFormTags: true },
  );
  useHotkeys(
    KEYMAP.delete,
    () => {
      selectedNodeIds.forEach(removeNode);
      if (selectedEdgeId) removeEdge(selectedEdgeId);
    },
    [selectedNodeIds, selectedEdgeId],
  );

  const onSelectionChange = (params: OnSelectionChangeParams) => {
    setSelectedNodeIds(params.nodes.map((n) => n.id));
    setSelectedEdgeId(params.edges[0]?.id ?? null);
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={search.nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={(_, node) => setEditingNodeId(node.id)}
        onSelectionChange={onSelectionChange}
        onConnect={(c) => {
          const id = `e${Date.now()}`;
          addEdge({
            id,
            source: c.source ?? '',
            target: c.target ?? '',
            data: { color: '#333', width: 2, arrow: true },
          });
          setSelectedEdgeId(id);
        }}
        deleteKeyCode={null}
      >
        <Background />
        <Controls />
      </ReactFlow>
      <CanvasToolbar />
      <SearchPanel
        open={searchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={() => {
          setSearchOpen(false);
          setSearchQuery('');
        }}
        onSelect={(id) => {
          const target = nodes.find((node) => node.id === id);
          if (target) flowRef.current?.fitView({ nodes: [target], duration: 400, maxZoom: 1.6 });
        }}
      />
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
              placeholder="关系类型（显示在连线上，如师徒）"
              value={String(selectedEdge.data?.type ?? '')}
              onChange={(e) => updateEdge(selectedEdge.id, { type: e.target.value })}
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
