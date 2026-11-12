import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSnapshotDto } from './dto/create-snapshot.dto.js';
import { RenameSnapshotDto } from './dto/rename-snapshot.dto.js';
import { RestoreSnapshotDto } from './dto/restore-snapshot.dto.js';
import { SnapshotsService } from './snapshots.service.js';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/snapshots')
export class SnapshotsController {
  constructor(private readonly snapshots: SnapshotsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }, @Param('projectId') projectId: string) {
    return this.snapshots.list(user.userId, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Param('projectId') projectId: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.snapshots.create(user.userId, projectId, dto);
  }

  @Get(':sid')
  findOne(
    @CurrentUser() user: { userId: string },
    @Param('projectId') projectId: string,
    @Param('sid') sid: string,
  ) {
    return this.snapshots.findOne(user.userId, projectId, sid);
  }

  @Post(':sid/restore')
  restore(
    @CurrentUser() user: { userId: string },
    @Param('projectId') projectId: string,
    @Param('sid') sid: string,
    @Body() dto: RestoreSnapshotDto,
  ) {
    return this.snapshots.restore(user.userId, projectId, sid, dto);
  }

  @Patch(':sid')
  rename(
    @CurrentUser() user: { userId: string },
    @Param('projectId') projectId: string,
    @Param('sid') sid: string,
    @Body() dto: RenameSnapshotDto,
  ) {
    return this.snapshots.rename(user.userId, projectId, sid, dto);
  }

  @Delete(':sid')
  remove(
    @CurrentUser() user: { userId: string },
    @Param('projectId') projectId: string,
    @Param('sid') sid: string,
  ) {
    return this.snapshots.remove(user.userId, projectId, sid);
  }
}
