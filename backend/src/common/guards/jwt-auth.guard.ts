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
    
    // Проверяем, что это не админ (для обычных эндпоинтов админ не должен проходить)
    if (user.id === 'admin' && user.isAdmin) {
      console.error('❌ JWT Auth Guard: попытка использовать админский токен в обычном эндпоинте');
      throw new UnauthorizedException('Админский токен не может быть использован в этом эндпоинте');
    }
    
    if (!user.id) {
      console.error('❌ JWT Auth Guard: пользователь не имеет ID:', user);
      throw new UnauthorizedException('Не авторизован: пользователь не имеет ID');
    }
    
    // Проверяем, что ID является валидным UUID (не 'admin')
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user.id)) {
      console.error('❌ JWT Auth Guard: ID пользователя не является валидным UUID:', user.id);
      throw new UnauthorizedException('Не авторизован: невалидный ID пользователя');
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

