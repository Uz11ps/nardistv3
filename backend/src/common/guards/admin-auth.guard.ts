import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class AdminAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err) {
      console.error('❌ Admin Auth Guard ошибка:', err);
      throw err;
    }
    
    if (!user) {
      console.error('❌ Admin Auth Guard: пользователь не найден после валидации');
      throw new UnauthorizedException('Не авторизован: пользователь не найден');
    }
    
    // Для админских эндпоинтов проверяем, что это админ
    if (!user.isAdmin || user.id !== 'admin') {
      console.error('❌ Admin Auth Guard: недостаточно прав. Пользователь:', user);
      throw new UnauthorizedException('Недостаточно прав для доступа к админ-панели');
    }
    
    console.log('✅ Admin Auth Guard: админ валидирован:', { userId: user.id, login: user.login });
    
    return user;
  }
}

