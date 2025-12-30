import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { MaterialService } from './material.service';
import { LicenseService } from './license.service';
import { LocationService } from './location.service';
import { Business } from './business.entity';
import { PlayerBusiness } from './player-business.entity';
import { District } from './district.entity';
import { Material } from './material.entity';
import { PlayerMaterial } from './player-material.entity';
import { License } from './license.entity';
import { PlayerLicense } from './player-license.entity';
import { PlayerLocation } from './player-location.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      PlayerBusiness,
      District,
      Material,
      PlayerMaterial,
      License,
      PlayerLicense,
      PlayerLocation,
      User,
    ]),
    UsersModule,
  ],
  controllers: [BusinessController],
  providers: [BusinessService, MaterialService, LicenseService, LocationService],
  exports: [BusinessService, MaterialService, LicenseService, LocationService],
})
export class BusinessModule {}

