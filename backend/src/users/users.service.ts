import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.users.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  createAnonymous(nickname?: string) {
    return this.users.save(
      this.users.create({
        email: null,
        passwordHash: null,
        nickname: nickname ?? `访客${Math.random().toString(36).slice(2, 8)}`,
        isAnonymous: true,
      }),
    );
  }

  create(email: string, passwordHash: string, nickname: string) {
    return this.users.save(
      this.users.create({ email, passwordHash, nickname, isAnonymous: false }),
    );
  }
}
