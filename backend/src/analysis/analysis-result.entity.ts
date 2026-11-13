import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, OneToOne, PrimaryColumn,
} from 'typeorm';
import { AnalysisJob } from './analysis-job.entity.js';
import type { AnalysisCharacter, AnalysisRelation } from './analysis.types.js';

@Entity('analysis_results')
export class AnalysisResult {
  @PrimaryColumn({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @OneToOne(() => AnalysisJob, (job) => job.result, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: AnalysisJob;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  characters: AnalysisCharacter[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  relations: AnalysisRelation[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  corrections: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  model: string | null;

  @Column({ name: 'token_usage', type: 'jsonb', default: () => "'{}'" })
  tokenUsage: Record<string, number>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
