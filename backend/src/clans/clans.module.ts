import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClansService } from './clans.service';
import { ClansController } from './clans.controller';
import { Clan } from './clan.entity';
import { ClanMember } from './clan-member.entity';
import { ClanTreasuryTransaction } from './clan-treasury-transaction.entity';
import { DistrictConfig } from '../city/district-config.entity';
import { DistrictCapture } from '../city/district-capture.entity';
import { Building } from '../city/building.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { PlayerCapture } from './player-capture.entity';
import { UsersModule } from '../users/users.module';
import { CityModule } from '../city/city.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clan, ClanMember, ClanTreasuryTransaction, DistrictConfig, DistrictCapture, Building, BuildingConfig, PlayerCapture]),
    UsersModule,
    forwardRef(() => CityModule),
    NotificationsModule,
  ],
  controllers: [ClansController],
  providers: [ClansService],
  exports: [ClansService],
})
export class ClansModule {}

