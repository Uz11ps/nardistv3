import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { apiClient } from '../api/client'
import Dice3D from './Dice3D'
import DiceGif from './DiceGif'
import './BackgammonBoard.css'

interface BackgammonBoardProps {
  gameState: any
  currentPlayer: number
  dice: { die1: number; die2: number } | number[] | null
  onMove: (from: number, to: number, die: number, steps?: any[]) => void
  onRollDice: () => void
  canMove: boolean
  isMyTurn: boolean
  gameId?: string
  gameMode?: 'short' | 'long'
  pendingMoves?: Array<{ from: number; to: number; die: number; steps?: any[] }>
  player1Skins?: { board?: any; dice?: any; checkers?: any }
  player2Skins?: { board?: any; dice?: any; checkers?: any }
  mySkins?: { board?: any; dice?: any; checkers?: any }
  diceAnimating?: boolean
  myPlayerId?: string
  player1Id?: string
  player2Id?: string
  player1Name?: string
  player2Name?: string
  isSandbox?: boolean
  sandboxMode?: 'setup' | 'play'
  onSandboxCheckerDrop?: (pointIndex: number, checkerColor: 'white' | 'black') => void
  onSandboxCheckerRemove?: (pointIndex: number) => void
  serverMoves?: Array<{ from: number; to: number; die: number; steps?: any[] }>
  onServerMovesFinished?: () => void
}

export default function BackgammonBoard({
  gameState,
  currentPlayer,
  dice,
  onMove,
  onRollDice,
  canMove,
  isMyTurn,
  gameId,
  gameMode = 'long',
  pendingMoves = [],
  diceAnimating = false,
  myPlayerId,
  player1Id,
  player1Skins,
  player2Skins,
  mySkins,
  isSandbox = false,
  sandboxMode = 'setup',
  onSandboxCheckerDrop,
  onSandboxCheckerRemove,
  serverMoves,
  onServerMovesFinished,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Скины теперь используют материалы (цвета) вместо текстур
  
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number; steps?: any[] }>>([])
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())
  const [dice3DPosition, setDice3DPosition] = useState<{ x: number; y: number; size: number } | null>(null)
  const [dragging, setDragging] = useState<{ pointIndex: number; offsetX: number; offsetY: number; checkerColor?: 'white' | 'black'; freeMove?: boolean } | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number; pointIndex: number } | null>(null)
  const [validTargetPoints, setValidTargetPoints] = useState<Set<number>>(new Set())
  const [showBearOffButton, setShowBearOffButton] = useState<{ pointIndex: number; die: number; steps?: any[] } | null>(null)
  const [coordinateSystem, setCoordinateSystem] = useState<'1-24' | 'A-D/1-24'>('1-24')
  const [animatingChecker, setAnimatingChecker] = useState<{
    from: number;
    to: number;
    die: number;
    steps?: any[];
    progress: number;
    startTime: number;
    isServerMove?: boolean; // Флаг для серверных ходов (чтобы не вызывать onMove)
    isWhite?: boolean; // Цвет анимируемой шашки
  } | null>(null)
  
  // Очередь серверных ходов для последовательной анимации
  const [serverMoveQueue, setServerMoveQueue] = useState<Array<{ from: number; to: number; die: number; steps?: any[] }>>([])
  const [completedServerMoves, setCompletedServerMoves] = useState<any[]>([])
  
  const isPlayer1 = myPlayerId === player1Id

  // Виртуальное состояние доски с учетом локальных ходов (очереди) и завершенных серверных анимаций
  const virtualGameState = useMemo(() => {
    if (!gameState?.points) return gameState
    
    const points = [...gameState.points]
    const bar = { ...(gameState.bar || { white: 0, black: 0 }) }
    const bearOff = { ...(gameState.bearOff || { white: 0, black: 0 }) }
    
    const applyStep = (m: any, isWhiteMove: boolean) => {
      // 1. Убираем шашку из исходной точки
      if (m.from === 24) bar.white--
      else if (m.from === 25) bar.black--
      else if (m.from >= 0 && m.from < 24) {
        const val = points[m.from]
        if (val > 0) points[m.from]--
        else if (val < 0) points[m.from]++
      }
      
      // 2. Добавляем в целевую точку
      if (m.to === -1 || m.to >= 24) {
        if (isWhiteMove) bearOff.white++
        else bearOff.black++
      } else if (m.to >= 0 && m.to < 24) {
        const unit = isWhiteMove ? 1 : -1
        
        // В коротких нардах можно сбить шашку
        if (gameMode === 'short' && points[m.to] === -unit) {
          points[m.to] = unit
          if (unit === 1) bar.black++
          else bar.white++
        } else {
          points[m.to] += unit
        }
      }
    }

    // Применяем локальные ходы пользователя
    pendingMoves.forEach(move => {
      if ((move as any).steps) {
        (move as any).steps.forEach((s: any) => applyStep(s, isPlayer1))
      } else {
        applyStep(move, isPlayer1)
      }
    })

    // Применяем уже завершенные серверные ходы из текущей очереди
    completedServerMoves.forEach(move => {
      // Определяем цвет шашки бота/другого игрока
      const isWhiteMove = move.isWhite !== undefined ? move.isWhite : (isPlayer1 ? false : true)
      if ((move as any).steps) {
        (move as any).steps.forEach((s: any) => applyStep(s, isWhiteMove))
      } else {
        applyStep(move, isWhiteMove)
      }
    })
    
    return {
      ...gameState,
      points,
      bar,
      bearOff
    }
  }, [gameState, pendingMoves, completedServerMoves, isPlayer1, gameMode])

  // Добавление новых серверных ходов в очередь
  useEffect(() => {
    if (serverMoves && serverMoves.length > 0) {
      console.log('🤖 Received server moves for animation:', serverMoves)
      setCompletedServerMoves([]) // Сбрасываем завершенные ходы при новой пачке
      setServerMoveQueue(prev => [...prev, ...serverMoves])
    }
  }, [serverMoves])

  // Сброс очереди при смене игры
  useEffect(() => {
    setServerMoveQueue([])
    setAnimatingChecker(null)
  }, [gameId])

  // Запуск анимации из очереди
  useEffect(() => {
    if (!animatingChecker && serverMoveQueue.length > 0) {
      const nextMove = serverMoveQueue[0]
      console.log('🤖 Animating next server move:', nextMove)
      
      // Определяем цвет шашки для анимации
      let isWhite = false
      if (nextMove.from === 24) isWhite = true
      else if (nextMove.from === 25) isWhite = false
      else if (nextMove.from >= 0 && nextMove.from < 24) {
        const points = virtualGameState?.points || []
        isWhite = (points[nextMove.from] || 0) > 0
      } else {
        // Если from неизвестен (например, bear-off), используем логику по currentPlayer
        isWhite = isPlayer1 ? false : true
      }

      setAnimatingChecker({
        ...nextMove,
        isWhite,
        progress: 0,
        startTime: performance.now(),
        isServerMove: true
      })
      
      // Удаляем из очереди
      setServerMoveQueue(prev => prev.slice(1))
    }
  }, [animatingChecker, serverMoveQueue, virtualGameState, isPlayer1])
  
  // Защита от случайных тройных кликов
  const clickHistoryRef = useRef<Array<{ pointIndex: number; timestamp: number }>>([])
  const clickTimeoutRef = useRef<number | null>(null)
  const isTripleClickRef = useRef<boolean>(false)
  
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiClient.get('/users/settings')
        if (response.data?.coordinateSystem) {
          setCoordinateSystem(response.data.coordinateSystem)
        }
      } catch (error) {
        console.error('Failed to load coordinate system setting:', error)
      }
    }
    loadSettings()
  }, [])

  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
    }
  }, [])

  // Определяем какие скины использовать
  // Доска: разделена на две половины - левая для player1, правая для player2
  const boardSkinPlayer1 = player1Skins?.board || mySkins?.board
  const boardSkinPlayer2 = player2Skins?.board || mySkins?.board
  // Шашки: для player1 используем player1Skins, для player2 - player2Skins, с fallback на mySkins
  const checkerSkinPlayer1 = player1Skins?.checkers || mySkins?.checkers
  const checkerSkinPlayer2 = player2Skins?.checkers || mySkins?.checkers
  const checkerSkin = isPlayer1 ? checkerSkinPlayer1 : checkerSkinPlayer2
  // Кости: для player1 используем player1Skins, для player2 - player2Skins, с fallback на mySkins
  const diceSkinPlayer1 = player1Skins?.dice || mySkins?.dice
  const diceSkinPlayer2 = player2Skins?.dice || mySkins?.dice

  // Получаем цвета из конфигураций скинов (материалы вместо текстур)
  const getBoardColors = (boardSkin: any) => {
    if (!boardSkin) {
      return {
        backgroundColor: '#8B4513',
        triangleColor1: '#D4A574',
        triangleColor2: '#8B4513',
        borderColor: '#5c3a21',
        outlineColor: '#654321',
      }
    }
    
    let config = boardSkin.boardConfig || {}
    // Если boardConfig - строка, пытаемся распарсить JSON
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config)
      } catch (e) {
        console.warn('Failed to parse boardConfig:', e)
        config = {}
      }
    }
    
    return {
      backgroundColor: config.backgroundColor || '#8B4513',
      triangleColor1: config.triangleColor1 || '#D4A574',
      triangleColor2: config.triangleColor2 || '#8B4513',
      borderColor: config.borderColor || '#5c3a21',
      outlineColor: config.outlineColor || '#654321',
    }
  }

  const getDiceColor = (diceSkin: any) => {
    if (!diceSkin) return '#FFFFFF'
    
    let diceConfig = diceSkin.diceConfig
    // Если diceConfig - строка, пытаемся распарсить JSON
    if (typeof diceConfig === 'string') {
      try {
        diceConfig = JSON.parse(diceConfig)
      } catch (e) {
        console.warn('Failed to parse diceConfig:', e)
        return '#FFFFFF'
      }
    }
    
    return diceConfig?.color || '#FFFFFF'
  }

  const getCheckerColors = (checkerSkin: any) => {
    if (!checkerSkin) {
      return {
        whiteColor: '#F0F0F0',
        blackColor: '#333333',
      }
    }
    
    let config = checkerSkin.checkersConfig || {}
    // Если checkersConfig - строка, пытаемся распарсить JSON
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config)
      } catch (e) {
        console.warn('Failed to parse checkersConfig:', e)
        config = {}
      }
    }
    
    return {
      whiteColor: config.whiteColor || '#F0F0F0',
      blackColor: config.blackColor || '#333333',
    }
  }

  // Получаем цвета для каждого игрока
  const opponentBoardColors = getBoardColors(isPlayer1 ? boardSkinPlayer2 : boardSkinPlayer1)
  const myBoardColors = getBoardColors(isPlayer1 ? boardSkinPlayer1 : boardSkinPlayer2)
  const diceColorPlayer1 = getDiceColor(diceSkinPlayer1)
  const diceColorPlayer2 = getDiceColor(diceSkinPlayer2)
  const checkerColorsPlayer1 = getCheckerColors(checkerSkinPlayer1)
  const checkerColorsPlayer2 = getCheckerColors(checkerSkinPlayer2)

  // Скины теперь используют только материалы (цвета), загрузка текстур не требуется


  // Стабилизируем dice для сравнения
  const diceKey = useMemo(() => {
    if (!dice) return null
    if (Array.isArray(dice)) {
      return dice.sort().join(',')
    }
    if (typeof dice === 'object' && 'die1' in dice && 'die2' in dice) {
      return [dice.die1, dice.die2].sort().join(',')
    }
    return null
  }, [dice])

  // Стабилизируем pendingMoves для сравнения
  const pendingMovesKey = useMemo(() => {
    return JSON.stringify(pendingMoves.map(m => ({ from: m.from, to: m.to, die: m.die })))
  }, [pendingMoves])

  // Отслеживаем предыдущее состояние pendingMoves для определения момента выполнения хода
  const prevPendingMovesRef = useRef<string>('[]')

  // Получение возможных ходов
  useEffect(() => {
    // Проверяем наличие кубиков
    const hasDice = diceKey !== null
    
    // Сбрасываем текущие возможные ходы при изменении pendingMoves или dice
    // Это предотвращает клики по старым (невалидным) ходам до получения новых от сервера
        setPossibleMoves([])
    setSelectedPoint(null)
    setValidTargetPoints(new Set())
    
    // В Sandbox разрешаем получение ходов всегда, если есть кубики
    if (!gameId || (!isSandbox && (!isMyTurn || !canMove)) || !hasDice) {
      prevPendingMovesRef.current = pendingMovesKey
      return
    }
    
    let timeoutId: number | null = null
    let cancelled = false
    
    const fetchPossibleMoves = async () => {
      if (cancelled) return
      
      try {
        // Теперь отправляем pendingMoves на сервер, чтобы получить актуальные варианты
        const response = await apiClient.post(`/games/${gameId}/possible-moves`, { 
          pendingMoves 
        })
        
        if (cancelled) return
        
        let flatMoves = response.data?.movesFromPoint || []
        
        // Для коротких нард: преобразуем from: -1 в 24 (белые) или 25 (черные) для бара
        if (gameMode === 'short') {
          const bar = gameState?.bar || { white: 0, black: 0 }
          const activePlayer = isSandbox ? currentPlayer : (isPlayer1 ? 0 : 1)
          const hasBarCheckers = activePlayer === 0 ? bar.white > 0 : bar.black > 0
          
          flatMoves = flatMoves.map(move => {
            // Преобразуем from: -1 в 24 (белые) или 25 (черные)
            if (move.from === -1) {
              return { ...move, from: activePlayer === 0 ? 24 : 25 }
            }
            return move
          })
          
          // Если есть шашки на баре и нет pendingMoves - фильтруем, оставляем только ходы с бара
          // Если есть pendingMoves, значит уже начали ход с бара, показываем все возможные ходы
          if (hasBarCheckers && pendingMoves.length === 0) {
            flatMoves = flatMoves.filter(move => move.from === (activePlayer === 0 ? 24 : 25))
          }
        }
        
        // Не подсвечиваем все возможные точки автоматически
        // Подсветка будет только для выбранной точки (selectedPoint)
        setPossibleMoves(flatMoves)
        // highlightedPoints будет заполняться только при выборе точки
      } catch (error) {
        if (cancelled) return
        console.error('Ошибка получения возможных ходов:', error)
        setPossibleMoves([])
        // Не сбрасываем highlightedPoints, так как они не используются для автоматической подсветки
      }
    }
    
    // Определяем, был ли только что выполнен ход (pendingMoves очистились)
    const wasMoveJustCompleted = prevPendingMovesRef.current !== '[]' && pendingMovesKey === '[]'
    
    // Если ход был только что выполнен, добавляем задержку для завершения анимации
    // Длительность анимации - 300мс, добавляем еще 100мс для надежности
    const animationDelay = wasMoveJustCompleted ? 400 : 300
    
    // Обновляем предыдущее состояние
    prevPendingMovesRef.current = pendingMovesKey
    
    // Debounce для предотвращения частых запросов (увеличиваем для уменьшения лагов)
    timeoutId = window.setTimeout(() => {
      fetchPossibleMoves()
    }, animationDelay)
    
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [gameId, isMyTurn, canMove, diceKey, pendingMovesKey, pendingMoves, gameState, gameMode, isPlayer1, isSandbox, currentPlayer]) // pendingMoves нужен для использования в fetchPossibleMoves
  
  // Определение позиции для кубиков
  // Кубики показываются на стороне игрока, у которого сейчас ход
  // Позиция адаптируется к размеру экрана и обновляется при изменении размера
  const updateDicePosition = useCallback(() => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    // Размер кубиков адаптируется к размеру доски
    const diceSize = Math.min(width, height) * 0.08
    const diceWidth = diceSize * 7.5
    const diceHeight = diceSize * 4.5
    
    // Player1 (белые, currentPlayer === 0): кубики внизу справа
    // Player2 (черные, currentPlayer === 1): кубики вверху слева
    // Показываем кубики на стороне игрока, у которого сейчас ход
    // Учитываем размер кубиков, чтобы они не выходили за границы доски
    
    let xPos: number
    let yPos: number
    
    // Определяем, какой игрок сейчас ходит и где должны быть его кубики
    // Белые шашки (player1) находятся внизу, черные (player2) - вверху
    // Кубики должны быть в противоположном углу от шашек соперника
    if (currentPlayer === 0) {
      // Player1 (белые) ходит - кубики внизу справа (рядом с белыми шашками)
      xPos = Math.min(width * 0.85, width - diceWidth / 2 - 10) - 10
      yPos = Math.min(height * 0.85, height - diceHeight / 2 - 10)
    } else {
      // Player2 (черные) ходит - кубики вверху слева (рядом с черными шашками, противоположный угол от белых)
      // Используем фиксированные проценты для верхнего левого угла
      // Учитываем размер кубиков, чтобы они не выходили за границы
      xPos = width * 0.1 + diceWidth / 2
      yPos = height * 0.1 + diceHeight / 2
    }

    setDice3DPosition({
      x: xPos,
      y: yPos,
      size: diceSize,
    })
  }, [currentPlayer])

  useEffect(() => {
    updateDicePosition()
    
    // Обновляем позицию при изменении размера окна
    const handleResize = () => {
      updateDicePosition()
    }
    
    window.addEventListener('resize', handleResize)
    
    // Также используем ResizeObserver для отслеживания изменения размера контейнера
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        updateDicePosition()
      })
      resizeObserver.observe(containerRef.current)
      
      return () => {
        window.removeEventListener('resize', handleResize)
        resizeObserver.disconnect()
      }
    }
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [currentPlayer, updateDicePosition])
  
  // Вспомогательная функция для получения координат точки
  const getPointCoordinates = useCallback((pointIndex: number, canvas: HTMLCanvasElement) => {
    const width = canvas.width
    const height = canvas.height
    
    // Параметры области выноса (Контейнеры)
    const bearOffWidth = width * 0.06
    const boardWidth = width - (bearOffWidth * 2)
    const boardStartX = bearOffWidth
    const boardEndX = width - bearOffWidth
    
    // Центральная полоса (бар)
    const barWidth = boardWidth * 0.08
    const barX = boardStartX + (boardWidth - barWidth) / 2
    
    // Параметры для точек
    const halfBoardWidth = (boardWidth - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    const isTopRow = pointIndex < 12
    
    let x = 0
    let pointNumber = 0
    
    if (isTopRow) {
      pointNumber = 24 - pointIndex
      const isRightSide = pointIndex < 6
      
      if (isRightSide) {
        const pointInHalf = pointIndex
        x = boardEndX - (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        const pointInHalf = pointIndex - 6
        x = barX - (pointInHalf * pointWidth + pointWidth / 2)
      }
    } else {
      pointNumber = 12 - (pointIndex - 12)
      const isLeftSide = pointIndex < 18
      
      if (isLeftSide) {
        const pointInHalf = pointIndex - 12
        x = boardStartX + (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        const pointInHalf = pointIndex - 18
        x = barX + barWidth + (pointInHalf * pointWidth + pointWidth / 2)
      }
    }
    
    let y = isTopRow ? 0 : height
    
    // Для player2 инвертируем координаты точек, так как доска инвертирована на 180 градусов
    let finalIsTopRow = isTopRow
    if (!isPlayer1) {
      x = width - x
      y = height - y
      // Инвертируем isTopRow для player2, так как координаты инвертированы
      finalIsTopRow = !isTopRow
    }
    
    return { x, y, isTopRow: finalIsTopRow, pointWidth, pointHeight, pointNumber }
  }, [isPlayer1])
  
  // Функция для определения точки по координатам
  const getPointAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement): number | null => {
    const width = canvas.width
    const height = canvas.height
    
    // Координаты клика
    const actualX = x
    const actualY = y
    
    // 0. ПРИОРИТЕТ: Проверка специальных зон в sandbox режиме
    // (Мусорка отключена по просьбе пользователя)
    
    // Параметры области выноса (Контейнеры)
    const bearOffWidth = width * 0.06
    const boardWidth = width - (bearOffWidth * 2)
    const boardStartX = bearOffWidth
    const boardEndX = width - bearOffWidth
    
    // Центральная полоса (бар)
    const barWidth = boardWidth * 0.08
    const barX = boardStartX + (boardWidth - barWidth) / 2
    
    // Параметры для точек
    const halfBoardWidth = (boardWidth - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    
    // Проверяем все точки
    const points = gameState?.points || []
    
    // Прямой расчет попадания в точку на основе логики getPointCoordinates
    // Добавляем небольшой отступ (padding) для более легкого попадания
    const padding = 5;
    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
      const { x: pX, y: pY, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      
      const xStart = pX - pW / 2 - padding;
      const xEnd = pX + pW / 2 + padding;
      const yStart = (isTopRow ? 0 : height / 2) - padding;
      const yEnd = (isTopRow ? height / 2 : height) + padding;
      
      if (actualX >= xStart && actualX <= xEnd && actualY >= yStart && actualY <= yEnd) {
        return pointIndex
      }
    }
    
    // Проверяем бар (для коротких нард - более широкая область)
    if (actualX >= barX && actualX <= barX + barWidth) {
      // Для коротких нард разрешаем клик в более широкой области бара
      const barYMin = gameMode === 'short' ? height * 0.1 : height * 0.25
      const barYMax = gameMode === 'short' ? height * 0.9 : height * 0.75
      if (actualY >= barYMin && actualY <= barYMax) {
        return isPlayer1 ? 24 : 25
      }
    }
    
    // Проверяем контейнеры
    const leftContainerX = 0
    const rightContainerX = width - bearOffWidth
    const isLeftTarget = actualX >= leftContainerX && actualX <= leftContainerX + bearOffWidth
    const isRightTarget = actualX >= rightContainerX && actualX <= rightContainerX + bearOffWidth
    
    if (isLeftTarget || isRightTarget) {
      // Для Белых (P1) дом всегда в правой нижней четверти (пункты 1-6)
      // Для Черных (P2) дом либо в правой верхней (короткие), либо в левой верхней (длинные)
      const isMySide = isPlayer1 ? isRightTarget : (gameMode === 'long' ? isLeftTarget : isRightTarget)
      if (isMySide) return -1
    }
    
    // В Sandbox режиме проверяем зону "удаления" (мусорка) в левом нижнем углу
    // Визуально она не отображается, но хитбокс работает для перетаскивания шашек
    if (isSandbox) {
      const trashSize = 120
      const trashX = 0
      const trashY = height - trashSize
      if (actualX >= trashX && actualX <= trashX + trashSize && actualY >= trashY && actualY <= height) {
        return -3 // Код для мусорки (удаления)
      }
    }
    
    return null
  }, [gameState, isPlayer1, gameMode, isSandbox])
  
  // Отрисовка доски
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx || !virtualGameState) return
    
    const width = canvas.width
    const height = canvas.height
    
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    
    // Убрали поворот на 180 градусов - теперь доска всегда отображается одинаково
    // Для player2 координаты точек будут инвертированы в getPointCoordinates
    
    // Параметры области выноса (Контейнеры)
    const bearOffWidth = width * 0.06
    const boardWidth = width - (bearOffWidth * 2)
    const boardStartX = bearOffWidth
    
    // Центральная полоса (бар) - разделитель между половинами доски
    const barWidth = boardWidth * 0.08
    const barX = boardStartX + (boardWidth - barWidth) / 2
    
    // Определяем какие скины использовать для каждой половины
    // Свои скины всегда справа, скины противника всегда слева
    // Для player1: слева = player2 (противник), справа = player1 (свои)
    // Для player2: из-за инверсии координат визуально слева = player1 (противник), справа = player2 (свои)
    const leftHalfWidth = (boardWidth - barWidth) / 2
    const rightHalfStartX = barX + barWidth
    const rightHalfWidth = (boardWidth - barWidth) / 2
    
    // Левая половина доски (скины противника) - используем цвета из boardConfig
    ctx.fillStyle = opponentBoardColors.backgroundColor
    ctx.fillRect(boardStartX, 0, leftHalfWidth, height)
    
    // Центральная полоса (бар) - используем outlineColor из конфигурации
    ctx.fillStyle = myBoardColors.outlineColor || '#654321'
    ctx.fillRect(barX, 0, barWidth, height)
    
    // Правая половина доски (свои скины) - используем цвета из boardConfig
    ctx.fillStyle = myBoardColors.backgroundColor
    ctx.fillRect(rightHalfStartX, 0, rightHalfWidth, height)
    
    // Параметры для точек
    const halfBoardWidth = (boardWidth - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    // Вспомогательная функция для отрисовки шашки с цветом из checkersConfig
    const drawChecker = (cX: number, cY: number, size: number, isWhite: boolean, isMy: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      
      const radius = size / 2
      
      // Используем цвета из checkersConfig
      const checkerColors = isMy ? checkerColorsPlayer1 : checkerColorsPlayer2
      const color = isWhite ? checkerColors.whiteColor : checkerColors.blackColor
      
      // Тень для объема
      ctx.shadowBlur = size * 0.2
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowOffsetY = 2
      
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cX, cY, radius, 0, Math.PI * 2)
      ctx.fill()
      
      // Внутренний декор шашки
      ctx.beginPath()
      ctx.arc(cX, cY, size * 0.35, 0, Math.PI * 2)
      const strokeColor = isMy ? (isWhite ? '#DDD' : '#555') : (isWhite ? '#AAA' : '#222')
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 1
      ctx.stroke()
      
      // Обводка шашки
      ctx.strokeStyle = isMy ? '#999' : '#000'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cX, cY, radius, 0, Math.PI * 2)
      ctx.stroke()
      
      ctx.restore()
    }

    // Получаем points из virtualGameState, если его нет - создаем массив из 24 нулей
    const points = virtualGameState?.points && virtualGameState.points.length === 24 
      ? virtualGameState.points 
      : Array(24).fill(0)
    
    // Функция для отрисовки треугольной точки с цветами из boardConfig
    const drawTrianglePoint = (x: number, y: number, w: number, h: number, isTop: boolean, colors: typeof myBoardColors, isLight: boolean) => {
      ctx.beginPath()
      if (isTop) {
        // Верхний треугольник: основание вверху (y), острие вниз (y + h)
        ctx.moveTo(x - w / 2, y)       // Левый верхний угол (основание)
        ctx.lineTo(x + w / 2, y)       // Правый верхний угол (основание)
        ctx.lineTo(x, y + h)           // Острие внизу
      } else {
        // Нижний треугольник: основание внизу (y), острие вверх (y - h)
        ctx.moveTo(x - w / 2, y)       // Левый нижний угол (основание)
        ctx.lineTo(x + w / 2, y)       // Правый нижний угол (основание)
        ctx.lineTo(x, y - h)           // Острие вверху
      }
      ctx.closePath()
      // Используем triangleColor1 для светлых, triangleColor2 для темных
      ctx.fillStyle = isLight ? colors.triangleColor1 : colors.triangleColor2
      ctx.fill()
      // Используем borderColor для обводки
      ctx.strokeStyle = colors.borderColor
      ctx.lineWidth = 1
      ctx.stroke()
    }
    
    // Рисуем треугольники с цветами из boardConfig
    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
      const { x, y, isTopRow, pointWidth: pW, pointHeight: pH, pointNumber } = getPointCoordinates(pointIndex, canvas)
      
      // Определяем, на какой половине доски находится точка
      const isLeftHalf = x < barX
      const boardColors = isLeftHalf ? opponentBoardColors : myBoardColors
      
      const triangleWidth = pW * 0.95
      const triangleHeight = pH * 0.95
      
      // Определяем цвет треугольника (чередование светлый/темный)
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      const isLight = pointInRow % 2 === 0
      
      // Рисуем сам треугольник с цветами из конфигурации
      drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, boardColors, isLight)
      
      // Отрисовка нумерации точек (1-24)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      const getCoordinateText = (num: number) => {
        if (coordinateSystem === '1-24') return num.toString();
        const quarter = Math.floor((num - 1) / 6);
        const offset = (num - 1) % 6 + 1;
        const letters = ['A', 'B', 'C', 'D'];
        return `${letters[quarter]}${offset}`;
      }

      const coordText = getCoordinateText(pointNumber);
      
      if (isTopRow) {
        ctx.fillText(coordText, x, y + 15)
      } else {
        ctx.fillText(coordText, x, y - 15)
      }
    }

    // Вторым проходом рисуем все шашки (чтобы они были поверх всех треугольников)
    // Используем points из virtualGameState если есть, иначе пустой массив
    const checkersPoints = virtualGameState?.points && virtualGameState.points.length === 24 
      ? virtualGameState.points 
      : []
    checkersPoints.forEach((pointValue: number, pointIndex: number) => {
      if (pointValue === 0 || pointIndex >= 24) return
      
      const { x, y, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      const checkerCount = Math.abs(pointValue)
      // Цвета остаются изначальными: положительные = белые, отрицательные = черные
      const isWhiteChecker = pointValue > 0
      // В Sandbox всегда используем цвета первого игрока (свои), чтобы не было "перекрашивания"
      const isMyPoint = isSandbox ? true : ((isPlayer1 && isWhiteChecker) || (!isPlayer1 && !isWhiteChecker))
      
      const checkerSize = Math.min(pW * 0.85, pH * 0.15) 
      const checkerBaseY = isTopRow 
        ? y + checkerSize/2 + 5 
        : y - checkerSize/2 - 5 
      
      const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
      const isAnimatingFromThisPoint = animatingChecker && animatingChecker.from === pointIndex
      const isHead = gameMode === 'long' && (pointIndex === 0 || pointIndex === 12);
      
      const checkersToDrawTotal = (isDraggingFromThisPoint || isAnimatingFromThisPoint) ? checkerCount - 1 : checkerCount
      // В голове рисуем максимум 5 шашек визуально, даже если их 15
      const checkersToDraw = isHead ? Math.min(checkersToDrawTotal, 5) : checkersToDrawTotal
      
      for (let i = 0; i < checkersToDraw; i++) {
        // Если шашек много (больше 5), начинаем их накладывать друг на друга плотнее
        const overlap = checkerCount > 5 ? (checkerSize * 0.8) : checkerSize
        const yOffset = i * overlap
        const checkerY = isTopRow 
          ? checkerBaseY + yOffset 
          : checkerBaseY - yOffset
        
        // Используем текстуры шашек если есть
        drawChecker(x, checkerY, checkerSize, isWhiteChecker, isMyPoint)

        // Если это первая шашка в голове (индекс i === 0), рисуем на ней количество всех шашек в этой точке
        if (isHead && i === 0 && checkerCount > 1) {
          ctx.save()
          ctx.fillStyle = isWhiteChecker ? '#000' : '#FFF'
          ctx.font = 'bold 14px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(checkerCount.toString(), x, checkerY)
          ctx.restore()
        }
      }
      
      // Если шашек больше 5 (и это не голова), показываем число на последней шашке
      if (!isHead && checkerCount > 5 && !isDraggingFromThisPoint && !isAnimatingFromThisPoint) {
        const overlap = checkerSize * 0.8
        const lastCheckerY = isTopRow 
          ? checkerBaseY + ((checkerCount - 1) * overlap)
          : checkerBaseY - ((checkerCount - 1) * overlap)
        
        ctx.fillStyle = isWhiteChecker ? '#000' : '#FFF'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(checkerCount.toString(), x, lastCheckerY)
      }
    })
    
    // Подсветка рисуется ПОВЕРХ треугольников и шашек
    // Используем цикл for для всех 24 точек
    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
      const { x, y, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      
      // 1. Подсветка точки под курсором
      if (hoveredPoint === pointIndex) {
        ctx.fillStyle = dragging ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        if (isTopRow) {
          ctx.fillRect(x - pW / 2, 0, pW, height / 2)
        } else {
          ctx.fillRect(x - pW / 2, height / 2, pW, height / 2)
        }
      }

      // 2. Подсветка валидных точек назначения при перетаскивании ИЛИ выборе точки
      if ((dragging || selectedPoint !== null) && validTargetPoints.has(pointIndex)) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
        if (isTopRow) {
          ctx.fillRect(x - pW / 2, 0, pW, height / 2)
        } else {
          ctx.fillRect(x - pW / 2, height / 2, pW, height / 2)
        }
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.lineWidth = 2
        ctx.strokeRect(x - pW / 2 + 2, isTopRow ? 2 : height / 2 + 2, pW - 4, height / 2 - 4)
      }
      
      // 3. Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.3)'
        if (isTopRow) {
          ctx.fillRect(x - pW / 2, 0, pW, height / 2)
        } else {
          ctx.fillRect(x - pW / 2, height / 2, pW, height / 2)
        }
      }
    }
    
    // Отрисовка перетаскиваемой шашки (самый верхний слой)
    if (dragging && dragPosition) {
      // Для pointIndex: -1 (bear-off) используем стандартный размер точки
      const coords = getPointCoordinates(dragging.pointIndex === -1 ? 0 : dragging.pointIndex, canvas)
      const pW = coords.pointWidth
      const pH = coords.pointHeight
      const checkerSize = Math.min(pW * 0.85, pH * 0.15)
      const dragX = dragPosition.x - dragging.offsetX
      const dragY = dragPosition.y - dragging.offsetY
      
      // Определяем цвет шашки для отрисовки при перетаскивании
      let isWhite = isPlayer1
      if (isSandbox) {
        if (dragging.pointIndex === -1) {
          isWhite = dragging.checkerColor === 'white'
        } else if (dragging.pointIndex === 24) {
          isWhite = true
        } else if (dragging.pointIndex === 25) {
          isWhite = false
        } else if (dragging.pointIndex >= 0) {
          isWhite = (virtualGameState?.points[dragging.pointIndex] || 0) > 0
        }
      }
      
      drawChecker(dragX, dragY, checkerSize, isWhite, isPlayer1, 0.9)
    }

    // Отрисовка анимируемой шашки
    if (animatingChecker) {
      const { x: fromX, y: fromY, isTopRow: fromTop, pointWidth: pW, pointHeight: pH } = getPointCoordinates(animatingChecker.from, canvas)
      const checkerSize = Math.min(pW * 0.85, pH * 0.15)
      
      let toX, toY, toTop;
      if (animatingChecker.to === -1 || animatingChecker.to >= 24) {
        // Координаты контейнера выноса
        const leftContainerX = 0
        const rightContainerX = width - bearOffWidth
        const myX = isPlayer1 ? rightContainerX : (gameMode === 'long' ? leftContainerX : rightContainerX)
        toX = myX + bearOffWidth / 2
        toY = height / 2
        toTop = false
      } else {
        const coords = getPointCoordinates(animatingChecker.to, canvas)
        toX = coords.x
        toY = coords.y
        toTop = coords.isTopRow
      }

      // Определяем цвет шашки по исходной точке
      const isWhiteChecker = animatingChecker.isWhite !== undefined 
        ? animatingChecker.isWhite 
        : (animatingChecker.from === 24 ? true : (animatingChecker.from === 25 ? false : (virtualGameState.points[animatingChecker.from] > 0)))
      // В Sandbox всегда используем основной набор цветов для обоих сторон
      const isMyChecker = isSandbox ? true : ((isPlayer1 && isWhiteChecker) || (!isPlayer1 && !isWhiteChecker))

      // Начальная позиция Y (с учетом стопки)
      let fromCheckerCount = 0
      if (animatingChecker.from === 24) fromCheckerCount = virtualGameState.bar.white
      else if (animatingChecker.from === 25) fromCheckerCount = virtualGameState.bar.black
      else fromCheckerCount = Math.abs(virtualGameState.points[animatingChecker.from])
      
      const fromOverlap = fromCheckerCount > 5 ? (checkerSize * 0.8) : checkerSize
      const startY = fromTop 
        ? fromY + checkerSize/2 + 5 + (fromCheckerCount - 1) * fromOverlap
        : fromY - checkerSize/2 - 5 - (fromCheckerCount - 1) * fromOverlap

      // Конечная позиция Y (куда приземлится)
      let endY;
      if (animatingChecker.to === -1 || animatingChecker.to >= 24) {
        endY = toY
      } else {
        const toCheckerCount = Math.abs(virtualGameState.points[animatingChecker.to])
        const toOverlap = (toCheckerCount + 1) > 5 ? (checkerSize * 0.8) : checkerSize
        endY = toTop
          ? toY + checkerSize/2 + 5 + toCheckerCount * toOverlap
          : toY - checkerSize/2 - 5 - toCheckerCount * toOverlap
      }

      const curX = fromX + (toX - fromX) * animatingChecker.progress
      const curY = startY + (endY - startY) * animatingChecker.progress
      
      drawChecker(curX, curY, checkerSize, isWhiteChecker, isMyChecker)
    }
    
    // Отрисовка бара
    if (virtualGameState.bar) {
      const bar = virtualGameState.bar
      const whiteBarCount = bar.white || 0
      const blackBarCount = bar.black || 0
      const checkerSize = Math.min(pointWidth * 0.85, pointHeight * 0.15)
      const barCenterX = barX + barWidth / 2
      
      // Белые шашки на баре (положительные значения)
      if (whiteBarCount > 0) {
        const isAnimatingFromWhiteBar = animatingChecker && animatingChecker.from === 24
        const countToDraw = isAnimatingFromWhiteBar ? whiteBarCount - 1 : whiteBarCount
        const barStartY = height - pointHeight * 0.3
        const isMyBar = isSandbox ? true : isPlayer1
        const overlap = countToDraw > 5 ? (checkerSize * 0.8) : checkerSize
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY - (i * overlap)
          drawChecker(barCenterX, barY, checkerSize, true, isMyBar)
        }
      }
      
      // Черные шашки на баре (отрицательные значения)
      if (blackBarCount > 0) {
        const isAnimatingFromBlackBar = animatingChecker && animatingChecker.from === 25
        const countToDraw = isAnimatingFromBlackBar ? blackBarCount - 1 : blackBarCount
        const barStartY = pointHeight * 0.3
        const isMyBar = isSandbox ? true : !isPlayer1
        const overlap = countToDraw > 5 ? (checkerSize * 0.8) : checkerSize
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY + (i * overlap)
          drawChecker(barCenterX, barY, checkerSize, false, isMyBar)
        }
      }
    }
    
    // Отрисовка области выноса (Контейнеры)
    const leftContainerX = 0
    const rightContainerX = width - bearOffWidth
    
    // Рисуем контейнеры
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(leftContainerX, 0, bearOffWidth, height)
    ctx.fillRect(rightContainerX, 0, bearOffWidth, height)
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.strokeRect(leftContainerX, 0, bearOffWidth, height)
    ctx.strokeRect(rightContainerX, 0, bearOffWidth, height)

    // Отрисовка номеров точек
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    if (virtualGameState.bearOff) {
      const bOff = virtualGameState.bearOff
      const whiteBearOffCount = bOff.white || 0
      const blackBearOffCount = bOff.black || 0
      
      const checkerH = Math.min(height / 16, 15)
      const checkerW = bearOffWidth * 0.8
      
      // Белые выброшенные шашки (сверху вниз, справа для player1, слева для player2 после инверсии)
      const whiteX = isPlayer1 ? rightContainerX : leftContainerX
      for (let i = 0; i < whiteBearOffCount; i++) {
        ctx.fillStyle = '#F0F0F0'
        ctx.fillRect(whiteX + (bearOffWidth - checkerW) / 2, 10 + (i * (checkerH + 2)), checkerW, checkerH)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(whiteX + (bearOffWidth - checkerW) / 2, 10 + (i * (checkerH + 2)), checkerW, checkerH)
      }
      
      // Черные выброшенные шашки (снизу вверх, слева для player1, справа для player2 после инверсии)
      const blackX = isPlayer1 ? leftContainerX : rightContainerX
      for (let i = 0; i < blackBearOffCount; i++) {
        ctx.fillStyle = '#333333'
        ctx.fillRect(blackX + (bearOffWidth - checkerW) / 2, height - 10 - (i * (checkerH + 2)), checkerW, checkerH)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(blackX + (bearOffWidth - checkerW) / 2, height - 10 - (i * (checkerH + 2)), checkerW, checkerH)
      }
    }

    // Подсветка при перетаскивании в зону выноса
    if ((dragging || selectedPoint !== null) && validTargetPoints.has(-1)) {
      const targetX = isPlayer1 ? rightContainerX : (gameMode === 'long' ? leftContainerX : rightContainerX)
        
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'
      ctx.fillRect(targetX, 0, bearOffWidth, height)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
      ctx.lineWidth = 3
      ctx.strokeRect(targetX, 0, bearOffWidth, height)
      
      if (hoveredPoint === -1) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)'
        ctx.fillRect(targetX, 0, bearOffWidth, height)
      }
    }

    // В САМОМ КОНЦЕ: Отрисовка "мусорки" в sandbox режиме (ОТКЛЮЧЕНО по просьбе пользователя)
    /*
    if (isSandbox) {
      const trashSize = 120
      const trashX = 0
      const trashY = height - trashSize
      
      ctx.save()
      // Фон мусорки - более яркий красный градиент для зоны удаления
      const gradient = ctx.createRadialGradient(
        trashX + trashSize / 2, trashY + trashSize / 2, 10,
        trashX + trashSize / 2, trashY + trashSize / 2, trashSize / 2
      )
      gradient.addColorStop(0, hoveredPoint === -3 ? 'rgba(255, 0, 0, 0.85)' : 'rgba(255, 0, 0, 0.5)')
      gradient.addColorStop(1, hoveredPoint === -3 ? 'rgba(150, 0, 0, 0.7)' : 'rgba(100, 0, 0, 0.3)')
      
      ctx.fillStyle = gradient
      ctx.strokeStyle = hoveredPoint === -3 ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 4
      
      // Рисуем квадратную зону в углу
      ctx.fillRect(trashX, trashY, trashSize, trashSize)
      ctx.strokeRect(trashX, trashY, trashSize, trashSize)
      
      // Иконка мусорки
      ctx.font = '54px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowBlur = 15
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.fillText('🗑️', trashX + trashSize / 2, trashY + trashSize / 2 - 10)
      
      // Текст
      ctx.font = 'bold 16px Arial'
      ctx.fillStyle = '#fff'
      ctx.shadowBlur = 5
      ctx.fillText('УДАЛИТЬ', trashX + trashSize / 2, trashY + trashSize - 20)
      ctx.restore()
    }
    */
  }, [virtualGameState, selectedPoint, isPlayer1, dragging, dragPosition, hoveredPoint, validTargetPoints, gameMode, animatingChecker, currentPlayer, getPointCoordinates, boardSkinPlayer1, boardSkinPlayer2, checkerSkinPlayer1, checkerSkinPlayer2, opponentBoardColors, myBoardColors, checkerColorsPlayer1, checkerColorsPlayer2, isSandbox])
  
  // Перерисовка при изменении состояния
  useEffect(() => {
    if (canvasRef.current && containerRef.current) {
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      canvasRef.current.width = rect.width
      canvasRef.current.height = rect.height
      drawBoard()
    }
  }, [drawBoard])
  
  // Обработка анимации
  useEffect(() => {
    if (!animatingChecker) return

    let animationFrame: number
    // Увеличиваем длительность анимации для более плавного движения (особенно для бота)
    const duration = 700 // мс (было 800)

    const animate = (time: number) => {
      const elapsed = time - animatingChecker.startTime
      // Используем easing функцию для более плавной анимации
      const linearProgress = Math.min(elapsed / duration, 1)
      // Ease-in-out для плавного ускорения и замедления
      const progress = linearProgress < 0.5 
        ? 2 * linearProgress * linearProgress 
        : 1 - Math.pow(-2 * linearProgress + 2, 3) / 2

      if (linearProgress < 1) {
        setAnimatingChecker(prev => prev ? { ...prev, progress } : null)
        animationFrame = requestAnimationFrame(animate)
      } else {
        // Анимация завершена
        const finishedChecker = animatingChecker
        
        // Сначала сбрасываем выбор
        setSelectedPoint(null)
        setValidTargetPoints(new Set())
        setShowBearOffButton(null)
        
        // Если это серверный ход, добавляем его в список завершенных
        if (finishedChecker.isServerMove) {
          setCompletedServerMoves(prev => [...prev, finishedChecker])
          
          // Если это был последний серверный ход из очереди
          if (serverMoveQueue.length === 0 && onServerMovesFinished) {
            console.log('🤖 All server moves finished')
            // Небольшая задержка перед финальным обновлением gameState,
            // чтобы пользователь увидел шашку в конечной точке
            setTimeout(() => {
              // Сначала очищаем локальные завершенные ходы, чтобы избежать дублирования
              // при обновлении основного gameState из пропсов
              setCompletedServerMoves([]) 
              onServerMovesFinished()
            }, 300)
          }
        } else {
          // Локальный ход пользователя
          onMove(finishedChecker.from, finishedChecker.to, finishedChecker.die, finishedChecker.steps)
        }
        
        setAnimatingChecker(null)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [animatingChecker, onMove])

  // Вспомогательная функция для запуска анимации
  const startMoveAnimation = (from: number, to: number, die: number, steps?: any[]) => {
    setAnimatingChecker({
      from,
      to,
      die,
      steps,
      progress: 0,
      startTime: performance.now()
    })
    // Сбрасываем состояния взаимодействия
    setSelectedPoint(null)
    setDragging(null)
    setDragPosition(null)
    setHoveredPoint(null)
    setValidTargetPoints(new Set())
    setShowBearOffButton(null)
  }

  const [containerHeight, setContainerHeight] = useState(0)
  
  // Обновление размера canvas
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current
        const rect = container.getBoundingClientRect()
        canvasRef.current.width = rect.width
        canvasRef.current.height = rect.height
        setContainerHeight(rect.height)
        drawBoard()
      }
    })
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    
    return () => resizeObserver.disconnect()
  }, [drawBoard])
  
  // Обработка тройного клика (быстрый ход) - через счетчик кликов
  const handleTripleClick = (pointIndex: number) => {
    if (!canMove || !isMyTurn) return
    
    // Устанавливаем флаг, что это тройной клик
    isTripleClickRef.current = true
    
    // Отменяем таймаут одинарного клика
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
    
    // Очищаем историю кликов
    clickHistoryRef.current = []
    
    // Ищем возможные ходы для этой точки
    const moves = possibleMoves.filter(m => m.from === pointIndex)
    if (moves.length === 0) {
      isTripleClickRef.current = false
      return
    }
    
    // Приоритет хода для тройного клика:
    // 1. Если есть ход на вынос (bearing off) - делаем его
    // 2. Если есть несколько ходов, берем тот, что использует большую кость (обычно выгоднее)
    // 3. Если есть комбинированный ход (steps) - приоритет ему
    // 4. Иначе берем первый доступный
    
    let bestMove = moves.find(m => m.to === -1) // Bearing off
    
    if (!bestMove) {
      // Ищем одиночные ходы сначала (не комбинированные)
      const singleMoves = moves.filter(m => !(m as any).steps || (m as any).steps.length <= 1)
      if (singleMoves.length > 0) {
        // Сортируем по значению кубика (по убыванию), чтобы использовать больший кубик
        const sortedMoves = [...singleMoves].sort((a, b) => b.die - a.die)
        bestMove = sortedMoves[0]
      } else {
        // Если только комбинированные - берем с наибольшей суммой
        const sortedCombined = [...moves].sort((a, b) => {
          const aSum = (a as any).steps?.reduce((sum: number, s: any) => sum + s.die, 0) || a.die
          const bSum = (b as any).steps?.reduce((sum: number, s: any) => sum + s.die, 0) || b.die
          return bSum - aSum
        })
        bestMove = sortedCombined[0]
      }
    }
    
    if (bestMove) {
      // Выполняем быстрый ход
      startMoveAnimation(bestMove.from, bestMove.to, bestMove.die, (bestMove as any).steps)
    }
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      isTripleClickRef.current = false
    }, 100)
  }

  // Обработка начала касания (мобильные устройства)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Предотвращаем конфликт с Telegram приложением и стандартное поведение браузера
    e.stopPropagation()
    if (e.cancelable) {
      e.preventDefault()
    }
    // Предотвращаем zoom и выделение
    if (e.touches.length > 1) {
      // Множественное касание - предотвращаем zoom
      return
    }
    // Блокируем ходы во время анимации хода
    if (animatingChecker) return
    if (!isSandbox && (!canMove || !isMyTurn)) return
    if (!canvasRef.current) return
    
    // Предотвращаем прокрутку страницы при перетаскивании шашки
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      
      // В sandbox режиме обрабатываем перетаскивание из bearOff
      if (isSandbox) {
        const checkerColor = getBearOffAtPosition(x, y, canvas)
        if (checkerColor) {
          const bWidth = canvas.width * 0.06
          const lContainerX = 0
          const rContainerX = canvas.width - bWidth
          const areaX = (checkerColor === 'white' ? (isPlayer1 ? rContainerX : lContainerX) : (isPlayer1 ? lContainerX : rContainerX)) + bWidth / 2
          const areaY = checkerColor === 'white' ? canvas.height - 75 : 75
          
          setDragging({ 
            pointIndex: -1, 
            offsetX: x - areaX, 
            offsetY: y - areaY, 
            checkerColor 
          })
          setDragPosition({ x, y })
            return
          }
        }
        
      const pointIndex = getPointAtPosition(x, y, canvas)
      if (pointIndex !== null) {
        const points = virtualGameState?.points || []
        const bar = virtualGameState?.bar || { white: 0, black: 0 }
        
        let pointValue = 0
        if (pointIndex === 24) pointValue = bar.white
        else if (pointIndex === 25) pointValue = -bar.black // Для черных используем отрицательное значение
        else pointValue = points[pointIndex] || 0
        
        // В sandbox разрешаем перетаскивать любую шашку за обе стороны
        // В режиме расстановки сразу включаем свободное перемещение
        if (isSandbox) {
          if (pointValue !== 0) {
            if (sandboxMode === 'setup') {
              const { x: pX, y: pY } = getPointCoordinates(pointIndex, canvas)
              setDragging({ 
                pointIndex, 
                offsetX: x - pX, 
                offsetY: y - pY,
                freeMove: true 
              })
              setDragPosition({ x, y })
              return
            }

            longPressStartRef.current = { x, y, pointIndex }
            longPressTimerRef.current = window.setTimeout(() => {
              if (longPressStartRef.current && canvasRef.current) {
                const { pointIndex: startPoint, x: startX, y: startY } = longPressStartRef.current
                const { x: pX, y: pY } = getPointCoordinates(startPoint, canvasRef.current)
                setDragging({ 
                  pointIndex: startPoint, 
                  offsetX: startX - pX, 
                  offsetY: startY - pY,
                  freeMove: true 
                })
                setDragPosition({ x: startX, y: startY })
                longPressStartRef.current = null
              }
            }, 300)
          }
        }

        const activePlayer = isSandbox ? currentPlayer : (isPlayer1 ? 0 : 1)
        const isMyChecker = isSandbox ? pointValue !== 0 : (activePlayer === 0 ? pointValue > 0 : pointValue < 0)
        const isMyBar = isSandbox 
          ? (pointIndex === 24 ? (virtualGameState?.bar?.white || 0) > 0 : (pointIndex === 25 ? (virtualGameState?.bar?.black || 0) > 0 : false))
          : ((pointIndex === 24 && activePlayer === 0 && pointValue > 0) || (pointIndex === 25 && activePlayer === 1 && pointValue < 0))
        
        if (isMyChecker || isMyBar) {

          const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
          const { x: pointX, y: pointY } = getPointCoordinates(pointIndex, canvas)
          
          setDragging({ pointIndex, offsetX: x - pointX, offsetY: y - pointY })
          setDragPosition({ x, y })
          setSelectedPoint(pointIndex)
          
          const validTargets = new Set<number>()
          pointMoves.forEach(move => {
            if (move.to !== undefined && move.to !== null) {
              validTargets.add(move.to)
            }
          })
          setValidTargetPoints(validTargets)
        }
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    // Предотвращаем прокрутку, zoom и другие стандартные жесты
    if (e.cancelable) {
      e.preventDefault()
    }
    e.stopPropagation()
    
    const touch = e.touches[0]
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    // Если началось движение, отменяем таймер долгого зажатия
    if (longPressTimerRef.current && longPressStartRef.current) {
      const startPos = longPressStartRef.current
      const distance = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2))
      if (distance > 10) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
        longPressStartRef.current = null
      }
    }

    if (!dragging) return
    
    // Если множественное касание - прерываем перетаскивание
    if (e.touches.length > 1) {
      setDragging(null)
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      return
    }
    
    setDragPosition({ x, y })
    const hovered = getPointAtPosition(x, y, canvas)
    // В sandbox разрешаем подсветку всех зон
    setHoveredPoint(hovered)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Отменяем таймер долгого зажатия при отпускании
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null

    // Предотвращаем стандартное поведение
    if (e.cancelable) {
      e.preventDefault()
    }
    e.stopPropagation()
    if (!dragging || !canvasRef.current) return
    
    const canvas = canvasRef.current
    
    // Сохраняем исходную точку перетаскивания
    const fromPoint = dragging.pointIndex
    
    // У TouchEnd нет координат в e.touches, используем последнюю позицию dragPosition
    if (dragPosition) {
      const x = dragPosition.x
      const y = dragPosition.y
      const targetPoint = getPointAtPosition(x, y, canvas)
      
      // В sandbox режиме обрабатываем drop в мусорку или другие специальные действия
      if (isSandbox) {
        // 1. Drop в мусорку (из любой точки)
        if (targetPoint === -3) {
          if (handleRemoveChecker(fromPoint, dragging.checkerColor)) {
            setDragging(null)
            setDragPosition(null)
            setHoveredPoint(null)
            return
          }
        }

        // 2. Drop из bearOff
        if (fromPoint === -1 && dragging.checkerColor && onSandboxCheckerDrop) {
          if (targetPoint !== null && targetPoint !== 24 && targetPoint !== 25 && targetPoint !== -1) {
            onSandboxCheckerDrop(targetPoint, dragging.checkerColor)
          }
          setDragging(null)
          setDragPosition(null)
          setHoveredPoint(null)
          return
        }
        
        // 3. Свободное перемещение (долгое зажатие)
        if (dragging.freeMove && fromPoint !== -1) {
          if (targetPoint !== null && fromPoint !== targetPoint) {
            const points = virtualGameState?.points || []
            const currentBar = { ...(virtualGameState.bar || { white: 0, black: 0 }) }
            const currentBearOff = { ...(virtualGameState.bearOff || { white: 0, black: 0 }) }
            const currentPoints = [...points]
            
            let isWhite = false
            let hasChecker = false
            
            // 1. Убираем шашку из исходной точки
            if (fromPoint === 24) {
              if (currentBar.white > 0) {
                currentBar.white--
                isWhite = true
                hasChecker = true
              }
            } else if (fromPoint === 25) {
              if (currentBar.black > 0) {
                currentBar.black--
                isWhite = false
                hasChecker = true
              }
            } else if (fromPoint >= 0 && fromPoint < 24) {
              const val = currentPoints[fromPoint]
              if (val !== 0) {
                isWhite = val > 0
                currentPoints[fromPoint] = isWhite ? val - 1 : val + 1
                hasChecker = true
              }
            }
            
            if (hasChecker) {
              // 2. Добавляем в целевую точку (или удаляем)
              if (targetPoint === -1) {
                if (isWhite) currentBearOff.white++
                else currentBearOff.black++
              } else if (targetPoint === 24) {
                currentBar.white++
              } else if (targetPoint === 25) {
                currentBar.black++
              } else if (targetPoint >= 0 && targetPoint < 24) {
                if (isWhite) {
                  currentPoints[targetPoint] = (currentPoints[targetPoint] || 0) + 1
                } else {
                  currentPoints[targetPoint] = (currentPoints[targetPoint] || 0) - 1
                }
              }
              
              if (gameId) {
                apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
                  points: currentPoints,
                  bar: currentBar,
                  bearOff: currentBearOff,
                }).then(() => {
                  window.dispatchEvent(new CustomEvent('sandbox-board-updated'))
                }).catch(console.error)
              }
            }
          }
          setDragging(null)
          setDragPosition(null)
          setHoveredPoint(null)
          return
        }
      }
      
      // Критически важно: проверяем, что целевая точка не является исходной точкой перетаскивания
      // и что ход действительно существует для ИСХОДНОЙ точки (fromPoint)
      if (targetPoint !== null && targetPoint !== fromPoint) {
        if (targetPoint === -1) {
          // Ход на вынос - проверяем, что ход есть именно из исходной точки
          const bearOffMove = possibleMoves.find(m => m.from === fromPoint && m.to === -1)
          if (bearOffMove) {
            startMoveAnimation(bearOffMove.from, bearOffMove.to, bearOffMove.die, (bearOffMove as any).steps)
            return // startMoveAnimation сам все сбросит
          }
        } else {
          // Обычный ход - проверяем, что целевая точка валидна и ход существует для исходной точки
          if (validTargetPoints.has(targetPoint)) {
            const move = possibleMoves.find(m => m.from === fromPoint && m.to === targetPoint)
            if (move) {
              startMoveAnimation(move.from, move.to, move.die, (move as any).steps)
              return // startMoveAnimation сам все сбросит
            }
          }
        }
      }
    }
    
    // Если ход не был выполнен, сбрасываем состояние перетаскивания
    setDragging(null)
    setDragPosition(null)
    setSelectedPoint(null)
    setHoveredPoint(null)
    setValidTargetPoints(new Set())
  }

  // Проверка клика по bearOff области для sandbox
  const getBearOffAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement): 'white' | 'black' | null => {
    if (!isSandbox) return null
    const width = canvas.width
    const height = canvas.height
    const bearOffWidth = width * 0.06
    const leftContainerX = 0
    const rightContainerX = width - bearOffWidth
    
    const bearOff = virtualGameState?.bearOff || { white: 0, black: 0 }
    
    // Белые шашки в bearOff (справа сверху для player1)
    const whiteX = isPlayer1 ? rightContainerX : leftContainerX
    if (x >= whiteX && x <= whiteX + bearOffWidth && y >= 0 && y <= 300) {
      if (bearOff.white > 0) return 'white'
    }
    
    // Черные шашки в bearOff (слева снизу для player1)
    const blackX = isPlayer1 ? leftContainerX : rightContainerX
    if (x >= blackX && x <= blackX + bearOffWidth && y >= height - 300 && y <= height) {
      if (bearOff.black > 0) return 'black'
    }
  }, [isSandbox, isPlayer1, virtualGameState])

  // Вспомогательная функция для удаления шашки (мусорка)
  const handleRemoveChecker = useCallback((fromPoint: number, checkerColor?: 'white' | 'black') => {
    if (!gameId || !virtualGameState) {
      console.error('🗑️ Ошибка: gameId или virtualGameState отсутствуют')
      return false
    }

    const currentBar = { ...(virtualGameState.bar || { white: 0, black: 0 }) }
    const currentBearOff = { ...(virtualGameState.bearOff || { white: 0, black: 0 }) }
    const currentPoints = Array.isArray(virtualGameState.points) ? [...virtualGameState.points] : Array(24).fill(0)
    let hasChecker = false

    console.log('🗑️ Попытка удаления шашки:', { fromPoint, checkerColor, currentBar, currentBearOff })

    if (fromPoint === 24) { // Белый бар
      if (currentBar.white > 0) {
        currentBar.white--
        hasChecker = true
      }
    } else if (fromPoint === 25) { // Черный бар
      if (currentBar.black > 0) {
        currentBar.black--
        hasChecker = true
      }
    } else if (fromPoint >= 0 && fromPoint < 24) { // Точка на доске
      const val = currentPoints[fromPoint] || 0
      if (val !== 0) {
        currentPoints[fromPoint] = val > 0 ? val - 1 : val + 1
        hasChecker = true
      }
    } else if (fromPoint === -1 && checkerColor) { // Зона выноса
      if (checkerColor === 'white') {
        if (currentBearOff.white > 0) {
          currentBearOff.white--
          hasChecker = true
        }
      } else {
        if (currentBearOff.black > 0) {
          currentBearOff.black--
          hasChecker = true
        }
      }
    }

    if (hasChecker) {
      console.log('🗑️ Шашка найдена, отправка запроса на сервер...')
      apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
        points: currentPoints,
        bar: currentBar,
        bearOff: currentBearOff,
      }).then(() => {
        console.log('🗑️ Сервер подтвердил удаление, обновляем UI')
        window.dispatchEvent(new CustomEvent('sandbox-board-updated'))
      }).catch(err => {
        console.error('🗑️ Ошибка сервера при удалении:', err)
      })
      return true
    }
    
    console.warn('🗑️ Шашка не найдена в исходной точке:', fromPoint)
    return false
  }, [virtualGameState, gameId])

  // Обработка начала перетаскивания
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // console.log('MouseDown', { canMove, isMyTurn, dragging })
    // Блокируем ходы во время анимации хода
    if (animatingChecker) return
    
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // В sandbox режиме обрабатываем перетаскивание из bearOff
    if (isSandbox) {
      const checkerColor = getBearOffAtPosition(x, y, canvas)
      if (checkerColor) {
        // Начинаем перетаскивание шашки из bearOff
        // Рассчитываем координаты центра области для корректного отображения перетаскивания
        const bWidth = canvas.width * 0.06
        const lContainerX = 0
        const rContainerX = canvas.width - bWidth
        const areaX = (checkerColor === 'white' ? (isPlayer1 ? rContainerX : lContainerX) : (isPlayer1 ? lContainerX : rContainerX)) + bWidth / 2
        const areaY = checkerColor === 'white' ? canvas.height - 75 : 75
        
        setDragging({ 
          pointIndex: -1, 
          offsetX: x - areaX, 
          offsetY: y - areaY, 
          checkerColor 
        })
        setDragPosition({ x, y })
        return
      }
      
      // В sandbox режиме разрешаем обычные ходы, если есть кубики
      const hasDice = dice && (Array.isArray(dice) ? dice.length > 0 : (dice.die1 !== undefined || dice.die2 !== undefined))
      
      // Проверяем клик по шашке для долгого зажатия (работает всегда, даже с кубиками)
      const pointIndex = getPointAtPosition(x, y, canvas)
      if (pointIndex !== null && pointIndex !== -1) {
        const points = virtualGameState?.points || []
        const bar = virtualGameState?.bar || { white: 0, black: 0 }
        
        let pointValue = 0
        if (pointIndex === 24) pointValue = bar.white
        else if (pointIndex === 25) pointValue = -bar.black // Используем минус для черных
        else pointValue = points[pointIndex] || 0
        
        // В sandbox разрешаем перетаскивать любую шашку (не только свою)
        if (pointValue !== 0) {
          // В режиме расстановки сразу включаем свободное перемещение
          if (sandboxMode === 'setup') {
            const { x: pX, y: pY } = getPointCoordinates(pointIndex, canvas)
            setDragging({ 
              pointIndex, 
              offsetX: x - pX, 
              offsetY: y - pY,
              freeMove: true 
            })
            setDragPosition({ x, y })
            return
          }

          // Сохраняем начальную позицию для долгого зажатия (для режима интерактива)
          longPressStartRef.current = { x, y, pointIndex }
          // Запускаем таймер долгого зажатия (300мс для sandbox)
          longPressTimerRef.current = window.setTimeout(() => {
            if (longPressStartRef.current && canvasRef.current) {
              // Активируем режим свободного перемещения
              const { pointIndex: startPoint, x: startX, y: startY } = longPressStartRef.current
              const { x: pointX, y: pointY } = getPointCoordinates(startPoint, canvasRef.current)
              setDragging({ 
                pointIndex: startPoint, 
                offsetX: startX - pointX, 
                offsetY: startY - pointY,
                freeMove: true 
              })
              setDragPosition({ x: startX, y: startY })
              longPressStartRef.current = null
            }
          }, 300)
        }
      }
      
      // Если нет кубиков, не разрешаем обычные ходы
    } else {
      if (!canMove || !isMyTurn) return
    }
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    
    if (pointIndex === null) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }
    
    // Для коротких нард: если есть шашки на баре, блокируем клики по точкам на доске
    if (gameMode === 'short' && !isSandbox) { // В sandbox не блокируем
      const bar = virtualGameState?.bar || { white: 0, black: 0 }
      const activePlayer = isPlayer1 ? 0 : 1
      const hasBarCheckers = activePlayer === 0 ? bar.white > 0 : bar.black > 0
      
      if (hasBarCheckers && pointIndex !== 24 && pointIndex !== 25) {
        setSelectedPoint(null)
        setValidTargetPoints(new Set())
        setShowBearOffButton(null)
        return
      }
    }
    
    const points = virtualGameState?.points || []
    let pointValue = 0
    
    if (pointIndex === 24 || pointIndex === 25) {
      const bar = virtualGameState?.bar || { white: 0, black: 0 }
      if (pointIndex === 24) pointValue = bar.white
      else pointValue = -bar.black
    } else if (pointIndex >= 0 && pointIndex < points.length) {
      pointValue = points[pointIndex]
    }
    
    if (pointValue === 0 && pointIndex !== -3) { // Разрешаем клик по мусорке
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }
    
    // В sandbox разрешаем тащить ЛЮБУЮ шашку (свою или чужую)
    // В обычном режиме только свою
    const activePlayer = isPlayer1 ? 0 : 1
    const isMyChecker = isSandbox ? pointValue !== 0 : (activePlayer === 0 ? pointValue > 0 : pointValue < 0)
    const isMyBar = isSandbox 
      ? (pointIndex === 24 ? (virtualGameState?.bar?.white || 0) > 0 : (pointIndex === 25 ? (virtualGameState?.bar?.black || 0) > 0 : false))
      : ((pointIndex === 24 && activePlayer === 0) || (pointIndex === 25 && activePlayer === 1))
    
    if (!isMyChecker && !isMyBar && pointIndex !== -3 && !isSandbox) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }
    
    const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
    const { x: pX, y: pY } = getPointCoordinates(pointIndex, canvas)
    
    setDragging({ pointIndex, offsetX: x - pX, offsetY: y - pY })
    setDragPosition({ x, y })
    setSelectedPoint(pointIndex)
    
    const validTargets = new Set<number>()
    let bearOffDie: number | null = null
    pointMoves.forEach(move => {
      if (move.to !== undefined && move.to !== null) {
        validTargets.add(move.to)
        if (move.to === -1) bearOffDie = move.die
      }
    })
    setValidTargetPoints(validTargets)
    
    if (bearOffDie !== null) {
      setShowBearOffButton({ pointIndex, die: bearOffDie })
    } else {
      setShowBearOffButton(null)
    }
  }
  
  // Обработка движения мыши
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Если началось движение мыши, отменяем таймер долгого зажатия (если переместились больше чем на 5 пикселей)
    if (longPressTimerRef.current && longPressStartRef.current) {
      const startPos = longPressStartRef.current
      const distance = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2))
      // Если переместились больше чем на 5 пикселей, отменяем долгое зажатие
      if (distance > 5) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
        longPressStartRef.current = null
      }
    }
    
    // В sandbox режиме обновляем позицию перетаскивания из bearOff или свободного перемещения
    if (isSandbox && dragging) {
      if (dragging.pointIndex === -1 || dragging.freeMove) {
        setDragPosition({ x, y })
        // Подсвечиваем точку под курсором
        const pointIndex = getPointAtPosition(x, y, canvas)
        // Для sandbox разрешаем подсветку всех специальных зон (мусорка, бар, bearoff)
        setHoveredPoint(pointIndex)
        return
      }
    }
    
    if (dragging) {
      setDragPosition({ x, y })
      const hovered = getPointAtPosition(x, y, canvas)
      setHoveredPoint(hovered)
    } else {
      setHoveredPoint(null)
    }
  }
  
  // Обработка отпускания мыши
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Отменяем таймер долгого зажатия при отпускании мыши
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
    
    if (!dragging || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Сохраняем исходную точку перетаскивания
    const fromPoint = dragging.pointIndex
        const targetPoint = getPointAtPosition(x, y, canvas)
    
    // В sandbox режиме обрабатываем специальные действия
    if (isSandbox) {
      // 1. Drop из bearOff в обычную точку (для расстановки)
      if (fromPoint === -1 && dragging.checkerColor && onSandboxCheckerDrop) {
        if (targetPoint !== null && targetPoint !== 24 && targetPoint !== 25 && targetPoint !== -1) {
          onSandboxCheckerDrop(targetPoint, dragging.checkerColor)
        }
        setDragging(null)
        setDragPosition(null)
        setHoveredPoint(null)
        return
      }
      
      // 3. Свободное перемещение (долгое зажатие)
      if (dragging.freeMove && fromPoint !== -1) {
        if (targetPoint !== null && fromPoint !== targetPoint) {
          const points = virtualGameState?.points || []
          const currentBar = { ...(virtualGameState.bar || { white: 0, black: 0 }) }
          const currentBearOff = { ...(virtualGameState.bearOff || { white: 0, black: 0 }) }
            const currentPoints = [...points]
          
          let isWhite = false
          let hasChecker = false
          
          // 1. Убираем шашку из исходной точки
          if (fromPoint === 24) {
            if (currentBar.white > 0) {
              currentBar.white--
              isWhite = true
              hasChecker = true
            }
          } else if (fromPoint === 25) {
            if (currentBar.black > 0) {
              currentBar.black--
              isWhite = false
              hasChecker = true
            }
          } else if (fromPoint >= 0 && fromPoint < 24) {
            const val = currentPoints[fromPoint]
            if (val !== 0) {
              isWhite = val > 0
              currentPoints[fromPoint] = isWhite ? val - 1 : val + 1
              hasChecker = true
            }
          }
          
          if (hasChecker) {
            // 2. Добавляем в целевую точку (или удаляем)
            if (targetPoint === -1) {
              if (isWhite) currentBearOff.white++
              else currentBearOff.black++
            } else if (targetPoint === 24) {
              currentBar.white++
            } else if (targetPoint === 25) {
              currentBar.black++
            } else if (targetPoint >= 0 && targetPoint < 24) {
              if (isWhite) {
              currentPoints[targetPoint] = (currentPoints[targetPoint] || 0) + 1
              } else {
              currentPoints[targetPoint] = (currentPoints[targetPoint] || 0) - 1
              }
            }
            
            if (gameId) {
              apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
                points: currentPoints,
                bar: currentBar,
                bearOff: currentBearOff,
              }).then(() => {
                window.dispatchEvent(new CustomEvent('sandbox-board-updated'))
              }).catch(console.error)
            }
          }
        }
        setDragging(null)
        setDragPosition(null)
        setHoveredPoint(null)
        return
      }
    }
    
    // Критически важно: проверяем, что целевая точка не является исходной точкой перетаскивания
    // и что ход действительно существует для ИСХОДНОЙ точки (fromPoint)
    if (targetPoint !== null && targetPoint !== fromPoint) {
      if (targetPoint === -1) {
        // Ход на вынос - проверяем, что ход есть именно из исходной точки
        const bearOffMove = possibleMoves.find(m => m.from === fromPoint && m.to === -1)
        if (bearOffMove) {
          startMoveAnimation(bearOffMove.from, bearOffMove.to, bearOffMove.die, bearOffMove.steps)
          return
        }
      } else {
        // Обычный ход - проверяем, что целевая точка валидна и ход существует для исходной точки
        if (validTargetPoints.has(targetPoint)) {
          const move = possibleMoves.find(m => m.from === fromPoint && m.to === targetPoint)
          if (move) {
            startMoveAnimation(move.from, move.to, move.die, move.steps)
            return
          }
        }
      }
    }
    
    // Если ход не был выполнен, сбрасываем состояние перетаскивания
    setDragging(null)
    setDragPosition(null)
    // Сбрасываем все выделения после перемещения - нужно ПОВТОРНО ВЫБРАТЬ ШАШКУ
    setSelectedPoint(null)
    setValidTargetPoints(new Set())
    setShowBearOffButton(null)
    setHoveredPoint(null)
  }
  
  // Обработка клика с защитой от двойных кликов
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) return
    // Блокируем ходы во время анимации хода
    if (animatingChecker) return
    
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    // Если это тройной клик, игнорируем одинарный клик
    if (isTripleClickRef.current) {
      isTripleClickRef.current = false
      return
    }
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    if (pointIndex === null) return
    
    // Проверяем тройной клик
    const now = Date.now()
    const CLICK_DELAY = 400 // мс между кликами для тройного клика
    const history = clickHistoryRef.current
    
    // Удаляем старые клики (старше CLICK_DELAY)
    const recentHistory = history.filter(click => (now - click.timestamp) < CLICK_DELAY)
    
    // Проверяем, является ли это третьим кликом подряд на той же точке
    const samePointClicks = recentHistory.filter(click => click.pointIndex === pointIndex)
    if (samePointClicks.length >= 2 && pointIndex === samePointClicks[0].pointIndex) {
      // Это третий клик - выполняем быстрый ход
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
      clickHistoryRef.current = []
      handleTripleClick(pointIndex)
      return
    }
    
    // Добавляем текущий клик в историю
    clickHistoryRef.current = [...recentHistory, { pointIndex, timestamp: now }]
    
    // Устанавливаем таймаут для обработки одинарного клика
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
    }
    
    clickTimeoutRef.current = window.setTimeout(() => {
      // Если таймаут истек, значит это был одинарный клик
      const latestClick = clickHistoryRef.current[clickHistoryRef.current.length - 1]
      if (latestClick && latestClick.pointIndex === pointIndex) {
        handlePointClick(pointIndex)
        clickHistoryRef.current = []
      }
      clickTimeoutRef.current = null
    }, CLICK_DELAY)
  }
  
  const handlePointClick = (pointIndex: number) => {
    if (!canMove || !isMyTurn) return
    
    // Если уже была выбрана точка, и мы кликнули на неё же - отменяем выбор
    if (selectedPoint === pointIndex) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }

    const points = virtualGameState?.points || []
    const bar = virtualGameState?.bar || { white: 0, black: 0 }
    let pointValue = 0
    if (pointIndex === 24) pointValue = bar.white
    else if (pointIndex === 25) pointValue = -bar.black
    else pointValue = points[pointIndex] || 0

    // Проверяем, есть ли ходы из этой точки
    const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
    
    if (selectedPoint === null) {
      // Если ничего не выбрано, выбираем текущую точку (если из неё есть ходы)
      // В Sandbox разрешаем клик по любой шашке, если для нее есть ходы
      if (pointMoves.length > 0) {
        setSelectedPoint(pointIndex)
        const targets = new Set<number>()
        let bearOffDie: number | null = null
        let bearOffSteps: any[] | undefined = undefined
        pointMoves.forEach(m => {
          targets.add(m.to)
          if (m.to === -1) {
            bearOffDie = m.die
            bearOffSteps = (m as any).steps
          }
        })
        setValidTargetPoints(targets)
        if (bearOffDie !== null) {
          setShowBearOffButton({ pointIndex, die: bearOffDie, steps: bearOffSteps })
        } else {
          setShowBearOffButton(null)
        }
      }
    } else {
      // Если точка уже была выбрана, пытаемся сделать ход
      const move = possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex)
      if (move) {
        startMoveAnimation(move.from, move.to, move.die, (move as any).steps)
      } else {
        // Если ход невозможен, но кликнули на другую свою шашку - переключаем выбор на неё
        if (pointMoves.length > 0) {
          setSelectedPoint(pointIndex)
          const targets = new Set<number>()
          let bearOffDie: number | null = null
          let bearOffSteps: any[] | undefined = undefined
          pointMoves.forEach(m => {
            targets.add(m.to)
            if (m.to === -1) {
              bearOffDie = m.die
              bearOffSteps = (m as any).steps
            }
          })
          setValidTargetPoints(targets)
          if (bearOffDie !== null) {
            setShowBearOffButton({ pointIndex, die: bearOffDie, steps: bearOffSteps })
          } else {
            setShowBearOffButton(null)
          }
        } else {
          // Иначе просто сбрасываем выбор
          setSelectedPoint(null)
          setValidTargetPoints(new Set())
          setShowBearOffButton(null)
        }
      }
    }
  }
  
  // Определение формата кубиков
  const diceArray = dice 
    ? (Array.isArray(dice) ? dice : ('die1' in dice && 'die2' in dice ? [dice.die1, dice.die2] : null))
    : null

  // Определяем использованные кубики из pendingMoves
  // Используем Set для отслеживания индексов использованных кубиков (для дублей)
  const usedDiceIndices = useMemo(() => {
    if (!diceArray || !pendingMoves || pendingMoves.length === 0) {
      return new Set<number>()
    }
    
    const usedIndices = new Set<number>()
    const diceCopy = [...diceArray]
    
    pendingMoves.forEach(move => {
      // Если есть steps, используем их
      if ((move as any).steps && Array.isArray((move as any).steps)) {
        (move as any).steps.forEach((step: any) => {
          const idx = diceCopy.findIndex((d, i) => d === step.die && !usedIndices.has(i))
          if (idx !== -1) {
            usedIndices.add(idx)
            diceCopy[idx] = -1 // Помечаем как использованный
          }
        })
      } else {
        // Ищем кубик по значению
        const idx = diceCopy.findIndex((d, i) => d === move.die && !usedIndices.has(i))
        if (idx !== -1) {
          usedIndices.add(idx)
          diceCopy[idx] = -1
        } else if (gameMode === 'long') {
          // Для длинных нард пробуем найти сумму
          for (let i = 0; i < diceCopy.length; i++) {
            if (usedIndices.has(i)) continue
            for (let j = i + 1; j < diceCopy.length; j++) {
              if (usedIndices.has(j)) continue
              if (diceCopy[i] + diceCopy[j] === move.die) {
                usedIndices.add(i)
                usedIndices.add(j)
                diceCopy[i] = -1
                diceCopy[j] = -1
                break
              }
            }
            if (usedIndices.has(i)) break
          }
        }
      }
    })
    
    return usedIndices
  }, [diceArray, pendingMoves, gameMode])

  // Подсчитываем сколько ходов осталось при дубле
  const remainingMoves = useMemo(() => {
    if (!diceArray || diceArray.length === 0) return 0
    
    const isDoubles = diceArray.length >= 2 && diceArray.every(d => d === diceArray[0])
    if (!isDoubles) return 0
    
    const totalDice = diceArray.length
    const usedCount = usedDiceIndices.size
    return totalDice - usedCount
  }, [diceArray, usedDiceIndices])
  
  return (
    <div ref={containerRef} className="backgammon-board-container">
      <canvas
        ref={canvasRef}
        className="backgammon-board-canvas"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDragOver={(e) => {
          if (isSandbox) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onDrop={(e) => {
          if (isSandbox && dragging && dragging.pointIndex === -1 && dragging.checkerColor && onSandboxCheckerDrop && canvasRef.current) {
            e.preventDefault()
            e.stopPropagation()
            const rect = canvasRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const pointIndex = getPointAtPosition(x, y, canvasRef.current)
            if (pointIndex !== null && pointIndex !== 24 && pointIndex !== 25 && pointIndex !== -1) {
              // Не позволяем бросать на бар или bearOff
              onSandboxCheckerDrop(pointIndex, dragging.checkerColor)
            }
            // Сбрасываем состояние перетаскивания
            setDragging(null)
            setDragPosition(null)
            setHoveredPoint(null)
          }
        }}
        style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} // Отключаем стандартные жесты браузера и Telegram
      />
      
      {/* Панель сброса шашки */}
      {showBearOffButton && canvasRef.current && (
        (() => {
          const coords = getPointCoordinates(showBearOffButton.pointIndex, canvasRef.current)
          const isTop = coords.isTopRow
          const btnX = coords.x
          const btnY = isTop ? coords.pointHeight + 20 : containerHeight - coords.pointHeight - 20
          
          return (
            <div
              className="bear-off-panel"
              style={{
                position: 'absolute',
                left: `${btnX}px`,
                top: `${btnY}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation()
                startMoveAnimation(showBearOffButton.pointIndex, -1, showBearOffButton.die, showBearOffButton.steps)
              }}
            />
          )
        })()
      )}
      
      {/* Кубики - показываем на стороне игрока, у которого ход, закрепляем после анимации внутри доски */}
      {diceArray && diceArray.length > 0 && dice3DPosition && usedDiceIndices.size < diceArray.length && (
        <div
          style={{
            position: 'absolute',
            // Если идет анимация гифки, показываем её в центре экрана
            // После анимации переносим кубики в угол (внизу справа для player1, вверху слева для player2)
            left: diceAnimating 
              ? '50%'  // Во время анимации - в центре
              : `${dice3DPosition.x}px`, // После анимации - в углу
            top: diceAnimating 
              ? '50%'  // Во время анимации - в центре
              : `${dice3DPosition.y}px`, // После анимации - в углу
            width: `${dice3DPosition.size * 7.5}px`,
            height: `${dice3DPosition.size * 4.5}px`,
            transform: 'translate(-50%, -50%)', // Центрируем кубики относительно их позиции
            pointerEvents: 'none',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: diceAnimating ? 'none' : 'all 0.5s ease-out',
            // Гарантируем, что кубики не выходят за границы доски
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {/* Показываем гифку, если она доступна для данного состояния кубиков */}
          <DiceGif 
            dice={diceArray}
            usedDiceIndices={usedDiceIndices}
            animating={diceAnimating}
            size={dice3DPosition.size}
          />

          {/* Если гифка не показывается (например, анимация закончилась), 
              показываем старые 3D кубики для отображения результата */}
          {!diceAnimating && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {(() => {
                const isDoubles = diceArray.length > 2;
                if (isDoubles) {
                  // В Sandbox всегда показываем все кубики по отдельности, чтобы не путать пользователя
                  if (isSandbox) {
                    // Фильтруем только неиспользованные кубики
                    const unusedDice = diceArray.filter((_, index) => !usedDiceIndices.has(index));
                    if (unusedDice.length === 0) return null; // Все кубики использованы
                    
                    return unusedDice.map((dieValue, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <Dice3D
                          values={[dieValue]}
                          animating={false}
                          diceColor={currentPlayer === 0 ? diceColorPlayer1 : diceColorPlayer2}
                        />
                      </div>
                    ));
                  }

                  // Для обычных дублей показываем один кубик с множителем
                  const dieValue = diceArray[0];
                  return (
                    <div style={{ position: 'relative' }}>
                      <Dice3D
                        values={[dieValue]}
                        animating={false}
                        diceColor={currentPlayer === 0 ? diceColorPlayer1 : diceColorPlayer2}
                      />
                      {remainingMoves > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '-10px',
                          background: 'rgba(232, 65, 66, 0.9)',
                          color: 'white',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          zIndex: 10
                        }}>
                          x{remainingMoves}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // Для обычного броска показываем оставшиеся кубики
                  return diceArray.map((dieValue, index) => {
                    if (usedDiceIndices.has(index)) return null;
                    return (
                      <div key={index} style={{ position: 'relative' }}>
                        <Dice3D
                          values={[dieValue]}
                          animating={false}
                          diceColor={currentPlayer === 0 ? diceColorPlayer1 : diceColorPlayer2}
                        />
                      </div>
                    );
                  });
                }
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
