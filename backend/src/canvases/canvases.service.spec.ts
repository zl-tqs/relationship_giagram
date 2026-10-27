import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectsService } from '../projects/projects.service.js';
import { Canvas } from './canvas.entity.js';
import { CanvasesService } from './canvases.service.js';

describe('CanvasesService', () => {
  let service: CanvasesService;
  const canvasesRepo = { findOne: vi.fn(), save: vi.fn((c) => Promise.resolve(c)) };
  const projects = { findOne: vi.fn().mockResolvedValue({ id: 'p1' }), update: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasesService,
        { provide: getRepositoryToken(Canvas), useValue: canvasesRepo },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();
    service = module.get(CanvasesService);
    canvasesRepo.findOne.mockReset();
  });

  it('版本不符抛 409', async () => {
    canvasesRepo.findOne.mockResolvedValue({ id: 'c1', version: 3, nodes: [], edges: [], viewport: {} });
    await expect(
      service.save('u1', 'p1', { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, baseVersion: 2 }),
    ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
  });

  it('版本一致则递增版本并保存', async () => {
    canvasesRepo.findOne.mockResolvedValue({ id: 'c1', version: 3, nodes: [], edges: [], viewport: {} });
    const res = await service.save('u1', 'p1', { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, baseVersion: 3 });
    expect(res.version).toBe(4);
  });
});
