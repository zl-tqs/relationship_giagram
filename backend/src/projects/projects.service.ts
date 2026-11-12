import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Canvas } from '../canvases/canvas.entity.js';
import { CanvasSnapshot } from '../snapshots/canvas-snapshot.entity.js';
import { Project } from './project.entity.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Canvas) private readonly canvases: Repository<Canvas>,
    @InjectRepository(CanvasSnapshot) private readonly snapshots: Repository<CanvasSnapshot>,
  ) {}

  async recent(userId: string) {
    return this.projects.find({
      where: { ownerId: userId },
      order: { lastModifiedAt: 'DESC' },
      take: 20,
      select: ['id', 'name', 'description', 'lastModifiedAt'],
    });
  }

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.projects.save(this.projects.create({ ownerId: userId, name: dto.name }));
    await this.canvases.save(this.canvases.create({ projectId: project.id }));
    return project;
  }

  async findOne(userId: string, id: string) {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw new NotFoundException({ code: 'NOT_FOUND', message: '项目不存在' });
    if (project.ownerId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '无权访问该项目' });
    return project;
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.findOne(userId, id);
    Object.assign(project, dto);
    project.lastModifiedAt = new Date();
    return this.projects.save(project);
  }

  async remove(userId: string, id: string) {
    const project = await this.findOne(userId, id);
    await this.snapshots.softDelete({ projectId: project.id });
    return this.projects.softDelete(project.id);
  }
}
