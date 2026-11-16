import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { StructuredAnalysisData } from './analysis.types.js';

const bigintNumber = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity('analysis_jobs')
export class AnalysisJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text', default: 'pending' })
  status: string;

  @Column({ type: 'text', default: 'default' })
  template: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName: string;

  @Column({ name: 'file_size', type: 'bigint', transformer: bigintNumber })
  fileSize: number;

  @Column({ name: 'char_count', type: 'int', default: 0 })
  charCount: number;

  @Column({ name: 'keep_result', type: 'boolean', default: false })
  keepResult: boolean;

  @Column({ name: 'quota_date', type: 'date' })
  quotaDate: string;

  @Column({ name: 'structured_data', type: 'jsonb', nullable: true })
  structuredData: StructuredAnalysisData | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
