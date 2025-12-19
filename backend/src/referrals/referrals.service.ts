import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class ReferralsService {
  constructor(
    private usersService: UsersService,
    private progressService: ProgressService,
  ) {}

  async useReferralCode(userId: string, referralCode: string): Promise<void> {
    const referrer = await this.usersService.findByReferralCode(referralCode);
    if (!referrer || referrer.id === userId) {
      throw new Error('Неверный реферальный код');
    }

    const user = await this.usersService.findOne(userId);
    if (user.referredBy) {
      throw new Error('Реферальный код уже использован');
    }

    user.referredBy = referrer.id;
    await this.usersService['usersRepository'].save(user);

    await this.progressService.addNarCoin(referrer.id, 500);
    await this.progressService.addXP(referrer.id, 100);
    await this.progressService.addNarCoin(userId, 200);
    await this.progressService.addXP(userId, 50);
  }

  async getReferralStats(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);
    const referredUsers = await this.usersService['usersRepository'].find({
      where: { referredBy: userId },
    });

    return {
      referralCode: user.referralCode,
      totalReferred: referredUsers.length,
      activeReferred: referredUsers.filter((u) => !u.isBanned).length,
    };
  }
}

