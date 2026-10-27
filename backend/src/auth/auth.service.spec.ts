import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';

describe('AuthService', () => {
  let service: AuthService;
  const usersRepo = {
    findOne: vi.fn(),
    save: vi.fn((u) => Promise.resolve({ id: 'u1', ...u })),
    create: vi.fn((u) => u),
  };
  const jwt = { sign: vi.fn(() => 'token') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
    usersRepo.findOne.mockReset();
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
    expect(res.accessToken).toBe('token');
    expect(res.user.isAnonymous).toBe(true);
  });
});
