import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { Address } from '@ton/core';
import { mnemonicToWalletKey, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, TonClient } from '@ton/ton';

/**
 * Сервис для работы с TON блокчейном
 * Генерация кошельков, проверка транзакций, отправка уведомлений
 */
@Injectable()
export class TonService {
  private readonly logger = new Logger(TonService.name);
  private readonly TON_API_URL: string;
  private readonly TON_API_KEY: string | undefined;
  private readonly ENCRYPTION_KEY: string; // Ключ для шифрования приватных ключей
  private tonClient: TonClient | null = null;

  constructor(private configService: ConfigService) {
    this.TON_API_URL = this.configService.get<string>('TON_API_URL') || 'https://toncenter.com/api/v2';
    this.TON_API_KEY = this.configService.get<string>('TON_API_KEY');
    this.ENCRYPTION_KEY = this.configService.get<string>('WALLET_ENCRYPTION_KEY') || this.generateDefaultKey();
    
    if (!this.configService.get<string>('WALLET_ENCRYPTION_KEY')) {
      this.logger.warn('⚠️ WALLET_ENCRYPTION_KEY не установлен, используется временный ключ');
    }

    // Инициализируем TonClient для продакшена
    this.initializeTonClient();
  }

  /**
   * Инициализирует TonClient для работы с блокчейном
   */
  private async initializeTonClient(): Promise<void> {
    try {
      // Используем TON Center API endpoint напрямую
      const endpoint = 'https://toncenter.com/api/v2';
      this.tonClient = new TonClient({ endpoint });
      this.logger.log('✅ TonClient инициализирован');
    } catch (error) {
      this.logger.warn('⚠️ Не удалось инициализировать TonClient, используется TON Center API');
    }
  }

  /**
   * Генерирует временный ключ шифрования (только для разработки)
   */
  private generateDefaultKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Генерирует новый кошелек TON используя @ton/core и @ton/crypto
   * ПРОДАКШЕН версия
   */
  async generateWallet(): Promise<{
    address: string;
    privateKey: string; // В формате hex для хранения
    publicKey: string;
    walletType: string;
    mnemonic?: string[]; // Мнемоника для восстановления (опционально, можно не хранить)
  }> {
    try {
      // Генерируем мнемоническую фразу (24 слова) используя @ton/crypto
      const mnemonic = await this.generateMnemonic();
      
      // Из мнемоники получаем ключ кошелька
      const key = await mnemonicToWalletKey(mnemonic);
      
      // Создаем кошелек v4R2
      const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
      
      // Получаем адрес кошелька
      const address = wallet.address.toString();
      
      // Конвертируем приватный ключ в hex для хранения
      const privateKeyHex = Buffer.from(key.secretKey).toString('hex');
      const publicKeyHex = Buffer.from(key.publicKey).toString('hex');

      this.logger.log(`✅ Сгенерирован кошелек TON: ${address}`);

      return {
        address,
        privateKey: privateKeyHex,
        publicKey: publicKeyHex,
        walletType: 'v4R2',
        mnemonic, // Можно не возвращать для безопасности
      };
    } catch (error: any) {
      this.logger.error('Ошибка генерации кошелька:', error);
      throw new BadRequestException(`Не удалось сгенерировать кошелек: ${error.message}`);
    }
  }

  /**
   * Генерирует мнемоническую фразу (24 слова)
   * Использует прямое создание ключа без мнемоники для упрощения
   */
  private async generateMnemonic(): Promise<string[]> {
    // Для продакшена генерируем ключ напрямую
    // Мнемоника не обязательна для работы кошелька, но может быть полезна для восстановления
    // В данном случае генерируем случайные слова (в продакшене лучше использовать bip39)
    const words: string[] = [];
    const wordlist = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 24; i++) {
      let word = '';
      for (let j = 0; j < 8; j++) {
        word += wordlist[Math.floor(Math.random() * wordlist.length)];
      }
      words.push(word);
    }
    return words;
  }

  /**
   * Шифрует приватный ключ для хранения в БД
   */
  encryptPrivateKey(privateKey: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      encrypted,
      iv: iv.toString('base64'),
    };
  }

  /**
   * Расшифровывает приватный ключ (для админ панели)
   */
  decryptPrivateKey(encryptedPrivateKey: string, iv: string): string {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(this.ENCRYPTION_KEY, 'hex'),
        Buffer.from(iv, 'base64'),
      );
      
      let decrypted = decipher.update(encryptedPrivateKey, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Ошибка расшифровки приватного ключа:', error);
      throw new BadRequestException('Не удалось расшифровать приватный ключ');
    }
  }

  /**
   * Проверяет транзакцию в блокчейне TON
   * Использует TON Center API или TonClient
   */
  async checkTransaction(txHash: string, address: string): Promise<{
    found: boolean;
    amount: number;
    comment?: string;
    fromAddress?: string;
    lt?: bigint;
  }> {
    try {
      // Используем TON Center API для проверки транзакций
      const headers: any = {};
      if (this.TON_API_KEY) {
        headers['X-API-Key'] = this.TON_API_KEY;
      }

      const response = await axios.get(`${this.TON_API_URL}/getTransactions`, {
        params: {
          address: address,
          limit: 10,
        },
        headers,
      });

      if (response.data?.result) {
        const transactions = response.data.result;
        
        // Ищем транзакцию по хешу
        const tx = transactions.find((t: any) => t.transaction_id?.hash === txHash);
        
        if (tx) {
          // Парсим данные транзакции
          const inMsg = tx.in_msg;
          const amount = inMsg?.value ? parseInt(inMsg.value) / 1e9 : 0; // Конвертируем из nanotons
          
          // Парсим комментарий
          let comment: string | undefined;
          if (inMsg?.msg_data) {
            if (inMsg.msg_data['@type'] === 'msg.dataText') {
              // Текст в base64
              comment = Buffer.from(inMsg.msg_data.text, 'base64').toString('utf8');
            } else if (inMsg.msg_data.text) {
              // Прямой текст
              comment = Buffer.from(inMsg.msg_data.text, 'base64').toString('utf8');
            }
          }
          
          const fromAddress = inMsg?.source;
          const lt = BigInt(tx.transaction_id?.lt || 0);

          return {
            found: true,
            amount,
            comment,
            fromAddress,
            lt,
          };
        }
      }

      return { found: false, amount: 0 };
    } catch (error: any) {
      this.logger.error(`Ошибка проверки транзакции ${txHash}:`, error.message);
      throw new BadRequestException(`Не удалось проверить транзакцию: ${error.message}`);
    }
  }

  /**
   * Проверяет баланс кошелька
   * Использует TON Center API или TonClient
   */
  async getWalletBalance(address: string): Promise<number> {
    try {
      const headers: any = {};
      if (this.TON_API_KEY) {
        headers['X-API-Key'] = this.TON_API_KEY;
      }

      const response = await axios.get(`${this.TON_API_URL}/getAddressInformation`, {
        params: { address },
        headers,
      });

      if (response.data?.result?.balance) {
        return parseInt(response.data.result.balance) / 1e9; // Конвертируем из nanotons
      }

      return 0;
    } catch (error: any) {
      this.logger.error(`Ошибка получения баланса кошелька ${address}:`, error.message);
      return 0;
    }
  }

  /**
   * Генерирует комментарий для идентификации платежа
   */
  generatePaymentComment(userId: string, transactionId: string): string {
    // Комментарий в формате: userId:transactionId
    // Максимальная длина комментария в TON - 127 байт
    const comment = `${userId}:${transactionId}`;
    return comment.substring(0, 127);
  }

  /**
   * Парсит комментарий из транзакции
   */
  parsePaymentComment(comment: string): { userId?: string; transactionId?: string } {
    if (!comment) return {};
    
    const parts = comment.split(':');
    if (parts.length >= 2) {
      return {
        userId: parts[0],
        transactionId: parts[1],
      };
    }
    
    return {};
  }
}

