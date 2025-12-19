import { Module, forwardRef } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { UsersModule } from '../users/users.module';
import { ProgressModule } from '../progress/progress.module';
import { SkinsModule } from '../skins/skins.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => ProgressModule),
    SkinsModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}

