import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CityController } from './city.controller';
import { CityService } from './city.service';
import { CityAutobuildService } from './city-autobuild.service';
import { Building } from './building.entity';
import { BuildingConfig } from './building-config.entity';
import { Clan } from '../clans/clan.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { ClansModule } from '../clans/clans.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Building, BuildingConfig, Clan, User]),
    ScheduleModule.forRoot(),
    UsersModule,
    forwardRef(() => ClansModule),
  ],
  controllers: [CityController],
  providers: [CityService, CityAutobuildService],
  exports: [CityService],
})
export class CityModule {}

