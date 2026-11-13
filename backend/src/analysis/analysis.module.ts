import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisJob } from './analysis-job.entity.js';
import { AnalysisResult } from './analysis-result.entity.js';
import { AnalysisService } from './analysis.service.js';
import { DeepSeekClient } from './deepseek.client.js';

@Module({
  imports: [TypeOrmModule.forFeature([AnalysisJob, AnalysisResult]), AuthModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, DeepSeekClient],
  exports: [AnalysisService],
})
export class AnalysisModule {}
