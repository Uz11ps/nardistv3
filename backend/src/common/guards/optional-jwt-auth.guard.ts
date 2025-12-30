import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // В отличие от стандартного Guard, здесь мы не выбрасываем ошибку если пользователь не найден
    // Мы просто возвращаем null вместо пользователя
    if (err || !user) {
      return null;
    }
    
    // Проверка на админа не требуется для опциональной авторизации, 
    // так как это публичный эндпоинт, где админский токен просто будет проигнорирован или обработан как обычный user (если структура совпадает)
    // Но если структура User у админа отличается и может вызвать ошибки в контроллере, стоит это учесть.
    // В данном проекте user.id = 'admin' для админа.
    
    return user;
  }
}

