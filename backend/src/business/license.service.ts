import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { License, LicenseType } from './license.entity';
import { PlayerLicense } from './player-license.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(PlayerLicense)
    private playerLicenseRepository: Repository<PlayerLicense>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private usersService: UsersService,
  ) {}

  /**
   * Получить все доступные лицензии
   */
  async getAllLicenses(): Promise<License[]> {
    return this.licenseRepository.find({
      where: { isActive: true },
      order: { minLevel: 'ASC' },
    });
  }

  /**
   * Получить лицензии игрока
   */
  async getPlayerLicenses(playerId: string): Promise<PlayerLicense[]> {
    return this.playerLicenseRepository.find({
      where: { playerId },
      relations: ['license'],
    });
  }

  /**
   * Проверить, есть ли у игрока активная лицензия
   */
  async hasActiveLicense(playerId: string, licenseCode: string): Promise<boolean> {
    const license = await this.licenseRepository.findOne({ where: { code: licenseCode } });
    if (!license) {
      return false;
    }

    const playerLicense = await this.playerLicenseRepository.findOne({
      where: { playerId, licenseId: license.id },
    });

    if (!playerLicense) {
      return false;
    }

    // Для разовых лицензий всегда активна
    if (license.type === LicenseType.ONE_TIME) {
      return true;
    }

    // Для продлеваемых проверяем срок действия
    if (playerLicense.expiresAt) {
      return playerLicense.expiresAt > new Date();
    }

    return false;
  }

  /**
   * Купить лицензию
   */
  async purchaseLicense(playerId: string, licenseId: string): Promise<PlayerLicense> {
    const user = await this.userRepository.findOne({ where: { id: playerId } });
    if (!user) {
      throw new NotFoundException('Игрок не найден');
    }

    const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
    if (!license) {
      throw new NotFoundException('Лицензия не найдена');
    }

    // Проверка уровня
    if (user.level < license.minLevel) {
      throw new BadRequestException(`Требуется уровень ${license.minLevel}`);
    }

    // Проверка требуемой лицензии
    if (license.requiredLicense) {
      const hasRequired = await this.hasActiveLicense(playerId, license.requiredLicense);
      if (!hasRequired) {
        throw new BadRequestException(`Требуется лицензия: ${license.requiredLicense}`);
      }
    }

    // Проверка премиума
    // TODO: добавить проверку премиума когда будет реализовано

    // Проверка верификации
    // TODO: добавить проверку верификации когда будет реализовано

    // Проверка баланса и списание
    if (license.currency === 'NAR') {
      if (user.narCoin < BigInt(license.priceNar)) {
        throw new BadRequestException('Недостаточно NAR');
      }
      user.narCoin = user.narCoin - BigInt(license.priceNar);
      await this.userRepository.save(user);
    } else if (license.currency === 'USDT') {
      // TODO: реализовать списание USDT когда будет платежная система
      throw new BadRequestException('USDT платежи пока не реализованы');
    }

    // Проверяем, есть ли уже эта лицензия
    const existing = await this.playerLicenseRepository.findOne({
      where: { playerId, licenseId },
    });

    let playerLicense: PlayerLicense;

    if (existing) {
      // Если лицензия продлеваемая, продлеваем срок
      if (license.type === LicenseType.RENEWABLE && license.durationDays) {
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + license.durationDays);
        existing.expiresAt = newExpiresAt;
        playerLicense = await this.playerLicenseRepository.save(existing);
      } else {
        throw new BadRequestException('У вас уже есть эта лицензия');
      }
    } else {
      // Создаем новую лицензию
      const expiresAt =
        license.type === LicenseType.RENEWABLE && license.durationDays
          ? (() => {
              const date = new Date();
              date.setDate(date.getDate() + license.durationDays);
              return date;
            })()
          : null;

      playerLicense = this.playerLicenseRepository.create({
        playerId,
        licenseId,
        expiresAt,
      });
      playerLicense = await this.playerLicenseRepository.save(playerLicense);
    }

    // Обновляем флаг лицензии предпринимателя в профиле пользователя
    if (license.code === 'entrepreneur') {
      user.hasBusinessLicense = true;
      await this.userRepository.save(user);
    }

    return playerLicense;
  }
}

