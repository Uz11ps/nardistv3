import { Injectable, Logger, Optional } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class CloudWorkerService {
  private readonly logger = new Logger(CloudWorkerService.name);
  private readonly enabled: boolean;
  private readonly workerUrl: string;
  private readonly apiKey?: string;
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.enabled = process.env.USE_CLOUD_WORKERS === 'true';
    this.workerUrl = process.env.CLOUD_WORKER_URL || '';
    this.apiKey = process.env.CLOUD_WORKER_API_KEY;

    if (this.enabled && !this.workerUrl) {
      this.logger.warn('USE_CLOUD_WORKERS=true, but CLOUD_WORKER_URL is not set');
    }

    // Создаем HTTP клиент с таймаутом
    this.httpClient = axios.create({
      timeout: 300000, // 5 минут на анализ игры
      headers: this.apiKey ? {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      } : {
        'Content-Type': 'application/json',
      },
    });

    if (this.enabled && this.workerUrl) {
      this.logger.log(`CloudWorkerService инициализирован: ${this.workerUrl}`);
    }
  }

  /**
   * Проверка доступности облачного воркера
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled || !this.workerUrl) {
      return false;
    }

    try {
      const response = await this.httpClient.get(`${this.workerUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Cloud worker недоступен: ${error.message}`);
      return false;
    }
  }

  /**
   * Отправка задачи анализа в облако
   */
  async analyzeGame(gameId: string, userId: string): Promise<{ jobId: string; status: string }> {
    if (!this.enabled || !this.workerUrl) {
      throw new Error('Cloud workers не настроены');
    }

    try {
      const response = await this.httpClient.post(
        `${this.workerUrl}/api/analysis/task`,
        {
          gameId,
          userId,
        },
      );

      return {
        jobId: `cloud_${response.data.jobId}`, // Префикс для идентификации облачных задач
        status: response.data.status || 'pending',
      };
    } catch (error: any) {
      this.logger.error(`Ошибка отправки задачи в облако: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение статуса анализа из облака
   */
  async getAnalysisStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    result?: any;
    error?: string;
  }> {
    if (!this.enabled || !this.workerUrl) {
      throw new Error('Cloud workers не настроены');
    }

    try {
      const response = await this.httpClient.get(
        `${this.workerUrl}/api/analysis/status/${jobId}`,
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Ошибка получения статуса из облака: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение результата анализа из облака
   */
  async getAnalysisResult(jobId: string): Promise<any> {
    if (!this.enabled || !this.workerUrl) {
      throw new Error('Cloud workers не настроены');
    }

    try {
      const response = await this.httpClient.get(
        `${this.workerUrl}/api/analysis/result/${jobId}`,
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Ошибка получения результата из облака: ${error.message}`);
      throw error;
    }
  }

  /**
   * Проверка, нужно ли использовать облако для данного режима игры
   */
  shouldUseCloud(gameMode: string): boolean {
    if (!this.enabled || !this.workerUrl) {
      return false;
    }

    // Используем облако только для длинных нард (MCTS требует больше ресурсов)
    // Короткие нарды (GNU Backgammon) обрабатываем локально
    return gameMode === 'long';
  }
}

