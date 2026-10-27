import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CharacterData } from '../../types';

export function CharacterNode({ data, selected }: NodeProps) {
  const d = data as CharacterData;
  const round = d.shape === 'circle';
  return (
    <div
      style={{
        width: 120,
        height: round ? 120 : 72,
        borderRadius: round ? '50%' : 8,
        border: selected ? '2px solid #1677ff' : '1px solid #d9d9d9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        padding: 8,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <span style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
