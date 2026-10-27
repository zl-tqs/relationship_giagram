import { Background, Controls, ReactFlow, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '../../stores/canvasStore';
import { CharacterNode } from './CharacterNode';

const nodeTypes: NodeTypes = { character: CharacterNode };

export function CanvasEditor() {
  const { nodes, edges, viewport, addCharacter, onNodesChange, onEdgesChange } = useCanvasStore();

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => {
          useCanvasStore.setState((s) => ({
            edges: [
              ...s.edges,
              {
                id: `e${Date.now()}`,
                source: c.source ?? '',
                target: c.target ?? '',
                data: { color: '#333', width: 2, arrow: true },
              },
            ],
          }));
        }}
        deleteKeyCode={null}
      >
        <Background />
        <Controls />
      </ReactFlow>
      <button onClick={() => addCharacter('circle')} style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
        + 圆形角色
      </button>
      <button onClick={() => addCharacter('square')} style={{ position: 'absolute', top: 8, left: 100, zIndex: 10 }}>
        + 方形角色
      </button>
    </div>
  );
}
