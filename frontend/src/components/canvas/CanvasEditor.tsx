import { Background, Controls, ReactFlow, type NodeTypes, type OnSelectionChangeParams, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button, ColorPicker, Input, Slider, Switch, Space, Typography } from 'antd';
import { useCanvasStore } from '../../stores/canvasStore';
import { CharacterNode } from './CharacterNode';
import { CanvasToolbar } from './CanvasToolbar';
import { CharacterModal } from '../modals/CharacterModal';
import { SearchPanel } from '../panels/SearchPanel';
import { ShortcutHelpModal } from '../save/ShortcutHelpModal';
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
  const reverseEdge = useCanvasStore((s) => s.reverseEdge);
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
  const [helpOpen, setHelpOpen] = useState(false);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const placeCharacter = useCallback((shape: 'circle' | 'square') => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const viewport = flowRef.current?.getViewport() ?? useCanvasStore.getState().viewport;
    addCharacter(
      shape,
      rect && rect.width > 0 && rect.height > 0
        ? { viewport, width: rect.width, height: rect.height }
        : undefined,
    );
  }, [addCharacter]);

  const editingNode = nodes.find((n) => n.id === editingNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const displayEdges = useMemo(() => toDisplayEdges(edges), [edges]);
  const search = useMemo(
    () => decorateNodesForSearch(nodes, searchOpen ? searchQuery : ''),
    [nodes, searchOpen, searchQuery],
  );

  useHotkeys(KEYMAP.undo, () => undo());
  useHotkeys(KEYMAP.redo, () => redo());
  useHotkeys(KEYMAP.newCharacter, () => placeCharacter('circle'), [placeCharacter]);
  useHotkeys(KEYMAP.search, () => setSearchOpen((open) => !open), { preventDefault: true });
  useHotkeys(KEYMAP.help, () => setHelpOpen(true), { preventDefault: true });
  useHotkeys(KEYMAP.zoomIn, () => flowRef.current?.zoomIn({ duration: 200 }), { preventDefault: true });
  useHotkeys(KEYMAP.zoomOut, () => flowRef.current?.zoomOut({ duration: 200 }), { preventDefault: true });
  useHotkeys(
    KEYMAP.reverse,
    () => {
      if (selectedEdgeId) reverseEdge(selectedEdgeId);
    },
    [selectedEdgeId],
  );
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

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const nodeIds = params.nodes.map((n) => n.id);
    setSelectedNodeIds((prev) =>
      prev.length === nodeIds.length && prev.every((id, index) => id === nodeIds[index]) ? prev : nodeIds,
    );
    const edgeId = params.edges[0]?.id ?? null;
    setSelectedEdgeId((prev) => (prev === edgeId ? prev : edgeId));
  }, []);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
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
      <CanvasToolbar onAddCharacter={placeCharacter} onOpenHelp={() => setHelpOpen(true)} />
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
          <Button size="small" block style={{ marginTop: 6 }} onClick={() => reverseEdge(selectedEdge.id)}>
            反向箭头 (R)
          </Button>
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
            <Input
              placeholder="关系类型（显示在连线上，如师徒）"
              value={String(selectedEdge.data?.type ?? '')}
              onChange={(e) => updateEdge(selectedEdge.id, { type: e.target.value })}
            />
            <Input.TextArea
              rows={2}
              placeholder="关系描述（可选）"
              value={String(selectedEdge.data?.description ?? '')}
              onChange={(e) => updateEdge(selectedEdge.id, { description: e.target.value })}
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
      <ShortcutHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
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
