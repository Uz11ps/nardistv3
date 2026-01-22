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
   * Evaluates pre-calculated valid moves and selects the best one using GPT
   * @param gameState Current game state
   * @param validMoves Array of valid move sequences (each sequence is an array of moves)
   * @param dice Current dice values
   * @param mode Game mode ('short' or 'long')
   * @returns Selected move sequence, or empty array if GPT fails
   */
  async evaluateMoves(
    gameState: any,
    validMoves: Array<Array<{ from: number; to: number; die: number }>>,
    dice: number[],
    mode: 'short' | 'long',
  ): Promise<Array<{ from: number; to: number; die: number }>> {
    if (!this.apiKey) {
      this.logger.warn('OpenAI API key not configured, falling back to simple bot');
      return [];
    }

    if (!validMoves || validMoves.length === 0) {
      return [];
    }

    // If only one option, return it immediately
    if (validMoves.length === 1) {
      return validMoves[0];
    }

    try {
      const boardDescription = this.describeBoard(gameState, mode);
      const movesDescription = this.describeMoves(validMoves);
      const prompt = this.buildEvaluationPrompt(boardDescription, movesDescription, dice, mode);

      const response = await this.axiosInstance.post('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по нардам. Твоя задача - выбрать лучший ход из предложенных вариантов. Отвечай только номером варианта (начиная с 0) в формате JSON: {"option": число}. Не добавляй объяснений.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      const content = response.data.choices[0]?.message?.content || '';
      const selectedIndex = this.parseGPTSelection(content, validMoves.length);
      
      if (selectedIndex >= 0 && selectedIndex < validMoves.length) {
        this.logger.log(`GPT selected option ${selectedIndex} from ${validMoves.length} options`);
        return validMoves[selectedIndex];
      } else {
        this.logger.warn(`GPT returned invalid index ${selectedIndex}, using first option`);
        return validMoves[0];
      }
    } catch (error: any) {
      this.logger.error(`GPT API error: ${error.message}`, error.stack);
      return []; // Return empty to use fallback bot
    }
  }

  /**
   * Анализ хода и позиции для аналитики игры
   * Возвращает оценку хода с объяснениями и рекомендациями
   */
  async analyzeMove(
    gameStateBefore: any,
    gameStateAfter: any,
    move: Array<{ from: number; to: number; die: number }>,
    dice: number[],
    mode: 'short' | 'long',
    bestAlternative?: Array<{ from: number; to: number; die: number }>,
  ): Promise<{
    evaluation: 'excellent' | 'good' | 'neutral' | 'inaccuracy' | 'mistake' | 'blunder';
    explanation: string;
    reasoning: string;
    recommendations?: string[];
  } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const boardBefore = this.describeBoard(gameStateBefore, mode);
      const boardAfter = this.describeBoard(gameStateAfter, mode);
      const moveDescription = this.describeMove(move);
      const bestMoveDescription = bestAlternative ? this.describeMove(bestAlternative) : null;

      const prompt = `Ты эксперт по ${mode === 'long' ? 'длинным' : 'коротким'} нардам. Проанализируй ход игрока.

ПОЗИЦИЯ ДО ХОДА:
${boardBefore}

СДЕЛАННЫЙ ХОД:
${moveDescription}
Кубики: ${dice.join(', ')}

ПОЗИЦИЯ ПОСЛЕ ХОДА:
${boardAfter}

${bestMoveDescription ? `ЛУЧШИЙ ВОЗМОЖНЫЙ ХОД (по equity):\n${bestMoveDescription}\n\n` : ''}

Проанализируй этот ход и дай оценку:
1. Оценка хода: excellent (отличный), good (хороший), neutral (нейтральный), inaccuracy (неточность), mistake (ошибка), blunder (грубая ошибка)
2. Объяснение: краткое объяснение почему ход хороший/плохой (1-2 предложения)
3. Обоснование: детальное объяснение стратегических аспектов хода (2-3 предложения)
4. Рекомендации: что можно было сделать лучше (если ход не оптимальный)

Учитывай:
- Правила ${mode === 'long' ? 'длинных нард (нельзя бить шашки)' : 'коротких нард (можно бить шашки)'}
- Стратегические факторы: распределение шашек, timing, контроль доски, безопасность
- Позиционные факторы: прима, якоря, прогресс к дому
- Риски: незащищенные шашки, шашки на баре

Ответь в формате JSON:
{
  "evaluation": "excellent|good|neutral|inaccuracy|mistake|blunder",
  "explanation": "краткое объяснение",
  "reasoning": "детальное обоснование",
  "recommendations": ["рекомендация 1", "рекомендация 2"]
}`;

      const response = await this.axiosInstance.post('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по нардам. Твоя задача - анализировать ходы и давать профессиональные оценки с объяснениями. Отвечай только в формате JSON без дополнительного текста.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.data.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in GPT analysis response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        evaluation: parsed.evaluation || 'neutral',
        explanation: parsed.explanation || '',
        reasoning: parsed.reasoning || '',
        recommendations: parsed.recommendations || [],
      };
    } catch (error: any) {
      this.logger.error(`GPT analysis error: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Описание хода в текстовом формате
   */
  private describeMove(moves: Array<{ from: number; to: number; die: number }>): string {
    if (!moves || moves.length === 0) {
      return 'Пропуск хода';
    }

    const POINT_NUMBERS = [
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13,
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ];

    const moveDescriptions = moves.map(m => {
      const fromStr = m.from === -1 ? 'бара' : `точки ${POINT_NUMBERS[m.from]}`;
      const toStr = m.to === -1 || m.to >= 24 ? 'вынос' : `точку ${POINT_NUMBERS[m.to]}`;
      return `с ${fromStr} на ${toStr}`;
    });

    return moveDescriptions.join(', ');
  }

  /**
   * Legacy method for backward compatibility - now calculates moves first, then evaluates
   */
  async getMoveFromGPT(
    gameState: any,
    dice: number[],
    mode: 'short' | 'long',
  ): Promise<Array<{ from: number; to: number; die: number }>> {
    // This method is deprecated - should use evaluateMoves with pre-calculated moves
    // But we keep it for backward compatibility
    this.logger.warn('getMoveFromGPT is deprecated, use evaluateMoves instead');
    return [];
  }

  private describeBoard(gameState: any, mode: 'short' | 'long'): string {
    const points = gameState.points || [];
    const bar = gameState.bar || [0, 0];
    const borneOff = gameState.borneOff || [0, 0];
    const currentPlayer = gameState.currentPlayer || 0;

    let description = `Режим: ${mode === 'long' ? 'длинные' : 'короткие'} нарды.\n`;
    description += `Текущий игрок: ${currentPlayer === 0 ? 'белые' : 'черные'}.\n`;
    description += `На баре: белые=${bar[0] || bar.white || 0}, черные=${bar[1] || bar.black || 0}.\n`;
    description += `Вынесено: белые=${borneOff[0] || borneOff.white || 0}, черные=${borneOff[1] || borneOff.black || 0}.\n\n`;
    description += 'Позиция на доске (точки 1-24):\n';

    // Map indices to point numbers for display
    const POINT_NUMBERS = [
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, // Top row (indices 0-11)
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, // Bottom row (indices 12-23)
    ];

    for (let i = 0; i < 24; i++) {
      const value = points[i] || 0;
      if (value !== 0) {
        const color = value > 0 ? 'белые' : 'черные';
        const count = Math.abs(value);
        const pointNum = POINT_NUMBERS[i];
        description += `Точка ${pointNum} (индекс ${i}): ${count} ${color}\n`;
      }
    }

    return description;
  }

  private describeMoves(validMoves: Array<Array<{ from: number; to: number; die: number }>>): string {
    const POINT_NUMBERS = [
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13,
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ];

    let description = 'Доступные варианты ходов:\n\n';
    
    validMoves.forEach((moveSeq, index) => {
      description += `Вариант ${index}:\n`;
      if (moveSeq.length === 0) {
        description += '  Пропуск хода\n';
      } else {
        moveSeq.forEach((move, moveIndex) => {
          const fromStr = move.from === -1 ? 'бар' : `точка ${POINT_NUMBERS[move.from]}`;
          const toStr = move.to === -1 ? 'вынос' : (move.to >= 0 && move.to < 24 ? `точка ${POINT_NUMBERS[move.to]}` : `точка ${move.to}`);
          description += `  Ход ${moveIndex + 1}: с ${fromStr} на ${toStr} кубиком ${move.die}\n`;
        });
      }
      description += '\n';
    });

    return description;
  }

  private buildEvaluationPrompt(
    boardDescription: string,
    movesDescription: string,
    dice: number[],
    mode: 'short' | 'long',
  ): string {
    return `${boardDescription}

Кубики: ${dice.join(', ')}.

${movesDescription}

Проанализируй каждый вариант и выбери лучший ход с точки зрения стратегии:
- Блокирование противника
- Безопасность своих фишек
- Прогресс к дому
- Использование всех кубиков

Ответь только JSON: {"option": число} где число - это номер варианта (начиная с 0).`;
  }

  private parseGPTSelection(content: string, maxIndex: number): number {
    try {
      // Try to find JSON in response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in GPT response');
        return 0; // Default to first option
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const option = parsed.option;
      
      if (typeof option === 'number') {
        const index = Math.floor(option);
        if (index >= 0 && index < maxIndex) {
          return index;
        }
      }
      
      this.logger.warn(`Invalid option value: ${option}, maxIndex: ${maxIndex}`);
      return 0; // Default to first option
    } catch (error) {
      this.logger.error(`Failed to parse GPT selection: ${content}`, error);
      return 0; // Default to first option
    }
  }
}
