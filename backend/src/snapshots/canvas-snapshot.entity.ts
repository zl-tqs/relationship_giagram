import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn,
} from 'typeorm';

export type SnapshotData = {
  schemaVersion: number;
  nodes: unknown[];
  edges: unknown[];
};

@Entity('canvas_snapshots')
@Index(['projectId', 'createdAt'])
@Index(['projectId', 'idempotencyKey'], { unique: true })
export class CanvasSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'canvas_id', type: 'uuid' })
  canvasId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', default: 'manual' })
  type: 'manual' | 'safety';

  @Column({ type: 'jsonb' })
  data: SnapshotData;

  @Column({ name: 'base_revision', type: 'int' })
  baseRevision: number;

  @Column({ name: 'content_hash', type: 'text', nullable: true })
  contentHash: string | null;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
