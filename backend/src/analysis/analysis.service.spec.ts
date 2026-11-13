import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AnalysisJob } from './analysis-job.entity.js';
import { AnalysisResult } from './analysis-result.entity.js';
import { AnalysisService } from './analysis.service.js';
import { DeepSeekClient } from './deepseek.client.js';

describe('AnalysisService', () => {
  let service: AnalysisService;
  const jobsRepo = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  };
  const resultsRepo = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const ai = { analyze: vi.fn() };
  const config = { get: vi.fn() };

  const structured = {
    candidates: [{ name: '张三', count: 5, confidence: 'high' }],
    cooccurrences: [{ a: '张三', b: '李四', count: 2 }],
    excerpt: '张三与李四同行。',
    chapterCount: 1,
  };

  const job = (overrides: Record<string, unknown> = {}) => ({
    id: 'job-1',
    userId: 'u1',
    status: 'awaiting_confirm',
    template: 'default',
    fileName: 'novel.txt',
    fileSize: 1000,
    charCount: 100,
    keepResult: false,
    quotaDate: '2026-11-13',
    errorMessage: null,
    structuredData: structured,
    expiresAt: new Date('2026-11-14T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    jobsRepo.count.mockResolvedValue(0);
    jobsRepo.create.mockImplementation((value) => ({ id: 'job-1', ...value }));
    jobsRepo.save.mockImplementation((value) => Promise.resolve(value));
    resultsRepo.create.mockImplementation((value) => value);
    resultsRepo.save.mockImplementation((value) => Promise.resolve(value));
    config.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: getRepositoryToken(AnalysisJob), useValue: jobsRepo },
        { provide: getRepositoryToken(AnalysisResult), useValue: resultsRepo },
        { provide: DeepSeekClient, useValue: ai },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AnalysisService);
  });

  it('拒绝超过 10MB 的小说文件', async () => {
    await expect(
      service.createJob('u1', { fileName: 'big.txt', fileSize: 10 * 1024 * 1024 + 1 }),
    ).rejects.toMatchObject({ response: { code: 'FILE_TOO_LARGE' } });
    expect(jobsRepo.save).not.toHaveBeenCalled();
  });

  it('每日配额用完时拒绝创建任务', async () => {
    jobsRepo.count.mockResolvedValue(3);
    await expect(
      service.createJob('u1', { fileName: 'novel.txt', fileSize: 1000 }),
    ).rejects.toMatchObject({ response: { code: 'QUOTA_EXCEEDED' } });
  });

  it('创建任务时写入 pending 状态与保留期限', async () => {
    const created = await service.createJob('u1', {
      fileName: 'novel.txt',
      fileSize: 1000,
      charCount: 500,
      template: 'wuxia',
      keepResult: true,
    });
    expect(jobsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        status: 'pending',
        template: 'wuxia',
        keepResult: true,
        quotaDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expiresAt: expect.any(Date),
      }),
    );
    expect(created.status).toBe('pending');
  });

  it('保存结构化输入后进入待确认状态', async () => {
    const current = job({ status: 'pending' });
    jobsRepo.findOne.mockResolvedValue(current);

    await service.saveStructured('u1', 'job-1', structured);

    expect(jobsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'awaiting_confirm', structuredData: structured }),
    );
  });

  it('调用 AI 并只保留已确认人物与合法关系', async () => {
    const current = job({ keepResult: true });
    jobsRepo.findOne.mockResolvedValue(current);
    ai.analyze.mockResolvedValue({
      characters: [
        { name: '张三', gender: '男', description: '主角' },
        { name: '多余人物', gender: '男' },
      ],
      relations: [
        { from: '张三', to: '李四', type: '同门', description: '一起长大', confidence: 'high' },
        { from: '张三', to: '多余人物', type: '朋友' },
        { from: '李四', to: '李四', type: '自己' },
      ],
      model: 'deepseek-chat',
      tokenUsage: { totalTokens: 10 },
    });

    const result = await service.confirm('u1', 'job-1', {
      characters: [{ name: '张三' }, { name: '李四' }],
    });

    expect(result.result.characters).toEqual([
      expect.objectContaining({ name: '张三', gender: '男', description: '主角' }),
      expect.objectContaining({ name: '李四', gender: '未知' }),
    ]);
    expect(result.result.relations).toEqual([
      expect.objectContaining({ from: '张三', to: '李四', type: '同门' }),
    ]);
    expect(resultsRepo.save).toHaveBeenCalled();
    expect(current.status).toBe('completed');
    expect(current.structuredData).toBeNull();
    expect(current.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
  });

  it('未勾选保留结果时不写入分析结果表', async () => {
    const current = job({ keepResult: false });
    jobsRepo.findOne.mockResolvedValue(current);
    ai.analyze.mockResolvedValue({
      characters: [],
      relations: [],
      model: 'deepseek-chat',
      tokenUsage: {},
    });

    const result = await service.confirm('u1', 'job-1', {
      characters: [{ name: '张三' }, { name: '李四' }],
    });

    expect(result.result.characters).toHaveLength(2);
    expect(resultsRepo.save).not.toHaveBeenCalled();
    expect(current.status).toBe('completed');
  });

  it('AI 失败时记录 failed 且不写入结果', async () => {
    const current = job();
    jobsRepo.findOne.mockResolvedValue(current);
    ai.analyze.mockRejectedValue(new Error('AI unavailable'));

    await expect(
      service.confirm('u1', 'job-1', { characters: [{ name: '张三' }, { name: '李四' }] }),
    ).rejects.toThrow('AI unavailable');
    expect(current.status).toBe('failed');
    expect(current.errorMessage).toContain('AI unavailable');
    expect(resultsRepo.save).not.toHaveBeenCalled();
  });

  it('查询任务时附带已保存的结果', async () => {
    jobsRepo.findOne.mockResolvedValue(job({ keepResult: true, status: 'completed' }));
    resultsRepo.findOne.mockResolvedValue({
      jobId: 'job-1',
      characters: [{ name: '张三' }],
      relations: [],
      corrections: {},
    });

    const found = await service.findJob('u1', 'job-1');
    expect(found.result).toMatchObject({ characters: [{ name: '张三' }] });
  });

  it('无权限或不存在时返回 404', async () => {
    jobsRepo.findOne.mockResolvedValue(null);
    await expect(service.findJob('u2', 'job-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('删除任务时同时清理结果', async () => {
    jobsRepo.findOne.mockResolvedValue(job());
    await service.remove('u1', 'job-1');
    expect(resultsRepo.delete).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(jobsRepo.delete).toHaveBeenCalledWith('job-1');
  });

  it('返回每日剩余配额', async () => {
    jobsRepo.count.mockResolvedValue(1);
    const quota = await service.quota('u1');
    expect(quota).toMatchObject({ used: 1, limit: 3, remaining: 2 });
    expect(quota.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('清理过期任务与结果', async () => {
    jobsRepo.delete.mockResolvedValue({ affected: 1 });
    resultsRepo.delete.mockResolvedValue({ affected: 1 });
    await service.purgeExpired();
    expect(jobsRepo.delete).toHaveBeenCalledWith({ expiresAt: expect.anything() });
    expect(resultsRepo.delete).toHaveBeenCalledWith({ expiresAt: expect.anything() });
  });
});
