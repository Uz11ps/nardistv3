import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { Address } from '@ton/core';
import { mnemonicToWalletKey, mnemonicToPrivateKey, mnemonicNew } from '@ton/crypto';
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
   */
  private async generateMnemonic(): Promise<string[]> {
    return mnemonicNew();
  }

  /**
   * Шифрует приватный ключ для хранения в БД
   */
  encryptPrivateKey(privateKey: string): { encrypted: string; iv: string } {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32); // Гарантируем 32 байта для ключа
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(privateKey, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      return {
        encrypted,
        iv: iv.toString('base64'),
      };
    } catch (error: any) {
      this.logger.error('Ошибка шифрования приватного ключа:', error);
      throw new BadRequestException(`Ошибка шифрования: ${error.message}`);
    }
  }

  /**
   * Расшифровывает приватный ключ (для админ панели)
   */
  decryptPrivateKey(encryptedPrivateKey: string, iv: string): string {
    try {
      const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32); // Гарантируем 32 байта для ключа
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        key,
        Buffer.from(iv, 'base64'),
      );
      
      let decrypted = decipher.update(encryptedPrivateKey, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      this.logger.error('Ошибка расшифровки приватного ключа:', error);
      throw new BadRequestException(`Не удалось расшифровать приватный ключ: ${error.message}`);
    }
  }

  /**
   * Проверяет транзакцию в блокчейне TON
   * Проверяет ТОЛЬКО входящие транзакции на конкретный адрес кошелька
   */
  async checkTransaction(txHash: string, address: string, expectedAmount?: number, expectedComment?: string): Promise<{
    found: boolean;
    amount: number;
    comment?: string;
    fromAddress?: string;
    lt?: bigint;
  }> {
    try {
      // Нормализуем хеш (убираем префиксы, приводим к нижнему регистру)
      const normalizedHash = txHash.toLowerCase().replace(/^0x/, '').trim();
      
      // Нормализуем адрес (убираем пробелы)
      const normalizedAddress = address.trim();
      
      this.logger.log(`🔍 Проверка транзакции на кошельке ${normalizedAddress}: hash=${normalizedHash}, expectedAmount=${expectedAmount}, expectedComment=${expectedComment}`);
      
      // Используем TON Center API для проверки транзакций ТОЛЬКО на этом адресе
      const headers: any = {};
      if (this.TON_API_KEY) {
        headers['X-API-Key'] = this.TON_API_KEY;
      }

      // Получаем транзакции ТОЛЬКО для этого адреса (входящие)
      const response = await axios.get(`${this.TON_API_URL}/getTransactions`, {
        params: {
          address: normalizedAddress, // Адрес получателя (наш кошелек)
          limit: 100, // Увеличиваем лимит для надежности
        },
        headers,
      });

      if (!response.data?.result || !Array.isArray(response.data.result)) {
        this.logger.warn(`⚠️ API не вернул массив транзакций для адреса ${normalizedAddress}`);
        return { found: false, amount: 0 };
      }

      const transactions = response.data.result;
      this.logger.log(`📊 Найдено ${transactions.length} транзакций на кошельке ${normalizedAddress}`);
      
      // Фильтруем только входящие транзакции (где есть in_msg и destination совпадает с нашим адресом)
      const incomingTransactions = transactions.filter((t: any) => {
        // Проверяем, что это входящая транзакция
        const hasInMsg = t.in_msg && t.in_msg.destination === normalizedAddress;
        return hasInMsg;
      });
      
      this.logger.log(`📥 Найдено ${incomingTransactions.length} входящих транзакций на кошельке ${normalizedAddress}`);
      
      // Ищем транзакцию по хешу (пробуем разные форматы)
      let tx = incomingTransactions.find((t: any) => {
        const hash = t.transaction_id?.hash;
        if (!hash) return false;
        const normalizedTxHash = String(hash).toLowerCase().replace(/^0x/, '').trim();
        return normalizedTxHash === normalizedHash;
      });
      
      // Если не нашли по хешу, ищем по сумме и комментарию (если указаны)
      if (!tx && expectedAmount && expectedComment) {
        this.logger.log(`🔍 Транзакция не найдена по хешу, ищем по сумме и комментарию на кошельке ${normalizedAddress}...`);
        
        for (const t of incomingTransactions) {
          const inMsg = t.in_msg;
          if (!inMsg || inMsg.destination !== normalizedAddress) continue;
          
          const amount = inMsg?.value ? parseInt(inMsg.value) / 1e9 : 0;
          
          // Проверяем сумму (с небольшой погрешностью)
          const amountDiff = Math.abs(amount - expectedAmount);
          if (amountDiff > 0.01) continue; // Разница больше 0.01 TON
          
          // Парсим комментарий
          let comment: string | undefined;
          if (inMsg?.msg_data) {
            if (inMsg.msg_data['@type'] === 'msg.dataText') {
              try {
                comment = Buffer.from(inMsg.msg_data.text, 'base64').toString('utf8');
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            } else if (inMsg.msg_data.text) {
              try {
                comment = Buffer.from(inMsg.msg_data.text, 'base64').toString('utf8');
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            }
          }
          
          // Проверяем комментарий
          if (comment && comment.includes(expectedComment)) {
            this.logger.log(`✅ Транзакция найдена по сумме и комментарию на кошельке ${normalizedAddress}: amount=${amount}, comment=${comment}`);
            tx = t;
            break;
          }
        }
      }
      
      if (tx) {
        // Парсим данные транзакции
        const inMsg = tx.in_msg;
        if (!inMsg || inMsg.destination !== normalizedAddress) {
          this.logger.warn(`⚠️ Транзакция найдена, но destination не совпадает с адресом кошелька`);
          return { found: false, amount: 0 };
        }
        
        const amount = inMsg?.value ? parseInt(inMsg.value) / 1e9 : 0; // Конвертируем из nanotons
        
        // Парсим комментарий
        let comment: string | undefined;
        if (inMsg?.msg_data) {
          if (inMsg.msg_data['@type'] === 'msg.dataText') {
            try {
              comment = Buffer.from(inMsg.msg_data.text, 'base64').toString('utf8');
            } catch (e) {
              this.logger.warn(`⚠️ Не удалось распарсить комментарий из msg.dataText`);
            }
          } else if (inMsg.msg_data.text) {
            try {
              comment = Buffer.from(inMsg.msg_data.text, 'base64').toString('utf8');
            } catch (e) {
              this.logger.warn(`⚠️ Не удалось распарсить комментарий из text`);
            }
          }
        }
        
        const fromAddress = inMsg?.source;
        const lt = BigInt(tx.transaction_id?.lt || 0);
        const foundHash = tx.transaction_id?.hash;

        this.logger.log(`✅ Транзакция найдена на кошельке ${normalizedAddress}: hash=${foundHash}, amount=${amount}, from=${fromAddress}, comment=${comment}`);

        return {
          found: true,
          amount,
          comment,
          fromAddress,
          lt,
        };
      } else {
        this.logger.warn(`⚠️ Транзакция не найдена на кошельке ${normalizedAddress} по хешу ${normalizedHash}`);
      }

      return { found: false, amount: 0 };
    } catch (error: any) {
      this.logger.error(`❌ Ошибка проверки транзакции ${txHash} на кошельке ${address}:`, error.message);
      this.logger.error(`❌ Stack trace:`, error.stack);
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

