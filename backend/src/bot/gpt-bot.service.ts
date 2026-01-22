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
   * Анализ всей игры - передаем GPT полный реплей
   * GPT анализирует все ходы пользователя в контексте всей игры
   */
  async analyzeFullGame(
    game: any,
    moves: any[],
    userId: string,
    mode: 'short' | 'long',
  ): Promise<Array<{
    moveNumber: number;
    evaluation: 'excellent' | 'good' | 'neutral' | 'inaccuracy' | 'mistake' | 'blunder';
    explanation: string;
    reasoning: string;
    recommendations?: string[];
    bestMove?: string;
  }>> {
    if (!this.apiKey) {
      return [];
    }

    try {
      // Формируем полный реплей игры для GPT
      const replayDescription = this.describeFullGameReplay(game, moves, userId, mode);

      const prompt = `Ты эксперт по ${mode === 'long' ? 'длинным' : 'коротким'} нардам. Проанализируй ВСЮ игру и оцени каждый ход игрока.

${replayDescription}

ЗАДАЧА: Проанализируй каждый ход игрока (пользователя) в контексте всей игры.

Для каждого хода игрока определи:
1. Оценка хода: excellent (отличный), good (хороший), neutral (нейтральный), inaccuracy (неточность), mistake (ошибка), blunder (грубая ошибка)
2. Объяснение: краткое объяснение (1-2 предложения)
3. Обоснование: детальное обоснование (3-5 предложений) с учетом контекста игры
4. Рекомендации: что нужно было сделать лучше (если ход не оптимальный)
5. Лучший ход: какой ход был бы оптимальным (описание хода)

Учитывай:
- Контекст всей игры (какие ходы были до этого)
- Развитие позиции на протяжении игры
- Стратегические цели в данной фазе игры
- Правила ${mode === 'long' ? 'длинных нард (нельзя бить шашки)' : 'коротких нард (можно бить шашки)'}

Ответь в формате JSON массив:
[
  {
    "moveNumber": 1,
    "evaluation": "excellent|good|neutral|inaccuracy|mistake|blunder",
    "explanation": "краткое объяснение",
    "reasoning": "детальное обоснование",
    "recommendations": ["рекомендация 1", "рекомендация 2"],
    "bestMove": "описание лучшего хода"
  },
  ...
]

ВАЖНО: Проанализируй ВСЕ ходы игрока. Укажи конкретные точки, шашки, стратегические цели.`;

      const response = await this.axiosInstance.post('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по нардам. Твоя задача - анализировать игры и давать профессиональные оценки всех ходов. Отвечай только в формате JSON массива без дополнительного текста.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const content = response.data.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in GPT full game analysis response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: any) {
      this.logger.error(`GPT full game analysis error: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Описание полного реплея игры для GPT
   */
  private describeFullGameReplay(game: any, moves: any[], userId: string, mode: 'short' | 'long'): string {
    const player1Id = game.player1Id;
    const player2Id = game.player2Id;
    const isUserPlayer1 = userId === player1Id;
    
    let description = `=== ИНФОРМАЦИЯ ОБ ИГРЕ ===\n`;
    description += `Режим: ${mode === 'long' ? 'ДЛИННЫЕ нарды' : 'КОРОТКИЕ нарды'}\n`;
    description += `Игрок 1 (${isUserPlayer1 ? 'ВЫ' : 'ПРОТИВНИК'}): ${game.player1?.username || 'Игрок 1'}\n`;
    description += `Игрок 2 (${!isUserPlayer1 ? 'ВЫ' : 'ПРОТИВНИК'}): ${game.player2?.username || 'Игрок 2'}\n`;
    description += `Счет: ${game.player1Score || 0}:${game.player2Score || 0}\n`;
    description += `Победитель: ${game.winnerId === player1Id ? 'Игрок 1' : game.winnerId === player2Id ? 'Игрок 2' : 'Не определен'}\n\n`;

    description += `=== ПОЛНЫЙ РЕПЛЕЙ ИГРЫ ===\n\n`;

    // Описываем каждый ход
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isUserMove = move.playerId === userId;
      const playerName = move.playerId === player1Id ? 'Игрок 1' : 'Игрок 2';
      const isCurrentPlayer = isUserMove ? 'ВЫ' : 'ПРОТИВНИК';

      description += `--- ХОД ${move.moveNumber} ---\n`;
      description += `Игрок: ${playerName} (${isCurrentPlayer})\n`;
      description += `Кубики: ${move.dice?.join(' и ') || 'не указаны'}\n`;

      // Позиция до хода
      if (move.gameStateBefore) {
        description += `ПОЗИЦИЯ ДО ХОДА:\n`;
        description += this.describeBoard(move.gameStateBefore, mode);
        description += '\n';
      }

      // Сделанный ход
      if (move.moves && move.moves.length > 0) {
        description += `СДЕЛАННЫЙ ХОД:\n`;
        description += this.describeMove(move.moves);
        description += '\n';
      } else {
        description += `СДЕЛАННЫЙ ХОД: Пропуск хода\n`;
      }

      // Позиция после хода
      if (move.gameStateAfter) {
        description += `ПОЗИЦИЯ ПОСЛЕ ХОДА:\n`;
        description += this.describeBoard(move.gameStateAfter, mode);
        description += '\n';
      }

      // Если это ход пользователя, добавляем все возможные альтернативы
      if (isUserMove && move.gameStateBefore && move.dice) {
        // Получаем все возможные ходы (нужен движок, но мы можем описать что они есть)
        description += `[Для этого хода были доступны другие варианты - проанализируй оптимальность сделанного хода]\n`;
      }

      description += '\n';
    }

    return description;
  }

  /**
   * Анализ хода и позиции для аналитики игры (старый метод, оставлен для совместимости)
   * Возвращает оценку хода с объяснениями и рекомендациями
   */
  async analyzeMove(
    gameStateBefore: any,
    gameStateAfter: any,
    move: Array<{ from: number; to: number; die: number }>,
    dice: number[],
    mode: 'short' | 'long',
    allPossibleMoves?: Array<Array<{ from: number; to: number; die: number }>>, // ВСЕ возможные ходы для анализа
    bestAlternative?: Array<{ from: number; to: number; die: number }>, // Опционально - только для справки
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
      
      // Описываем все возможные ходы для GPT анализа
      let allMovesDescription = '';
      if (allPossibleMoves && allPossibleMoves.length > 0) {
        allMovesDescription = `\nВСЕ ВОЗМОЖНЫЕ ХОДЫ С ДАННЫМИ КУБИКАМИ (${dice.join(', ')}):\n`;
        allPossibleMoves.forEach((movesSeq, index) => {
          const movesDesc = this.describeMove(movesSeq);
          const isCurrentMove = JSON.stringify(movesSeq) === JSON.stringify(move);
          allMovesDescription += `${index + 1}. ${movesDesc}${isCurrentMove ? ' ← СДЕЛАННЫЙ ХОД' : ''}\n`;
        });
        allMovesDescription += '\n';
      }

      const prompt = `Ты эксперт по ${mode === 'long' ? 'длинным' : 'коротким'} нардам. Твоя задача - САМОСТОЯТЕЛЬНО ПРОАНАЛИЗИРОВАТЬ позицию и ход.

=== РЕЖИМ ИГРЫ ===
${mode === 'long' ? 'ДЛИННЫЕ нарды' : 'КОРОТКИЕ нарды'}
${mode === 'long' 
  ? 'ПРАВИЛА: В длинных нардах НЕЛЬЗЯ бить шашки противника. Важны: распределение шашек, timing, якоря, прима.'
  : 'ПРАВИЛА: В коротких нардах МОЖНО бить одиночные шашки противника. Важны: безопасность, контроль точек, вывод с бара.'}

=== КУБИКИ ===
Выпали кубики: ${dice.join(' и ')}

=== ПОЗИЦИЯ ДО ХОДА ===
${boardBefore}

=== СДЕЛАННЫЙ ХОД ИГРОКОМ ===
${moveDescription}

${allMovesDescription}

=== ПОЗИЦИЯ ПОСЛЕ ХОДА ===
${boardAfter}

${bestMoveDescription ? `СПРАВКА - лучший ход по расчетам equity (но ты должен САМ определить оптимальный ход из списка выше):\n${bestMoveDescription}\n\n` : ''}

ЗАДАЧА: Ты должен САМОСТОЯТЕЛЬНО проанализировать позицию и дать профессиональную оценку.

ШАГ 1 - АНАЛИЗ ПОЗИЦИИ ДО ХОДА:
- Какие шашки находятся на доске для каждого цвета?
- В каких зонах расположены шашки (дом, внешняя зона, дом противника)?
- Есть ли шашки на баре? Сколько?
- Сколько шашек вынесено?
- Какие позиционные факторы важны: прима, якоря, распределение шашек?
- ${mode === 'short' ? 'Есть ли незащищенные шашки (блоты)? Какие риски?' : 'В длинных нардах шашки нельзя бить, поэтому важны другие факторы: распределение, timing, якоря.'}

ШАГ 2 - АНАЛИЗ СДЕЛАННОГО ХОДА:
- Что изменилось в позиции после этого хода?
- Улучшилась или ухудшилась позиция?
- Какие стратегические цели были достигнуты или упущены?
- Соответствует ли ход правилам ${mode === 'long' ? 'длинных нард' : 'коротких нард'}?

ШАГ 3 - ОПРЕДЕЛЕНИЕ ЛУЧШЕГО ХОДА:
${allPossibleMoves && allPossibleMoves.length > 0 
  ? '- Сравни сделанный ход со ВСЕМИ возможными ходами из списка выше\n- Какой ход из списка был бы оптимальным в данной позиции?\n- Почему этот ход лучше сделанного?\n- Какие стратегические цели должен был преследовать игрок?'
  : '- Какой ход был бы оптимальным в данной позиции?\n- Почему этот ход лучше сделанного?\n- Какие стратегические цели должен был преследовать игрок?'}

ШАГ 4 - ОЦЕНКА:
Оцени ход по шкале:
- excellent: отличный ход, оптимальный выбор
- good: хороший ход, но есть лучшие варианты
- neutral: нейтральный ход, не меняет оценку позиции
- inaccuracy: неточность, небольшое ухудшение позиции
- mistake: ошибка, заметное ухудшение позиции
- blunder: грубая ошибка, серьезное ухудшение позиции

ПРАВИЛА ${mode === 'long' ? 'ДЛИННЫХ' : 'КОРОТКИХ'} НАРД:
${mode === 'long' 
  ? '- В длинных нардах НЕЛЬЗЯ бить шашки противника\n- Важны: распределение шашек, timing, якоря в доме противника\n- Нужно строить приму для блокировки противника\n- Важно эффективное использование кубиков'
  : '- В коротких нардах МОЖНО бить одиночные шашки противника\n- Незащищенные шашки (блоты) - это риск\n- Важно контролировать ключевые точки\n- Нужно выводить шашки с бара в первую очередь\n- Важна безопасность своих шашек'}

Ответь в формате JSON:
{
  "evaluation": "excellent|good|neutral|inaccuracy|mistake|blunder",
  "explanation": "краткое объяснение (1-2 предложения) почему ход хороший/плохой",
  "reasoning": "детальное обоснование (3-5 предложений): анализ позиции до хода, что изменилось после хода, какие стратегические цели были достигнуты или упущены, почему этот ход оптимален или нет",
  "recommendations": ["конкретная рекомендация 1 что нужно было сделать", "конкретная рекомендация 2"]
}

ВАЖНО: Дай РЕАЛЬНЫЙ анализ позиции, не просто общие фразы. Укажи конкретные точки, шашки, стратегические цели.`;

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
        max_tokens: 800,
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

    const barWhite = bar[0] || bar.white || 0;
    const barBlack = bar[1] || bar.black || 0;
    const borneOffWhite = borneOff[0] || borneOff.white || 0;
    const borneOffBlack = borneOff[1] || borneOff.black || 0;

    // Map indices to point numbers for display
    const POINT_NUMBERS = [
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, // Top row (indices 0-11)
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, // Bottom row (indices 12-23)
    ];

    let description = `=== ПОЗИЦИЯ НА ДОСКЕ ===\n`;
    description += `Режим: ${mode === 'long' ? 'ДЛИННЫЕ нарды' : 'КОРОТКИЕ нарды'}\n`;
    description += `Текущий игрок: ${currentPlayer === 0 ? 'БЕЛЫЕ' : 'ЧЕРНЫЕ'}\n\n`;
    
    // Описание шашек на баре
    if (barWhite > 0 || barBlack > 0) {
      description += `ШАШКИ НА БАРЕ:\n`;
      if (barWhite > 0) description += `  БЕЛЫЕ: ${barWhite} шашек на баре (нужно ввести в игру)\n`;
      if (barBlack > 0) description += `  ЧЕРНЫЕ: ${barBlack} шашек на баре (нужно ввести в игру)\n`;
      description += '\n';
    }

    // Описание вынесенных шашек
    if (borneOffWhite > 0 || borneOffBlack > 0) {
      description += `ВЫНЕСЕНО ИЗ ИГРЫ:\n`;
      if (borneOffWhite > 0) description += `  БЕЛЫЕ: ${borneOffWhite} шашек вынесено\n`;
      if (borneOffBlack > 0) description += `  ЧЕРНЫЕ: ${borneOffBlack} шашек вынесено\n`;
      description += '\n';
    }

    // Детальное описание позиции на доске
    description += `ПОЗИЦИЯ НА ДОСКЕ (точки 1-24):\n`;
    description += `Точки 1-6: дом БЕЛЫХ (нижний правый угол)\n`;
    description += `Точки 7-12: внешняя зона БЕЛЫХ\n`;
    description += `Точки 13-18: внешняя зона ЧЕРНЫХ\n`;
    description += `Точки 19-24: дом ЧЕРНЫХ (верхний правый угол)\n\n`;

    // Группируем по цветам для лучшего понимания
    const whitePoints: Array<{ point: number; count: number }> = [];
    const blackPoints: Array<{ point: number; count: number }> = [];
    
    for (let i = 0; i < 24; i++) {
      const value = points[i] || 0;
      if (value > 0) {
        whitePoints.push({ point: POINT_NUMBERS[i], count: value });
      } else if (value < 0) {
        blackPoints.push({ point: POINT_NUMBERS[i], count: Math.abs(value) });
      }
    }

    description += `ШАШКИ БЕЛЫХ на доске:\n`;
    if (whitePoints.length === 0) {
      description += `  Все шашки вынесены или на баре\n`;
    } else {
      whitePoints.forEach(({ point, count }) => {
        const zone = point <= 6 ? 'дом' : point <= 12 ? 'внешняя зона' : point <= 18 ? 'внешняя зона' : 'дом противника';
        description += `  Точка ${point}: ${count} шашек (${zone})\n`;
      });
    }
    description += '\n';

    description += `ШАШКИ ЧЕРНЫХ на доске:\n`;
    if (blackPoints.length === 0) {
      description += `  Все шашки вынесены или на баре\n`;
    } else {
      blackPoints.forEach(({ point, count }) => {
        const zone = point <= 6 ? 'дом противника' : point <= 12 ? 'внешняя зона' : point <= 18 ? 'внешняя зона' : 'дом';
        description += `  Точка ${point}: ${count} шашек (${zone})\n`;
      });
    }
    description += '\n';

    // Анализ позиционных факторов
    description += `ПОЗИЦИОННЫЙ АНАЛИЗ:\n`;
    
    // Подсчет одиночных шашек (блоты) для коротких нард
    if (mode === 'short') {
      let whiteBlots = 0;
      let blackBlots = 0;
      whitePoints.forEach(({ count }) => { if (count === 1) whiteBlots++; });
      blackPoints.forEach(({ count }) => { if (count === 1) blackBlots++; });
      if (whiteBlots > 0) description += `  БЕЛЫЕ: ${whiteBlots} незащищенных шашек (блоты) - риск быть побитыми\n`;
      if (blackBlots > 0) description += `  ЧЕРНЫЕ: ${blackBlots} незащищенных шашек (блоты) - риск быть побитыми\n`;
    }

    // Подсчет контролируемых точек (2+ шашек)
    let whiteControlled = whitePoints.filter(p => p.count >= 2).length;
    let blackControlled = blackPoints.filter(p => p.count >= 2).length;
    description += `  БЕЛЫЕ контролируют ${whiteControlled} точек (2+ шашек)\n`;
    description += `  ЧЕРНЫЕ контролируют ${blackControlled} точек (2+ шашек)\n`;

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
