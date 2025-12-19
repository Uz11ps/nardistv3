import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkinsService } from './skins.service';
import { SkinsController } from './skins.controller';
import { Skin } from './skin.entity';
import { UserSkin } from './user-skin.entity';
import { UsersModule } from '../users/users.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Skin, UserSkin]),
    UsersModule,
    forwardRef(() => ProgressModule),
  ],
  controllers: [SkinsController],
  providers: [SkinsService],
  exports: [SkinsService],
})
export class SkinsModule {}

