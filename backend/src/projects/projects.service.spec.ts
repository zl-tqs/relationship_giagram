import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Canvas } from '../canvases/canvas.entity.js';
import { Project } from './project.entity.js';
import { ProjectsService } from './projects.service.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const projectsRepo = {
    find: vi.fn(),
    save: vi.fn((p) => Promise.resolve({ id: 'p1', ...p })),
    findOne: vi.fn(),
    softDelete: vi.fn(),
    create: vi.fn((p) => p),
  };
  const canvasesRepo = { save: vi.fn(), create: vi.fn((c) => c) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectsRepo },
        { provide: getRepositoryToken(Canvas), useValue: canvasesRepo },
      ],
    }).compile();
    service = module.get(ProjectsService);
    projectsRepo.findOne.mockReset();
  });

  it('create 会同时创建一张空画布', async () => {
    await service.create('u1', { name: '测试项目' });
    expect(canvasesRepo.save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1' }));
  });

  it('findOne 非所有者抛 403', async () => {
    projectsRepo.findOne.mockResolvedValue({ id: 'p1', ownerId: 'other' });
    await expect(service.findOne('u1', 'p1')).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });
});
