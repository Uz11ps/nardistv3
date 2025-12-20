import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building, District, BuildingType } from './building.entity';
import { UsersService } from '../users/users.service';
import { ClansService } from '../clans/clans.service';

@Injectable()
export class CityService {
  private readonly INCOME_CAP = 10000;

  constructor(
    @InjectRepository(Building)
    private buildingsRepository: Repository<Building>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ClansService))
    private clansService: ClansService,
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
    const hoursPassed = Math.max(0, (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60));
    
    // Получаем настройки района из админки (или используем дефолтные)
    const districtConfig = await this.getDistrictConfig(building.district);
    const incomePerHour = Number(building.incomePerHour || districtConfig.incomePerHour);
    const maxAccumulation = districtConfig.maxAccumulation || this.INCOME_CAP;
    
    const accumulated = Number(building.accumulatedIncome || 0);
    
    // Вычисляем доход за прошедшее время
    const calculatedIncome = Math.floor(incomePerHour * hoursPassed);
    
    // Доход не может превысить максимальное накопление
    const income = Math.min(calculatedIncome, maxAccumulation - accumulated);
    
    if (income <= 0) {
      return 0;
    }

    // Обновляем накопленный доход
    building.accumulatedIncome = (BigInt(building.accumulatedIncome || 0) + BigInt(income)).toString();
    building.lastCollectedAt = now;
    await this.buildingsRepository.save(building);

    // Начисляем пользователю
    const user = await this.usersService.findOne(userId);
    user.narCoin = BigInt(user.narCoin || 0) + BigInt(income);
    await this.usersService['usersRepository'].save(user);

    return income;
  }

  private async getDistrictConfig(district: District): Promise<{ incomePerHour: number; maxAccumulation: number }> {
    // Дефолтные значения для каждого района
    const configs: Record<District, { incomePerHour: number; maxAccumulation: number }> = {
      [District.DISTRICT_1]: { incomePerHour: 10, maxAccumulation: 240 },
      [District.DISTRICT_2]: { incomePerHour: 15, maxAccumulation: 360 },
      [District.DISTRICT_3]: { incomePerHour: 20, maxAccumulation: 480 },
      [District.DISTRICT_4]: { incomePerHour: 25, maxAccumulation: 600 },
      [District.DISTRICT_5]: { incomePerHour: 30, maxAccumulation: 720 },
      [District.DISTRICT_6]: { incomePerHour: 40, maxAccumulation: 960 },
      [District.DISTRICT_7]: { incomePerHour: 50, maxAccumulation: 1200 },
    };
    
    return configs[district] || { incomePerHour: 10, maxAccumulation: 240 };
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
    const districts = Object.values(District);
    
    // Получаем все кланы с их районами
    const clans = await this.clansService.findAll({});
    
    const districtsData = await Promise.all(
      districts.map(async (district, index) => {
        // Находим клан, который владеет этим районом
        const ownerClan = clans.find((clan) => 
          clan.ownedDistricts && clan.ownedDistricts.includes(district)
        );
        
        // Определяем статус и владельца
        let owner: string | null = null;
        let status: 'free' | 'stable' | 'vulnerable' = 'free';
        let vulnerabilityPercent = 0;
        
        if (ownerClan) {
          owner = ownerClan.name;
          // Если форт клана высокий, район стабилен
          if (ownerClan.fortLevel >= 5) {
            status = 'stable';
          } else {
            // Иначе район уязвим (процент уязвимости зависит от уровня форта)
            status = 'vulnerable';
            vulnerabilityPercent = Math.max(0, 10 - ownerClan.fortLevel);
          }
        }
        
        return {
          id: district,
          name: this.getDistrictName(district),
          owner,
          status,
          incomePerDay: (index + 1) * 200,
          level: 1,
          vulnerabilityPercent,
        };
      })
    );
    
    return districtsData;
  }

  async getUserBuildings(userId: string): Promise<Building[]> {
    return this.buildingsRepository.find({ where: { userId } });
  }

  async captureDistrict(userId: string, districtId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (user.level < 20) {
      throw new Error('Кланы доступны с 20 уровня');
    }

    // Проверяем что пользователь состоит в клане
    const userClan = await this.clansService.getUserClan(userId);
    if (!userClan || !userClan.clan) {
      throw new Error('Вы должны состоять в клане для захвата районов');
    }

    const clan = await this.clansService.findOne(userClan.clan.id);
    
    // Проверяем права (только лидер или офицер)
    const member = userClan.member;
    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      throw new Error('Только лидер и офицеры могут захватывать районы');
    }

    // Проверяем что район существует
    const district = districtId as District;
    if (!Object.values(District).includes(district)) {
      throw new Error('Неверный район');
    }

    // Проверяем что клан может захватить район (уровень клана, казна и т.д.)
    if (clan.level < 1) {
      throw new Error('Клан должен быть хотя бы 1 уровня');
    }

    const captureCost = 1000; // Стоимость захвата
    if (Number(clan.treasury || 0) < captureCost) {
      throw new Error('Недостаточно средств в казне клана');
    }

    // Проверяем не занят ли район другим кланом
    const allClans = await this.clansService.findAll({});
    const ownerClan = allClans.find((c) => 
      c.ownedDistricts && c.ownedDistricts.includes(district)
    );

    if (ownerClan && ownerClan.id === clan.id) {
      throw new Error('Ваш клан уже владеет этим районом');
    }

    // Если район занят другим кланом, проверяем уязвимость
    if (ownerClan) {
      // Район можно захватить только если форт клана-владельца < 5
      if (ownerClan.fortLevel >= 5) {
        throw new Error('Район защищен сильным фортом и не может быть захвачен');
      }
    }

    // Захватываем район
    if (!clan.ownedDistricts) {
      clan.ownedDistricts = [];
    }
    
    // Убираем район у предыдущего владельца
    if (ownerClan) {
      ownerClan.ownedDistricts = ownerClan.ownedDistricts.filter(d => d !== district);
      await this.clansService['clansRepository'].save(ownerClan);
    }

    // Добавляем район новому владельцу
    if (!clan.ownedDistricts.includes(district)) {
      clan.ownedDistricts.push(district);
    }

    // Списываем стоимость захвата
    clan.treasury = (BigInt(clan.treasury || 0) - BigInt(captureCost)).toString();
    
    await this.clansService['clansRepository'].save(clan);
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

