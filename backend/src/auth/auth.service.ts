import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshToken } from './refresh-token.entity.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: '邮箱已被注册' });
    }
    const hash = await argon2.hash(dto.password);
    const user = await this.users.create(email, hash, dto.nickname);
    return { ...(await this.issueTokens(user.id)), user: this.public(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException({ code: 'BAD_CREDENTIALS', message: '邮箱或密码错误' });
    }
    return { ...(await this.issueTokens(user.id)), user: this.public(user) };
  }

  async anonymous(nickname?: string) {
    const user = await this.users.createAnonymous(nickname);
    return { ...(await this.issueTokens(user.id)), user: this.public(user) };
  }

  async refresh(rawToken: string) {
    const token = await this.findActive(rawToken);
    token.revokedAt = new Date();
    await this.refreshTokens.save(token);
    return this.issueTokens(token.userId);
  }

  async logout(rawToken: string) {
    const token = await this.refreshTokens.findOne({ where: { tokenHash: this.hash(rawToken) } });
    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await this.refreshTokens.save(token);
    }
    return { success: true };
  }

  private async issueTokens(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokens.save({
      userId,
      tokenHash: this.hash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
    } as RefreshToken);
    return { accessToken, refreshToken };
  }

  private async findActive(rawToken: string) {
    const token = await this.refreshTokens.findOne({ where: { tokenHash: this.hash(rawToken) } });
    if (!token || token.revokedAt || token.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: '刷新令牌无效或已过期',
      });
    }
    return token;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private public(user: { id: string; email: string | null; nickname: string; isAnonymous: boolean }) {
    const { id, email, nickname, isAnonymous } = user;
    return { id, email, nickname, isAnonymous };
  }
}
