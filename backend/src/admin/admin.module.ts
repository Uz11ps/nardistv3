import { Module, forwardRef } from '@nestjs/common';
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
import { ProgressModule } from '../progress/progress.module';
import { HistoryModule } from '../history/history.module';
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
import { ClanTreasuryTransaction } from '../clans/clan-treasury-transaction.entity';
import { Subscription } from '../subscription/subscription.entity';
import { BuildingConfig } from '../city/building-config.entity';
import { Building } from '../city/building.entity';
import { DistrictConfig } from '../city/district-config.entity';
import { Rating } from '../ratings/rating.entity';
import { Notification } from '../notifications/notification.entity';
import { UserMaterial } from '../academy/user-material.entity';
import { CourseTask } from '../academy/course-task.entity';
import { CourseTaskProgress } from '../academy/course-task-progress.entity';
import { SystemSettings } from './system-settings.entity';
import { NotificationTemplate } from './notification-template.entity';
import { InactiveUsersService } from './inactive-users.service';
import { ImageProcessorService } from './image-processor.service';
import { QuestProgress } from '../quests/quest-progress.entity';
import { PaymentModule } from '../payment/payment.module';
import { UserWallet } from '../payment/user-wallet.entity';
import { PaymentTransaction } from '../payment/payment-transaction.entity';
import { ProgressionConfig } from '../progress/progression-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Game, GameMove, Tournament, Article, Skin, UserSkin, Quest, QuestProgress, Clan, ClanMember, ClanTreasuryTransaction, Subscription, BuildingConfig, Building, DistrictConfig, Rating, Notification, UserMaterial, CourseTask, CourseTaskProgress, SystemSettings, NotificationTemplate, UserWallet, PaymentTransaction, ProgressionConfig]),
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
    forwardRef(() => AcademyModule),
    SkinsModule,
    GamesModule,
    QuestsModule,
    ClansModule,
    SubscriptionModule,
    NotificationsModule,
    ProgressModule,
    HistoryModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, InactiveUsersService, ImageProcessorService],
  exports: [AdminService],
})
export class AdminModule {}

