import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalysisWorkerService } from './analysis-worker.service';

@Controller()
export class AnalysisWorkerController {
  constructor(private readonly analysisService: AnalysisWorkerService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return { status: 'ok', service: 'analysis-worker' };
  }

  @Post('api/analysis/task')
  @HttpCode(HttpStatus.ACCEPTED)
  async analyzeGame(@Body() body: { gameId: string; userId: string }) {
    const { gameId, userId } = body;
    const jobId = await this.analysisService.startAnalysis(gameId, userId);
    return {
      jobId,
      status: 'pending',
    };
  }

  @Get('api/analysis/status/:jobId')
  async getAnalysisStatus(@Param('jobId') jobId: string) {
    return this.analysisService.getAnalysisStatus(jobId);
  }

  @Get('api/analysis/result/:jobId')
  async getAnalysisResult(@Param('jobId') jobId: string) {
    return this.analysisService.getAnalysisResult(jobId);
  }
}

