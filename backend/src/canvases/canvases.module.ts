import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { Canvas } from './canvas.entity.js';
import { CanvasesController } from './canvases.controller.js';
import { CanvasesService } from './canvases.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Canvas]), AuthModule, ProjectsModule],
  controllers: [CanvasesController],
  providers: [CanvasesService],
})
export class CanvasesModule {}
