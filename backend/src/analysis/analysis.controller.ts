import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AnalysisService } from './analysis.service.js';
import { ConfirmAnalysisDto } from './dto/confirm-analysis.dto.js';
import { CreateAnalysisJobDto } from './dto/create-analysis-job.dto.js';
import { OnlineLookupDto } from './dto/online-lookup.dto.js';
import { SaveStructuredDto } from './dto/save-structured.dto.js';
import { UpdateAnalysisResultDto } from './dto/update-analysis-result.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('quota')
  quota(@CurrentUser() user: { userId: string }) {
    return this.analysis.quota(user.userId);
  }

  @Post('online-lookup')
  onlineLookup(
    @CurrentUser() user: { userId: string },
    @Body() dto: OnlineLookupDto,
  ) {
    return this.analysis.onlineLookup(user.userId, dto);
  }

  @Post('jobs')
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateAnalysisJobDto) {
    return this.analysis.createJob(user.userId, dto);
  }

  @Put('jobs/:id/structured')
  saveStructured(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: SaveStructuredDto,
  ) {
    return this.analysis.saveStructured(user.userId, id, dto);
  }

  @Post('jobs/:id/confirm')
  confirm(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: ConfirmAnalysisDto,
  ) {
    return this.analysis.confirm(user.userId, id, dto);
  }

  @Get('jobs/:id')
  findOne(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.analysis.findJob(user.userId, id);
  }

  @Patch('jobs/:id/result')
  updateResult(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateAnalysisResultDto,
  ) {
    return this.analysis.updateResult(user.userId, id, dto);
  }

  @Delete('jobs/:id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.analysis.remove(user.userId, id);
  }
}
