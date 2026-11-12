import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service.js';
import { RefreshToken } from './refresh-token.entity.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  const usersRepo = {
    findOne: vi.fn(),
    save: vi.fn((u) => Promise.resolve({ id: 'u1', ...u })),
    create: vi.fn((u) => u),
  };
  const refreshRepo = {
    findOne: vi.fn(),
    save: vi.fn((t) => Promise.resolve(t)),
  };
  const jwt = { sign: vi.fn(() => 'access-token') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
    usersRepo.findOne.mockReset();
    refreshRepo.findOne.mockReset();
    refreshRepo.save.mockClear();
    jwt.sign.mockClear();
  });

  it('register 邮箱重复抛 Conflict', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 'x' });
    await expect(
      service.register({ email: 'A@B.com', password: '12345678', nickname: 'A' }),
    ).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });
  });

  it('register 邮箱统一转小写', async () => {
    usersRepo.findOne.mockResolvedValue(null);
    await service.register({ email: 'A@B.com', password: '12345678', nickname: 'A' });
    expect(usersRepo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }));
  });

  it('anonymous 返回 token 与用户', async () => {
    const res = await service.anonymous('路人甲');
    expect(res.accessToken).toBe('access-token');
    expect(res.user.isAnonymous).toBe(true);
  });

  it('register 返回刷新令牌，且入库内容仅为 SHA-256 哈希', async () => {
    usersRepo.findOne.mockResolvedValue(null);
    const res = await service.register({ email: 'A@B.com', password: '12345678', nickname: 'A' });

    expect(res.refreshToken).toBeTruthy();
    expect(res.refreshToken).not.toBe(res.accessToken);
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1' }, { expiresIn: '15m' });

    const saved = refreshRepo.save.mock.calls[0][0] as RefreshToken;
    expect(saved.userId).toBe('u1');
    expect(saved.tokenHash).toBe(sha256(res.refreshToken));
    expect(saved.tokenHash).not.toContain(res.refreshToken);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + thirtyDays - 60_000);
  });

  it('refresh 使旧令牌失效并轮换出新令牌', async () => {
    const raw = 'old-refresh-token';
    const row = {
      id: 'r1',
      userId: 'u1',
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null as Date | null,
    };
    refreshRepo.findOne.mockResolvedValue(row);

    const res = await service.refresh(raw);

    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(res.accessToken).toBe('access-token');
    expect(res.refreshToken).toBeTruthy();
    expect(res.refreshToken).not.toBe(raw);
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1' }, { expiresIn: '15m' });

    expect(refreshRepo.save).toHaveBeenCalledTimes(2);
    const next = refreshRepo.save.mock.calls[1][0] as RefreshToken;
    expect(next.tokenHash).toBe(sha256(res.refreshToken));
    expect(next.tokenHash).not.toBe(row.tokenHash);
  });

  it('me 返回当前用户的公开信息', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      nickname: '作者',
      isAnonymous: false,
    });

    await expect(service.me('u1')).resolves.toEqual({
      id: 'u1',
      email: 'a@b.com',
      nickname: '作者',
      isAnonymous: false,
    });
  });

  it('me 用户不存在时抛 401', async () => {
    usersRepo.findOne.mockResolvedValue(null);
    await expect(service.me('missing')).rejects.toMatchObject({
      response: { code: 'UNAUTHORIZED' },
    });
  });

  it('refresh 对不存在的令牌抛 401', async () => {
    refreshRepo.findOne.mockResolvedValue(null);
    await expect(service.refresh('missing')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
  });

  it('refresh 对已过期令牌抛 401', async () => {
    refreshRepo.findOne.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      tokenHash: sha256('expired'),
      expiresAt: new Date(Date.now() - 1_000),
      revokedAt: null,
    });
    await expect(service.refresh('expired')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
  });

  it('refresh 对已吊销令牌抛 401', async () => {
    refreshRepo.findOne.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      tokenHash: sha256('revoked'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });
    await expect(service.refresh('revoked')).rejects.toMatchObject({
      response: { code: 'INVALID_REFRESH_TOKEN' },
    });
  });

  it('logout 吊销匹配的刷新令牌', async () => {
    const raw = 'logout-token';
    const row = {
      id: 'r1',
      userId: 'u1',
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null as Date | null,
    };
    refreshRepo.findOne.mockResolvedValue(row);

    await expect(service.logout(raw)).resolves.toEqual({ success: true });
    expect(row.revokedAt).toBeInstanceOf(Date);
  });

  it('logout 对未知令牌保持幂等', async () => {
    refreshRepo.findOne.mockResolvedValue(null);
    await expect(service.logout('missing')).resolves.toEqual({ success: true });
    expect(refreshRepo.save).not.toHaveBeenCalled();
  });
});
