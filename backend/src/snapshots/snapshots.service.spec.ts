import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Canvas } from '../canvases/canvas.entity.js';
import { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CanvasSnapshot } from './canvas-snapshot.entity.js';
import { SnapshotsService } from './snapshots.service.js';

describe('SnapshotsService', () => {
  let service: SnapshotsService;
  const snapshotsRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    softDelete: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const canvasesRepo = { findOne: vi.fn() };
  const projects = {
    findOne: vi.fn().mockResolvedValue({ id: 'p1' }),
    update: vi.fn(),
  };
  const tx = {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
  const dataSource = { transaction: vi.fn((cb: (manager: typeof tx) => unknown) => cb(tx)) };

  const canvas = () => ({
    id: 'c1',
    projectId: 'p1',
    version: 3,
    nodes: [{ id: 'old' }],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    projects.findOne.mockResolvedValue({ id: 'p1' });
    canvasesRepo.findOne.mockResolvedValue({ id: 'c1', version: 7 });
    tx.find.mockResolvedValue([]);
    tx.create.mockImplementation((_entity, value) => ({ id: 's-new', ...value }));
    tx.save.mockImplementation((value) => Promise.resolve(value));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsService,
        { provide: getRepositoryToken(CanvasSnapshot), useValue: snapshotsRepo },
        { provide: getRepositoryToken(Canvas), useValue: canvasesRepo },
        { provide: ProjectsService, useValue: projects },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(SnapshotsService);
  });

  it('创建快照时在同一事务内保存画布并返回新 revision', async () => {
    const current = canvas();
    tx.findOne.mockImplementation((entity) => Promise.resolve(entity === Canvas ? current : null));

    const result = await service.create('u1', 'p1', {
      name: '  第一章  ',
      baseRevision: 3,
      data: { schemaVersion: 1, nodes: [{ id: 'n1', selected: true }], edges: [] },
      viewport: { x: 1, y: 2, zoom: 1.2 },
    });

    expect(result.revision).toBe(4);
    expect(current.version).toBe(4);
    expect(tx.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', version: 4 }));
    expect(tx.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: '第一章', type: 'manual', baseRevision: 3 }),
    );
    expect(tx.save).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nodes: [{ id: 'n1' }] }) }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      Project,
      { id: 'p1' },
      expect.objectContaining({ lastModifiedAt: expect.any(Date) }),
    );
  });

  it('baseRevision 不一致时抛 409 且不写快照', async () => {
    tx.findOne.mockResolvedValue(canvas());

    await expect(
      service.create('u1', 'p1', {
        name: 'v1',
        baseRevision: 2,
        data: { nodes: [], edges: [] },
      }),
    ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });

    expect(tx.save).not.toHaveBeenCalled();
  });

  it('幂等键已存在时直接返回已有快照', async () => {
    snapshotsRepo.findOne.mockResolvedValue({
      id: 's1',
      name: 'v1',
      type: 'manual',
      baseRevision: 5,
      data: { nodes: [], edges: [] },
      createdAt: new Date('2026-01-01'),
    });

    const result = await service.create('u1', 'p1', {
      name: 'v1',
      baseRevision: 5,
      data: { nodes: [], edges: [] },
      idempotencyKey: 'k1',
    });

    expect(result.snapshot.id).toBe('s1');
    expect(result.revision).toBe(7);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('恢复快照先创建安全快照再替换工作副本并递增 revision', async () => {
    const current = canvas();
    const target = {
      id: 's-target',
      projectId: 'p1',
      name: 'v1',
      type: 'manual',
      data: { schemaVersion: 1, nodes: [{ id: 'restored' }], edges: [] },
      baseRevision: 1,
      createdAt: new Date(),
    };
    tx.findOne.mockImplementation((entity) =>
      Promise.resolve(entity === Canvas ? current : target),
    );

    const result = await service.restore('u1', 'p1', 's-target', { baseRevision: 3 });

    expect(result.revision).toBe(4);
    expect(result.safetySnapshotId).toBe('s-new');
    expect(tx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'safety',
        data: expect.objectContaining({ nodes: [{ id: 'old' }] }),
      }),
    );
    expect(current.nodes).toEqual([{ id: 'restored' }]);
    expect(current.version).toBe(4);
    expect(tx.update).toHaveBeenCalledWith(
      Project,
      { id: 'p1' },
      expect.objectContaining({ lastModifiedAt: expect.any(Date) }),
    );
  });

  it('列表只返回未删除的手动快照元数据', async () => {
    snapshotsRepo.find.mockResolvedValue([
      {
        id: 's1',
        name: 'v1',
        type: 'manual',
        baseRevision: 3,
        contentHash: 'h1',
        createdAt: new Date('2026-01-01'),
        createdBy: 'u1',
        data: { nodes: [], edges: [] },
      },
    ]);

    const result = await service.list('u1', 'p1');

    expect(result[0]).toMatchObject({ id: 's1', name: 'v1' });
    expect(snapshotsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 'p1', type: 'manual' }),
      }),
    );
  });

  it('清理 7 天前软删除的快照', async () => {
    const query = {
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    };
    snapshotsRepo.createQueryBuilder.mockReturnValue(query);

    await service.purgeExpired(new Date('2026-11-12T00:00:00.000Z'));

    expect(query.where).toHaveBeenCalledWith(
      'deleted_at IS NOT NULL AND deleted_at < :cutoff',
      { cutoff: new Date('2026-11-05T00:00:00.000Z') },
    );
    expect(query.execute).toHaveBeenCalled();
  });

  it('删除快照使用软删除', async () => {
    snapshotsRepo.findOne.mockResolvedValue({
      id: 's1',
      projectId: 'p1',
      name: 'v1',
      type: 'manual',
      data: {},
      createdAt: new Date(),
    });

    await service.remove('u1', 'p1', 's1');

    expect(snapshotsRepo.softDelete).toHaveBeenCalledWith('s1');
  });
});
