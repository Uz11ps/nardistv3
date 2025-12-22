import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ReferralsService } from '../referrals/referrals.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Controller('bot/webhook')
export class BotController {
  private readonly logger = new Logger(BotController.name);
  private readonly botToken: string;

  constructor(
    private referralsService: ReferralsService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  @Post()
  async handleWebhook(@Body() update: any) {
    try {
      // Обработка команды /start с реферальным кодом
      if (update.message?.text?.startsWith('/start')) {
        const message = update.message;
        const telegramId = message.from.id.toString();
        const text = message.text;
        
        // Извлекаем реферальный код из команды /start REFERRAL_CODE
        const parts = text.split(' ');
        const referralCode = parts.length > 1 ? parts[1] : null;

        this.logger.log(`Received /start command from ${telegramId}, referralCode: ${referralCode || 'none'}`);

        // Находим или создаем пользователя
        let user = await this.usersService.findByTelegramId(telegramId);
        
        if (!user) {
          // Новый пользователь - создаем его
          const createUserDto = {
            telegramId: telegramId,
            username: message.from.username || `user_${telegramId}`,
            firstName: message.from.first_name || '',
            lastName: message.from.last_name || '',
            languageCode: message.from.language_code || 'ru',
            avatarUrl: '', // Telegram Bot API не предоставляет photo_url в сообщениях
          };
          user = await this.usersService.create(createUserDto);
          this.logger.log(`New user created: ${user.id}`);
        }

        // Если есть реферальный код и пользователь еще не использовал реферальный код
        if (referralCode && !user.referredBy) {
          try {
            await this.referralsService.useReferralCode(user.id, referralCode);
            this.logger.log(`Referral code ${referralCode} applied for user ${user.id}`);
            
            // Отправляем сообщение пользователю
            await this.sendMessage(telegramId, '✅ Реферальный код применен! Вы получили бонусы за регистрацию.');
          } catch (error: any) {
            this.logger.warn(`Failed to apply referral code: ${error.message}`);
            // Не отправляем ошибку пользователю, чтобы не портить UX
          }
        }

        // Отправляем приветственное сообщение
        const welcomeMessage = `👋 Добро пожаловать в Nardist!\n\n` +
          `Играй в нарды, участвуй в турнирах и зарабатывай NAR-coin!\n\n` +
          `Открой приложение, чтобы начать играть:`;
        
        await this.sendMessage(telegramId, welcomeMessage);
      }

      return { ok: true };
    } catch (error: any) {
      this.logger.error(`Error handling webhook: ${error.message}`, error.stack);
      return { ok: false, error: error.message };
    }
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured, cannot send message');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      });
    } catch (error: any) {
      this.logger.error(`Failed to send message: ${error.message}`);
    }
  }
}

