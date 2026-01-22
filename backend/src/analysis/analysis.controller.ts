import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * Запуск анализа игры (асинхронный)
   * Возвращает jobId для отслеживания статуса
   */
  @Post('game/:gameId')
  @UseGuards(JwtAuthGuard)
  async startAnalysis(@CurrentUser() user: any, @Param('gameId') gameId: string) {
    return this.analysisService.analyzeGame(user.id, gameId);
  }

  /**
   * Получение статуса анализа
   */
  @Get('status/:jobId')
  @UseGuards(JwtAuthGuard)
  async getAnalysisStatus(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    return this.analysisService.getAnalysisStatus(jobId, user.id);
  }

  /**
   * Получение результата анализа (если готов)
   */
  @Get('result/:jobId')
  @UseGuards(JwtAuthGuard)
  async getAnalysisResult(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    return this.analysisService.getAnalysisResult(jobId, user.id);
  }

  /**
   * Статистика очереди анализа (для админов)
   */
  @Get('queue/stats')
  @UseGuards(JwtAuthGuard)
  async getQueueStats(@CurrentUser() user: any) {
    return this.analysisService.getQueueStats();
  }

  /**
   * Старый эндпоинт для обратной совместимости
   * @deprecated Используйте POST /analysis/game/:gameId и GET /analysis/status/:jobId
   */
  @Get('game/:gameId')
  @UseGuards(JwtAuthGuard)
  async analyzeGame(@CurrentUser() user: any, @Param('gameId') gameId: string) {
    // Запускаем анализ и сразу возвращаем статус
    const { jobId } = await this.analysisService.analyzeGame(user.id, gameId);
    return this.analysisService.getAnalysisStatus(jobId, user.id);
  }
}

