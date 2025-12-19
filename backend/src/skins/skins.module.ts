import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkinsService } from './skins.service';
import { SkinsController } from './skins.controller';
import { Skin } from './skin.entity';
import { UserSkin } from './user-skin.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Skin, UserSkin]), UsersModule],
  controllers: [SkinsController],
  providers: [SkinsService],
  exports: [SkinsService],
})
export class SkinsModule {}

