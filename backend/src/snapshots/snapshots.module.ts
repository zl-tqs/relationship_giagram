import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Canvas } from '../canvases/canvas.entity.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { CanvasSnapshot } from './canvas-snapshot.entity.js';
import { SnapshotsController } from './snapshots.controller.js';
import { SnapshotsService } from './snapshots.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CanvasSnapshot, Canvas]), AuthModule, ProjectsModule],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
})
export class SnapshotsModule {}
