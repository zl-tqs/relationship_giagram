import {
  BadRequestException, ConflictException, Injectable, NotFoundException, type OnModuleDestroy, type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Canvas } from '../canvases/canvas.entity.js';
import { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CanvasSnapshot, type SnapshotData } from './canvas-snapshot.entity.js';
import { CreateSnapshotDto } from './dto/create-snapshot.dto.js';
import { RenameSnapshotDto } from './dto/rename-snapshot.dto.js';
import { RestoreSnapshotDto } from './dto/restore-snapshot.dto.js';

const TRANSIENT_KEYS = ['selected', 'dragging', 'measured', 'width', 'height'];
const SOFT_DELETE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function stripTransient(items: unknown[]) {
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const copy = { ...(item as Record<string, unknown>) };
    for (const key of TRANSIENT_KEYS) delete copy[key];
    return copy;
  });
}

function normalizeData(input: { schemaVersion?: number; nodes: unknown[]; edges: unknown[] }): SnapshotData {
  return {
    schemaVersion: input.schemaVersion ?? 1,
    nodes: stripTransient(input.nodes),
    edges: stripTransient(input.edges),
  };
}

function toMeta(snapshot: CanvasSnapshot) {
  return {
    id: snapshot.id,
    name: snapshot.name,
    type: snapshot.type,
    baseRevision: snapshot.baseRevision,
    contentHash: snapshot.contentHash,
    sizeBytes: snapshot.sizeBytes ?? 0,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
  };
}

function conflict(serverVersion: number, clientVersion: number) {
  return new ConflictException({
    code: 'VERSION_CONFLICT',
    message: '画布已被其他端修改',
    details: { serverVersion, clientVersion },
  });
}

@Injectable()
export class SnapshotsService implements OnModuleInit, OnModuleDestroy {
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(CanvasSnapshot) private readonly snapshots: Repository<CanvasSnapshot>,
    @InjectRepository(Canvas) private readonly canvases: Repository<Canvas>,
    private readonly projects: ProjectsService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    this.purgeTimer = setInterval(() => {
      void this.purgeExpired().catch(() => undefined);
    }, 60 * 60 * 1000);
    this.purgeTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async purgeExpired(now = new Date()) {
    const cutoff = new Date(now.getTime() - SOFT_DELETE_RETENTION_MS);
    await this.snapshots
      .createQueryBuilder()
      .delete()
      .from(CanvasSnapshot)
      .where('deleted_at IS NOT NULL AND deleted_at < :cutoff', { cutoff })
      .execute();
  }

  async list(userId: string, projectId: string) {
    await this.projects.findOne(userId, projectId);
    const rows = await this.snapshots.find({
      where: { projectId, type: 'manual', deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      select: [
        'id', 'name', 'type', 'baseRevision', 'contentHash', 'sizeBytes', 'createdAt', 'createdBy',
      ],
    });
    return rows.map(toMeta);
  }

  async create(userId: string, projectId: string, dto: CreateSnapshotDto) {
    await this.projects.findOne(userId, projectId);
    if (!Array.isArray(dto.data?.nodes) || !Array.isArray(dto.data?.edges)) {
      throw new BadRequestException({ code: 'INVALID_DATA', message: '画布数据格式不正确' });
    }
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException({ code: 'INVALID_NAME', message: '快照名称不能为空' });
    }

    if (dto.idempotencyKey) {
      const existing = await this.snapshots.findOne({
        where: { projectId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        const canvas = await this.canvases.findOne({ where: { projectId } });
        return {
          revision: canvas?.version ?? existing.baseRevision + 1,
          snapshot: toMeta(existing),
        };
      }
    }

    const data = normalizeData(dto.data);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const canvas = await manager.findOne(Canvas, {
          where: { projectId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!canvas) throw new NotFoundException({ code: 'NOT_FOUND', message: '画布不存在' });
        if (canvas.version !== dto.baseRevision) throw conflict(canvas.version, dto.baseRevision);

        canvas.nodes = data.nodes;
        canvas.edges = data.edges;
        if (dto.viewport) canvas.viewport = dto.viewport;
        canvas.version += 1;
        await manager.save(canvas);

        const snapshot = manager.create(CanvasSnapshot, {
          projectId,
          canvasId: canvas.id,
          name,
          type: 'manual',
          data,
          baseRevision: dto.baseRevision,
          contentHash: dto.contentHash ?? null,
          sizeBytes: Buffer.byteLength(JSON.stringify(data)),
          createdBy: userId,
          idempotencyKey: dto.idempotencyKey ?? null,
        });
        await manager.save(snapshot);
        await manager.update(Project, { id: projectId }, { lastModifiedAt: new Date() });

        return { revision: canvas.version, snapshot: toMeta(snapshot) };
      });
    } catch (error) {
      const code = (error as { code?: string; driverError?: { code?: string } }).code
        ?? (error as { driverError?: { code?: string } }).driverError?.code;
      if (code === '23505' && dto.idempotencyKey) {
        const existing = await this.snapshots.findOne({
          where: { projectId, idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          const canvas = await this.canvases.findOne({ where: { projectId } });
          return {
            revision: canvas?.version ?? existing.baseRevision + 1,
            snapshot: toMeta(existing),
          };
        }
      }
      throw error;
    }
  }

  async findOne(userId: string, projectId: string, snapshotId: string) {
    await this.projects.findOne(userId, projectId);
    const snapshot = await this.snapshots.findOne({
      where: { id: snapshotId, projectId, deletedAt: IsNull() },
    });
    if (!snapshot) throw new NotFoundException({ code: 'NOT_FOUND', message: '快照不存在' });
    return { ...toMeta(snapshot), data: snapshot.data };
  }

  async restore(
    userId: string,
    projectId: string,
    snapshotId: string,
    dto: RestoreSnapshotDto,
  ) {
    await this.projects.findOne(userId, projectId);

    return this.dataSource.transaction(async (manager) => {
      const canvas = await manager.findOne(Canvas, {
        where: { projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!canvas) throw new NotFoundException({ code: 'NOT_FOUND', message: '画布不存在' });
      if (canvas.version !== dto.baseRevision) throw conflict(canvas.version, dto.baseRevision);

      const target = await manager.findOne(CanvasSnapshot, {
        where: { id: snapshotId, projectId, deletedAt: IsNull() },
      });
      if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: '快照不存在' });

      const safety = manager.create(CanvasSnapshot, {
        projectId,
        canvasId: canvas.id,
        name: `恢复前自动备份 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
        type: 'safety',
        data: normalizeData({
          nodes: canvas.nodes ?? [],
          edges: canvas.edges ?? [],
        }),
        baseRevision: canvas.version,
        contentHash: null,
        sizeBytes: 0,
        createdBy: userId,
        idempotencyKey: null,
      });
      await manager.save(safety);

      const safetySnapshots = await manager.find(CanvasSnapshot, {
        where: { projectId, type: 'safety', deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
      for (const stale of safetySnapshots.slice(3)) {
        await manager.softDelete(CanvasSnapshot, stale.id);
      }

      const restored = target.data as SnapshotData;
      canvas.nodes = restored.nodes ?? [];
      canvas.edges = restored.edges ?? [];
      canvas.version += 1;
      await manager.save(canvas);
      await manager.update(Project, { id: projectId }, { lastModifiedAt: new Date() });

      return { revision: canvas.version, safetySnapshotId: safety.id };
    });
  }

  async rename(userId: string, projectId: string, snapshotId: string, dto: RenameSnapshotDto) {
    await this.projects.findOne(userId, projectId);
    const snapshot = await this.snapshots.findOne({
      where: { id: snapshotId, projectId, deletedAt: IsNull() },
    });
    if (!snapshot) throw new NotFoundException({ code: 'NOT_FOUND', message: '快照不存在' });
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException({ code: 'INVALID_NAME', message: '快照名称不能为空' });
    snapshot.name = name;
    const saved = await this.snapshots.save(snapshot);
    return toMeta(saved);
  }

  async remove(userId: string, projectId: string, snapshotId: string) {
    await this.projects.findOne(userId, projectId);
    const snapshot = await this.snapshots.findOne({
      where: { id: snapshotId, projectId, deletedAt: IsNull() },
    });
    if (!snapshot) throw new NotFoundException({ code: 'NOT_FOUND', message: '快照不存在' });
    await this.snapshots.softDelete(snapshot.id);
    return { success: true };
  }
}
