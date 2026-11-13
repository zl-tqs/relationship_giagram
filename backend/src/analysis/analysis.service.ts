import {
  BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException,
  OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Not, Repository } from 'typeorm';
import { AnalysisJob } from './analysis-job.entity.js';
import { AnalysisResult } from './analysis-result.entity.js';
import {
  type AnalysisCharacter, type AnalysisRelation, type StructuredAnalysisData,
} from './analysis.types.js';
import { DeepSeekClient } from './deepseek.client.js';
import { CreateAnalysisJobDto, MAX_NOVEL_FILE_SIZE } from './dto/create-analysis-job.dto.js';
import { ConfirmAnalysisDto } from './dto/confirm-analysis.dto.js';
import { SaveStructuredDto } from './dto/save-structured.dto.js';
import { UpdateAnalysisResultDto } from './dto/update-analysis-result.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_RESULT_DAYS = 30;
const DEFAULT_FREE_QUOTA = 3;

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number) {
  return new Date(Date.now() + days * DAY_MS);
}

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class AnalysisService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AnalysisJob) private readonly jobs: Repository<AnalysisJob>,
    @InjectRepository(AnalysisResult) private readonly results: Repository<AnalysisResult>,
    private readonly ai: DeepSeekClient,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.purgeExpired().catch(() => undefined);
    }, 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async quota(userId: string) {
    const date = todayKey();
    const limit = this.quotaLimit();
    const used = await this.jobs.count({ where: { userId, quotaDate: date, status: Not('failed') } });
    return { date, used, limit, remaining: Math.max(0, limit - used) };
  }

  async createJob(userId: string, dto: CreateAnalysisJobDto) {
    if (dto.fileSize > MAX_NOVEL_FILE_SIZE) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: '小说文件不能超过 10MB' });
    }
    const limit = this.quotaLimit();
    const used = await this.jobs.count({
      where: { userId, quotaDate: todayKey(), status: Not('failed') },
    });
    if (used >= limit) {
      throw new HttpException(
        {
          code: 'QUOTA_EXCEEDED',
          message: `今日 AI 分析次数已用完（每日 ${limit} 次）`,
          details: { used, limit },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const keepResult = dto.keepResult ?? false;
    return this.jobs.save(
      this.jobs.create({
        userId,
        status: 'pending',
        template: dto.template ?? 'default',
        fileName: dto.fileName.trim(),
        fileSize: dto.fileSize,
        charCount: dto.charCount ?? 0,
        keepResult,
        quotaDate: todayKey(),
        structuredData: null,
        errorMessage: null,
        expiresAt: addDays(keepResult ? KEEP_RESULT_DAYS : 1),
      }),
    );
  }

  async saveStructured(userId: string, id: string, dto: SaveStructuredDto) {
    const job = await this.getJob(userId, id);
    if (!['pending', 'preprocessing', 'awaiting_confirm'].includes(job.status)) {
      throw new BadRequestException({ code: 'INVALID_STATUS', message: '当前任务状态不能提交人物数据' });
    }
    job.structuredData = dto as StructuredAnalysisData;
    job.status = 'awaiting_confirm';
    return this.jobs.save(job);
  }

  async confirm(userId: string, id: string, dto: ConfirmAnalysisDto) {
    const job = await this.getJob(userId, id);
    if (job.status !== 'awaiting_confirm') {
      throw new BadRequestException({ code: 'INVALID_STATUS', message: '请先提交并确认人物候选' });
    }
    const structured = job.structuredData;
    if (!structured?.excerpt) {
      throw new BadRequestException({ code: 'MISSING_STRUCTURED_DATA', message: '缺少小说结构化数据' });
    }

    const confirmed = dto.characters
      .map((character) => ({ ...character, name: normalizeName(character.name) }))
      .filter((character) => character.name);
    const names = [...new Set(confirmed.map((character) => character.name))];
    if (names.length === 0) {
      throw new BadRequestException({ code: 'NO_CHARACTERS', message: '请至少确认一个人物' });
    }

    job.status = 'analyzing';
    job.errorMessage = null;
    await this.jobs.save(job);

    let aiResult;
    try {
      aiResult = await this.ai.analyze({
        confirmed: names,
        cooccurrences: structured.cooccurrences ?? [],
        excerpt: structured.excerpt,
        template: job.template,
      });
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error instanceof Error ? error.message : 'AI 分析失败';
      job.structuredData = null;
      job.expiresAt = addDays(1);
      await this.jobs.save(job);
      throw error;
    }

    const characters = this.normalizeCharacters(confirmed, aiResult.characters);
    const relations = this.normalizeRelations(aiResult.relations, new Set(names));
    const result = {
      characters,
      relations,
      model: aiResult.model,
      tokenUsage: aiResult.tokenUsage,
    };

    job.status = 'completed';
    job.structuredData = null;
    job.expiresAt = addDays(job.keepResult ? KEEP_RESULT_DAYS : 1);
    await this.jobs.save(job);

    if (job.keepResult) {
      await this.results.save(
        this.results.create({
          jobId: job.id,
          characters,
          relations,
          corrections: {},
          model: aiResult.model,
          tokenUsage: aiResult.tokenUsage,
          expiresAt: job.expiresAt,
        }),
      );
    }

    return { jobId: job.id, status: job.status, result };
  }

  async findJob(userId: string, id: string) {
    const job = await this.getJob(userId, id);
    const result = await this.results.findOne({ where: { jobId: job.id } });
    return { ...job, result };
  }

  async updateResult(userId: string, id: string, dto: UpdateAnalysisResultDto) {
    const job = await this.getJob(userId, id);
    if (!job.keepResult) {
      throw new BadRequestException({ code: 'RESULT_NOT_KEPT', message: '该任务未勾选保存分析结果' });
    }
    const result = await this.results.findOne({ where: { jobId: job.id } });
    if (!result) throw new NotFoundException({ code: 'NOT_FOUND', message: '分析结果不存在或已过期' });

    if (dto.characters) result.characters = dto.characters as AnalysisCharacter[];
    if (dto.relations) result.relations = dto.relations as AnalysisRelation[];
    if (dto.corrections) result.corrections = dto.corrections;
    return this.results.save(result);
  }

  async remove(userId: string, id: string) {
    const job = await this.getJob(userId, id);
    await this.results.delete({ jobId: job.id });
    await this.jobs.delete(job.id);
    return { ok: true };
  }

  async purgeExpired() {
    const now = new Date();
    await this.results.delete({ expiresAt: LessThanOrEqual(now) });
    await this.jobs.delete({ expiresAt: LessThanOrEqual(now) });
  }

  private async getJob(userId: string, id: string) {
    const job = await this.jobs.findOne({ where: { id, userId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: '分析任务不存在' });
    return job;
  }

  private quotaLimit() {
    const configured = Number(this.config.get<string>('ANALYSIS_FREE_QUOTA') ?? DEFAULT_FREE_QUOTA);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_FREE_QUOTA;
  }

  private normalizeCharacters(
    confirmed: { name: string; gender?: string; description?: string; aliases?: string[] }[],
    aiCharacters: AnalysisCharacter[],
  ) {
    const aiByName = new Map<string, AnalysisCharacter>();
    for (const item of aiCharacters) {
      const name = normalizeName(item.name);
      if (name && !aiByName.has(name)) aiByName.set(name, item);
    }
    return confirmed.map((character) => {
      const ai = aiByName.get(character.name);
      return {
        name: character.name,
        gender: character.gender?.trim() || ai?.gender?.trim() || '未知',
        description: character.description?.trim() || ai?.description?.trim() || undefined,
        aliases: character.aliases ?? ai?.aliases ?? undefined,
      };
    });
  }

  private normalizeRelations(relations: AnalysisRelation[], confirmed: Set<string>) {
    const seen = new Set<string>();
    const normalized: AnalysisRelation[] = [];
    for (const relation of relations) {
      const from = normalizeName(relation.from);
      const to = normalizeName(relation.to);
      if (!confirmed.has(from) || !confirmed.has(to) || from === to) continue;
      const type = normalizeName(relation.type) || '关系';
      const key = `${from}|${to}|${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const confidence = ['high', 'medium', 'low'].includes(String(relation.confidence))
        ? relation.confidence
        : undefined;
      normalized.push({
        from,
        to,
        type,
        description: relation.description?.trim() || undefined,
        confidence,
      });
      if (normalized.length >= 60) break;
    }
    return normalized;
  }
}
