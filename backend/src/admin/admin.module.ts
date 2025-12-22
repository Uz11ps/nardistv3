import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { AcademyModule } from '../academy/academy.module';
import { SkinsModule } from '../skins/skins.module';
import { GamesModule } from '../games/games.module';
import { QuestsModule } from '../quests/quests.module';
import { ClansModule } from '../clans/clans.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/user.entity';
import { Game } from '../games/game.entity';
import { GameMove } from '../games/game-move.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { Article } from '../academy/article.entity';
import { Skin } from '../skins/skin.entity';
import { UserSkin } from '../skins/user-skin.entity';
import { Quest } from '../quests/quest.entity';
import { Clan } from '../clans/clan.entity';
import { ClanMember } from '../clans/clan-member.entity';
import { Subscription } from '../subscription/subscription.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { DistrictConfig } from '../city/district-config.entity';
import { Rating } from '../ratings/rating.entity';
import { Notification } from '../notifications/notification.entity';
import { UserMaterial } from '../academy/user-material.entity';
import { SystemSettings } from './system-settings.entity';
import { NotificationTemplate } from './notification-template.entity';
import { InactiveUsersService } from './inactive-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Game, GameMove, Tournament, Article, Skin, UserSkin, Quest, Clan, ClanMember, Subscription, BuildingConfig, DistrictConfig, Rating, Notification, UserMaterial, SystemSettings, NotificationTemplate]),
    ScheduleModule.forRoot(),
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '7d',
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    TournamentsModule,
    AcademyModule,
    SkinsModule,
    GamesModule,
    QuestsModule,
    ClansModule,
    SubscriptionModule,
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, InactiveUsersService],
  exports: [AdminService],
})
export class AdminModule {}

