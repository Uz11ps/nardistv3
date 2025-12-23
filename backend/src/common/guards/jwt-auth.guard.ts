import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Не авторизован');
    }
    
    // Дополнительная проверка бана (на случай если пользователь обошел проверку в strategy)
    if (user.isBanned) {
      const reason = user.banReason || 'Нарушение правил';
      throw new UnauthorizedException(`Вы были забанены по причине: ${reason}`);
    }
    
    return user;
  }
}

