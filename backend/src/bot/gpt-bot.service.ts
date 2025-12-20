import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class GptBotService {
  private readonly logger = new Logger(GptBotService.name);
  private readonly apiKey: string;
  private readonly proxyUrl: string;
  private readonly axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    
    // Прокси для России: 141.11.169.175:58481:JCQ1RM2Z:SV6CLQ29
    const proxyHost = '141.11.169.175';
    const proxyPort = '58481';
    const proxyUser = 'JCQ1RM2Z';
    const proxyPass = 'SV6CLQ29';
    this.proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
    
    // Создаем axios instance с прокси
    const httpsAgent = new HttpsProxyAgent(this.proxyUrl);
    
    this.axiosInstance = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      httpsAgent,
      timeout: 30000,
    });
  }

  /**
   * Получает ход от GPT для длинных нард
   */
  async getMoveFromGPT(
    gameState: any,
    dice: number[],
    mode: 'short' | 'long',
  ): Promise<Array<{ from: number; to: number; die: number }>> {
    if (!this.apiKey) {
      this.logger.warn('OpenAI API key not configured, falling back to simple bot');
      return [];
    }

    try {
      const boardDescription = this.describeBoard(gameState, mode);
      const prompt = this.buildPrompt(boardDescription, dice, mode);

      const response = await this.axiosInstance.post('/chat/completions', {
        model: 'gpt-4o-mini', // Используем более дешевую модель
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по нардам. Отвечай только валидными JSON ходами в формате: {"moves": [{"from": число, "to": число, "die": число}]}. Не добавляй объяснений.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const content = response.data.choices[0]?.message?.content || '';
      const moves = this.parseGPTResponse(content);
      
      this.logger.log(`GPT returned ${moves.length} moves`);
      return moves;
    } catch (error: any) {
      this.logger.error(`GPT API error: ${error.message}`, error.stack);
      return []; // Возвращаем пустой массив, чтобы использовать простого бота
    }
  }

  private describeBoard(gameState: any, mode: 'short' | 'long'): string {
    const points = gameState.points || [];
    const bar = gameState.bar || [0, 0];
    const borneOff = gameState.borneOff || [0, 0];
    const currentPlayer = gameState.currentPlayer || 0;

    let description = `Режим: ${mode === 'long' ? 'длинные' : 'короткие'} нарды. `;
    description += `Текущий игрок: ${currentPlayer === 0 ? 'белые' : 'черные'}. `;
    description += `На баре: белые=${bar[0] || bar.white || 0}, черные=${bar[1] || bar.black || 0}. `;
    description += `Вынесено: белые=${borneOff[0] || borneOff.white || 0}, черные=${borneOff[1] || borneOff.black || 0}. `;
    description += 'Точки (1-24, где 1-6 дом белых, 19-24 дом черных): ';

    for (let i = 0; i < 24; i++) {
      const value = points[i] || 0;
      if (value !== 0) {
        const color = value > 0 ? 'белые' : 'черные';
        const count = Math.abs(value);
        description += `точка ${i + 1}: ${count} ${color}, `;
      }
    }

    return description;
  }

  private buildPrompt(boardDescription: string, dice: number[], mode: 'short' | 'long'): string {
    return `${boardDescription}
Кубики: ${dice.join(', ')}.
Выбери лучший ход. Ответь только JSON: {"moves": [{"from": число от -1 до 23, "to": число от -1 до 24, "die": число из кубиков}]}.
Если фишки на баре (bar > 0), from должен быть -1.
Если вынос (bear off), to должен быть -1 для белых или 24 для черных.
Используй все доступные кубики.`;
  }

  private parseGPTResponse(content: string): Array<{ from: number; to: number; die: number }> {
    try {
      // Пытаемся найти JSON в ответе
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.moves || !Array.isArray(parsed.moves)) {
        return [];
      }

      return parsed.moves.map((move: any) => ({
        from: parseInt(move.from, 10),
        to: parseInt(move.to, 10),
        die: parseInt(move.die, 10),
      }));
    } catch (error) {
      this.logger.error(`Failed to parse GPT response: ${content}`, error);
      return [];
    }
  }
}

