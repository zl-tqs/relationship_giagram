import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: '邮箱已被注册' });
    }
    const hash = await argon2.hash(dto.password);
    const user = await this.users.create(email, hash, dto.nickname);
    return { accessToken: this.sign(user.id), user: this.public(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException({ code: 'BAD_CREDENTIALS', message: '邮箱或密码错误' });
    }
    return { accessToken: this.sign(user.id), user: this.public(user) };
  }

  async anonymous(nickname?: string) {
    const user = await this.users.createAnonymous(nickname);
    return { accessToken: this.sign(user.id), user: this.public(user) };
  }

  private sign(userId: string) {
    // V1 无刷新令牌机制，有效期放宽至 7 天；后续版本引入 refresh token 后恢复短时效
    return this.jwt.sign({ sub: userId }, { expiresIn: '7d' });
  }

  private public(user: { id: string; email: string | null; nickname: string; isAnonymous: boolean }) {
    const { id, email, nickname, isAnonymous } = user;
    return { id, email, nickname, isAnonymous };
  }
}
