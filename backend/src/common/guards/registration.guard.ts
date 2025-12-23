import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

/**
 * Guard для проверки, что пользователь получил стартовый набор (считается зарегистрированным)
 * Пользователь не считается зарегистрированным пока он не получил стартовый набор
 */
@Injectable()
export class RegistrationGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    const userEntity = await this.usersService.findOne(user.id);
    
    if (!userEntity.starterKitClaimed) {
      throw new ForbiddenException('Для доступа к этому функционалу необходимо получить стартовый набор. Завершите регистрацию в разделе онбординга.');
    }

    return true;
  }
}

