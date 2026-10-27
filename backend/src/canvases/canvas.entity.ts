import {
  Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('canvases')
export class Canvas {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ type: 'text', default: '默认画布' })
  name: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  nodes: unknown[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  edges: unknown[];

  @Column({ type: 'jsonb', default: () => "'{\"x\":0,\"y\":0,\"zoom\":1}'" })
  viewport: { x: number; y: number; zoom: number };

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  version: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
