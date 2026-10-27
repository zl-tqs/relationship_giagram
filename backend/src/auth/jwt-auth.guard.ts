import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'NO_TOKEN', message: '未登录' });
    }
    try {
      const payload = this.jwt.verify(auth.slice(7));
      req.user = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'BAD_TOKEN', message: '令牌无效或已过期' });
    }
  }
}
