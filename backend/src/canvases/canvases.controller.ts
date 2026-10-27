import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SaveCanvasDto } from './dto/save-canvas.dto.js';
import { CanvasesService } from './canvases.service.js';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/canvas')
export class CanvasesController {
  constructor(private readonly canvases: CanvasesService) {}

  @Get()
  findOne(@CurrentUser() user: { userId: string }, @Param('projectId') projectId: string) {
    return this.canvases.findByProject(user.userId, projectId);
  }

  @Put()
  save(
    @CurrentUser() user: { userId: string },
    @Param('projectId') projectId: string,
    @Body() dto: SaveCanvasDto,
  ) {
    return this.canvases.save(user.userId, projectId, dto);
  }
}
