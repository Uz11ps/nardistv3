import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err) {
      console.error('❌ JWT Auth Guard ошибка:', err);
      throw err;
    }
    
    if (!user) {
      console.error('❌ JWT Auth Guard: пользователь не найден после валидации');
      throw new UnauthorizedException('Не авторизован: пользователь не найден');
    }
    
    if (!user.id) {
      console.error('❌ JWT Auth Guard: пользователь не имеет ID:', user);
      throw new UnauthorizedException('Не авторизован: пользователь не имеет ID');
    }
    
    console.log('✅ JWT Auth Guard: пользователь валидирован:', { userId: user.id, username: user.username, isGuest: user.isGuest });
    
    // Дополнительная проверка бана (на случай если пользователь обошел проверку в strategy)
    if (user.isBanned) {
      const reason = user.banReason || 'Нарушение правил';
      throw new UnauthorizedException(`Вы были забанены по причине: ${reason}`);
    }
    
    return user;
  }
}

