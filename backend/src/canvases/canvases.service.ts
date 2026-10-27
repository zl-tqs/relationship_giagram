import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service.js';
import { Canvas } from './canvas.entity.js';
import { SaveCanvasDto } from './dto/save-canvas.dto.js';

@Injectable()
export class CanvasesService {
  constructor(
    @InjectRepository(Canvas) private readonly canvases: Repository<Canvas>,
    private readonly projects: ProjectsService,
  ) {}

  async findByProject(userId: string, projectId: string) {
    await this.projects.findOne(userId, projectId);
    const canvas = await this.canvases.findOne({ where: { projectId } });
    if (!canvas) throw new NotFoundException({ code: 'NOT_FOUND', message: '画布不存在' });
    return canvas;
  }

  async save(userId: string, projectId: string, dto: SaveCanvasDto) {
    const canvas = await this.findByProject(userId, projectId);
    if (canvas.version !== dto.baseVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '画布已被其他端修改',
        details: { serverVersion: canvas.version, clientVersion: dto.baseVersion },
      });
    }
    canvas.nodes = dto.nodes;
    canvas.edges = dto.edges;
    canvas.viewport = dto.viewport;
    canvas.version += 1;
    const saved = await this.canvases.save(canvas);
    await this.projects.update(userId, projectId, {});
    return { id: saved.id, version: saved.version };
  }
}
