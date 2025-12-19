import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building, District, BuildingType } from './building.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class CityService {
  private readonly INCOME_CAP = 10000;

  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    private usersService: UsersService,
  ) {}

  async getCity(userId: string): Promise<Building[]> {
    return this.buildingsRepository.find({ where: { userId } });
  }

  async collectIncome(userId: string, buildingId: string): Promise<number> {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new Error('Здание не найдено');
    }

    const now = new Date();
    const lastCollected = building.lastCollectedAt || building.createdAt;
    const hoursPassed = (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60);
    const incomePerHour = Number(building.incomePerHour || 0);
    const accumulated = Number(building.accumulatedIncome || 0);
    const income = Math.min(
      Math.floor(incomePerHour * hoursPassed),
      this.INCOME_CAP - accumulated,
    );

    building.accumulatedIncome = (BigInt(building.accumulatedIncome || 0) + BigInt(income)).toString();
    building.lastCollectedAt = now;
    await this.buildingsRepository.save(building);

    const user = await this.usersService.findOne(userId);
    user.narCoin = BigInt(user.narCoin || 0) + BigInt(income);
    await this.usersService['usersRepository'].save(user);

    return income;
  }

  async upgradeBuilding(userId: string, buildingId: string): Promise<Building> {
    const building = await this.buildingsRepository.findOne({
      where: { id: buildingId, userId },
    });

    if (!building) {
      throw new Error('Здание не найдено');
    }

    const upgradeCost = building.level * 1000;
    const user = await this.usersService.findOne(userId);

    if (Number(user.narCoin) < upgradeCost) {
      throw new Error('Недостаточно NAR-coin');
    }

    user.narCoin = BigInt(user.narCoin || 0) - BigInt(upgradeCost);
    await this.usersService['usersRepository'].save(user);

    building.level++;
    building.incomePerHour = (BigInt(building.incomePerHour || 0) * BigInt(120) / BigInt(100)).toString();
    return this.buildingsRepository.save(building);
  }

  async getDistricts(): Promise<any[]> {
    // Возвращаем список всех 7 районов
    const districts = Object.values(District);
    return districts.map((district, index) => ({
      id: district,
      name: this.getDistrictName(district),
      owner: null, // Здесь должна быть логика определения владельца
      status: 'free' as const,
      incomePerDay: (index + 1) * 200,
      level: 1,
    }));
  }

  async getUserBuildings(userId: string): Promise<Building[]> {
    return this.buildingsRepository.find({ where: { userId } });
  }

  async captureDistrict(userId: string, districtId: string): Promise<void> {
    // Логика захвата района (требует реализации кланов)
    // Пока заглушка
  }

  private getDistrictName(district: District): string {
    const names: Record<District, string> = {
      [District.DISTRICT_1]: 'Центральный',
      [District.DISTRICT_2]: 'Восточный порт',
      [District.DISTRICT_3]: 'Старый квартал',
      [District.DISTRICT_4]: 'Спальный',
      [District.DISTRICT_5]: 'Пригород',
      [District.DISTRICT_6]: 'Промышленный',
      [District.DISTRICT_7]: 'Деловой',
    };
    return names[district] || district;
  }

  async initializeCity(userId: string): Promise<void> {
    const districts = Object.values(District);
    const buildingTypes = Object.values(BuildingType);

    for (let i = 0; i < districts.length; i++) {
      const building = this.buildingsRepository.create({
        userId,
        district: districts[i],
        type: buildingTypes[i % buildingTypes.length],
        level: 1,
        incomePerHour: (100 * (i + 1)).toString(),
      });
      await this.buildingsRepository.save(building);
    }
  }
}

