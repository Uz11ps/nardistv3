import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerLocation } from './player-location.entity';
import { DistrictName } from './district.entity';
import { getTravelTime } from './business-economy.config';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @InjectRepository(PlayerLocation)
    private playerLocationRepository: Repository<PlayerLocation>,
  ) {}

  /**
   * Получить текущее местоположение игрока
   */
  async getPlayerLocation(playerId: string): Promise<PlayerLocation> {
    let location = await this.playerLocationRepository.findOne({
      where: { playerId },
    });

    if (!location) {
      // Создаем начальное местоположение (Дворы)
      location = this.playerLocationRepository.create({
        playerId,
        currentDistrict: DistrictName.COURTYARDS,
      });
      location = await this.playerLocationRepository.save(location);
    }

    // Проверяем, не пришел ли игрок в целевой район
    if (location.targetDistrict && location.arrivalTime && location.arrivalTime <= new Date()) {
      location.currentDistrict = location.targetDistrict;
      location.targetDistrict = null;
      location.arrivalTime = null;
      location.startedMovingAt = null;
      await this.playerLocationRepository.save(location);
    }

    return location;
  }

  /**
   * Начать перемещение в другой район
   */
  async startTravel(playerId: string, targetDistrict: DistrictName): Promise<PlayerLocation> {
    const location = await this.getPlayerLocation(playerId);

    // Проверка, что игрок не уже в этом районе
    if (location.currentDistrict === targetDistrict) {
      throw new BadRequestException('Вы уже в этом районе');
    }

    // Проверка, что игрок не уже идет куда-то
    if (location.targetDistrict && location.arrivalTime && location.arrivalTime > new Date()) {
      throw new BadRequestException('Вы уже в пути');
    }

    // Вычисляем время перемещения
    const travelTimeMinutes = getTravelTime(location.currentDistrict, targetDistrict);
    if (travelTimeMinutes === 0) {
      throw new BadRequestException('Невозможно переместиться в этот район напрямую');
    }

    // Устанавливаем целевой район и время прибытия
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + travelTimeMinutes * 60 * 1000);

    location.targetDistrict = targetDistrict;
    location.arrivalTime = arrivalTime;
    location.startedMovingAt = now;

    return this.playerLocationRepository.save(location);
  }

  /**
   * Проверить, находится ли игрок в районе
   */
  async isPlayerInDistrict(playerId: string, district: DistrictName): Promise<boolean> {
    const location = await this.getPlayerLocation(playerId);
    return location.currentDistrict === district;
  }
}

