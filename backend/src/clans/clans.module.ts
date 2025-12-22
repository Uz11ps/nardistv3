import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClansService } from './clans.service';
import { ClansController } from './clans.controller';
import { Clan } from './clan.entity';
import { ClanMember } from './clan-member.entity';
import { ClanTreasuryTransaction } from './clan-treasury-transaction.entity';
import { DistrictConfig } from '../city/district-config.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Clan, ClanMember, ClanTreasuryTransaction, DistrictConfig]), UsersModule],
  controllers: [ClansController],
  providers: [ClansService],
  exports: [ClansService],
})
export class ClansModule {}

