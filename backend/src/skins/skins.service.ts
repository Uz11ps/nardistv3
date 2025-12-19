import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skin } from './skin.entity';
import { UserSkin } from './user-skin.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class SkinsService {
  constructor(
    @InjectRepository(Skin)
    private skinsRepository: Repository<Skin>,
    @InjectRepository(UserSkin)
    private userSkinsRepository: Repository<UserSkin>,
    private usersService: UsersService,
  ) {}

  async initializeDefaultSkins(): Promise<void> {
    const defaultSkins = [
      {
        name: 'Классический',
        theme: 'classic',
        boardConfig: { color: '#D2691E' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
      },
      {
        name: 'Темный',
        theme: 'dark',
        boardConfig: { color: '#2C2C2C' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
      },
      {
        name: 'Морской',
        theme: 'ocean',
        boardConfig: { color: '#1E90FF' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
      },
      {
        name: 'Лесной',
        theme: 'forest',
        boardConfig: { color: '#228B22' },
        diceConfig: { color: '#FFFFFF' },
        isDefault: true,
      },
    ];

    for (const skinData of defaultSkins) {
      const existing = await this.skinsRepository.findOne({
        where: { theme: skinData.theme },
      });
      if (!existing) {
        await this.skinsRepository.save(this.skinsRepository.create(skinData));
      }
    }
  }

  async getAllSkins(): Promise<Skin[]> {
    return this.skinsRepository.find();
  }

  async getUserSkins(userId: string): Promise<Skin[]> {
    const userSkins = await this.userSkinsRepository.find({
      where: { userId },
      relations: ['skin'],
    });
    return userSkins.map((us) => us.skin);
  }

  async selectSkin(userId: string, skinId: string): Promise<void> {
    await this.userSkinsRepository.update(
      { userId },
      { isSelected: false },
    );

    let userSkin = await this.userSkinsRepository.findOne({
      where: { userId, skinId },
    });

    if (!userSkin) {
      userSkin = this.userSkinsRepository.create({
        userId,
        skinId,
        isSelected: true,
      });
    } else {
      userSkin.isSelected = true;
    }

    await this.userSkinsRepository.save(userSkin);
  }

  async getSelectedSkin(userId: string): Promise<Skin | null> {
    const userSkin = await this.userSkinsRepository.findOne({
      where: { userId, isSelected: true },
      relations: ['skin'],
    });
    return userSkin ? userSkin.skin : null;
  }
}

