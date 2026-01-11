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

  // --- CONFIGURATIONS ---
  // Large Screen (Desktop) - Optimized
  const DESKTOP_CONFIG = {
    sideMarginPct: 0.049,
    barWidthPct: 0.056,
    topMarginPct: 0.073,
    bearOffHeightPct: 0.131,
    checkerWidthRatio: 1.5,
    checkerHeightRatio: 0.216,
    checkerDrawScale: 1.2,
    diceP1X: 0.66,
    diceP1Y: 0.85,
    diceP2X: 0.90,
    diceP2Y: 0.38,
    checkerTopOffset: -25,
    checkerBottomOffset: -44,
    // Legacy text offsets (for fallback)
    textTopOffset: -15,
    textBottomOffset: 15,
    // New parameters for advanced highlight and text control
    highlightWidthScale: 1.0,
    highlightHeightScale: 1.0,
    highlightXOffset: 0,
    highlightYOffset: 0,
    // Advanced text offsets (quadrants)
    textTopRightY: -15, // Points 19-24 (Indices 0-5)
    textTopLeftY: -15,  // Points 13-18 (Indices 6-11)
    textBottomLeftY: 15, // Points 7-12 (Indices 12-17)
    textBottomRightY: 15, // Points 1-6 (Indices 18-23)
  }

  // Small Screen (Mobile) - Optimized
  const MOBILE_CONFIG = {
    sideMarginPct: 0.041,
    barWidthPct: 0.025,
    topMarginPct: 0.079,
    bearOffHeightPct: 0.139,
    checkerWidthRatio: 1.5,
    checkerHeightRatio: 0.216,
    checkerDrawScale: 1.23,
    diceP1X: 0.55, // Moved closer to center (was 0.75)
    diceP1Y: 0.65,
    diceP2X: 0.09,
    diceP2Y: 0.38, 
    checkerTopOffset: -25, 
    checkerBottomOffset: 33, // Updated from user screenshot (was -44)
    // Legacy text offsets
    textTopOffset: -15,
    textBottomOffset: 15,
    // New parameters for advanced highlight and text control
    highlightWidthScale: 1.0,
    highlightHeightScale: 1.0,
    highlightXOffset: 0,
    highlightYOffset: 0,
    // Advanced text offsets (quadrants)
    textTopRightY: -15,
    textTopLeftY: -15, 
    textBottomLeftY: 15, 
    textBottomRightY: 15,
  }

  // --- DEBUG / ADJUSTMENT MODE ---
  const [debugMode, setDebugMode] = useState(false)
  const [debugConfig, setDebugConfig] = useState(DESKTOP_CONFIG) // Initial state

  // Responsive Config Switcher
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current) {
            const width = containerRef.current.offsetWidth
            // Determine if mobile (e.g. < 768px or aspect ratio check)
            // A common mobile width is < 768px.
            // But user might be rotating screen.
            // Let's use 768px as breakpoint.
            if (width < 768) {
                // Apply Mobile Config if not already applied (and if not manually debugging)
                // Note: If user is actively debugging, we might overwrite their manual changes.
                // But for production, this is what we want.
                // We will only update if not in debug mode OR if we want to reset.
                // For now, let's just update setDebugConfig so the board uses it.
                if (!debugMode) {
                     setDebugConfig(MOBILE_CONFIG)
                }
            } else {
                if (!debugMode) {
                     setDebugConfig(DESKTOP_CONFIG)
                }
            }
        }
    }

    // Call on mount
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [debugMode])

  // Test dice for debug mode
  const [debugDice, setDebugDice] = useState<number[] | null>(null)

  // Ref for loaded images
  const imagesRef = useRef<Record<string, HTMLImageElement>>({})
  // State to force re-render when images load
  const [imagesLoaded, setImagesLoaded] = useState(false)

  // Add debug effect to update dice when config changes
  useEffect(() => {
    // Force dice update when debug config changes
    if (debugMode) {
        // Force re-render/re-calculate
        const event = new Event('resize');
        window.dispatchEvent(event);
    }
  }, [debugConfig, debugMode])

  useEffect(() => {
    const sources = {
      white: '/img/checker-white.png',
      red: '/img/checker-red.png',
      whiteSide: '/img/checker-side-white.png',
      redSide: '/img/checker-side-red.png',
      skin: '/img/skin1.png'
    }

    let loadedCount = 0
    const totalCount = Object.keys(sources).length
    let isMounted = true

    Object.entries(sources).forEach(([key, src]) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        if (!isMounted) return
        imagesRef.current[key] = img
        loadedCount++
        if (loadedCount === totalCount) {
          setImagesLoaded(true)
        }
      }
      // Cache even if not loaded yet (will be updated on load)
      imagesRef.current[key] = img
    })
    
    return () => { isMounted = false }
  }, [])
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
        imageUrl: '/img/skin1.png', // Default skin image
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
      imageUrl: boardSkin.imageUrl || boardSkin.boardTextureUrl || '/img/skin1.png', // Use skin image if available, else default
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
  
  // Вспомогательная функция для получения координат точки
  const getPointCoordinates = useCallback((pointIndex: number, canvas: HTMLCanvasElement) => {
    const width = canvas.width
    const height = canvas.height
    
    // ПАРАМЕТРЫ ПОДГОНКИ ПОД СКИН (skin1.png)
    // Лот для скида снизу -> bearOffHeight
    const bearOffHeight = height * debugConfig.bearOffHeightPct
    const topMargin = height * debugConfig.topMarginPct
    // Уменьшаем отступы сбоку и ширину бара, чтобы треугольники стали шире
    const sideMargin = width * debugConfig.sideMarginPct
    
    // Рабочая область доски (без лотка и рамки)
    const playAreaHeight = height - bearOffHeight - topMargin
    
    // Центральная полоса (бар)
    const barWidth = width * debugConfig.barWidthPct
    // Ширина одной половины игрового поля
    const halfBoardWidth = (width - (sideMargin * 2) - barWidth) / 2
    
    const pointWidth = halfBoardWidth / 6
    const pointHeight = playAreaHeight * 0.42 // Высота треугольников
    
    const isTopRow = pointIndex < 12
    
    let x = 0
    let pointNumber = 0
    
    if (isTopRow) {
      pointNumber = 24 - pointIndex
      const isRightSide = pointIndex < 6
      
      if (isRightSide) {
        const pointInHalf = pointIndex
        // Справа: отступ справа (sideMargin)
        x = (width - sideMargin) - (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        const pointInHalf = pointIndex - 6
        // Слева: отступ слева (sideMargin) + пол-доски + бар - (позиция)
        // Но треугольники 7-12 находятся слева от бара.
        // Индексы 6-11 (точки 13-18) - это левая верхняя часть?
        // Нет:
        // isTopRow (0-11) -> точки 24..13.
        //   0-5 -> 24..19 (Левый верх? или Правый верх?)
        //   В стандартной расстановке:
        //   Top Right: 19-24 (Black Home) -> indices 0-5 ? No.
        //   Let's check standard logic:
        //   pointIndex 0 -> point 24. 
        //   If White moves 24 -> 1. 24 is Opponent Home.
        //   Standard: 13-24 is Top. 1-12 is Bottom.
        //   24 is Top Left? Or Top Right?
        //   Usually Top Right is 19-24 (White's perspective opponent home).
        //   Let's stick to current logic:
        //     isRightSide = pointIndex < 6. -> Points 24, 23, 22, 21, 20, 19.
        //     If isRightSide is drawn on RIGHT, then 19-24 are on Right.
        
        // Корректировка под скин:
        // Точки 19-24 (индексы 0-5) - Слева или Справа?
        // Обычно 1-6 (Дом белых) внизу справа.
        // Значит 19-24 (Дом черных) вверху слева.
        // Значит индексы 0-5 (24..19) должны быть СЛЕВА.
        // А индексы 6-11 (18..13) должны быть СПРАВА.
        
        // ПРОВЕРКА ТЕКУЩЕЙ ЛОГИКИ (ДО ИЗМЕНЕНИЙ):
        // if (isRightSide) { x = boardEndX ... } -> Рисует справа.
        // Значит индексы 0-5 были Справа. То есть 24..19 Справа.
        // Это значит 1-6 Внизу Справа? (isTopRow = false).
        // else { ... } -> 12..1 (indices 12-23).
        // isLeftSide = pointIndex < 18 (indices 12-17 -> points 12..7).
        //   Drawn at boardStartX (Left).
        // indices 18-23 -> points 6..1. Drawn at Right.
        
        // ИТОГ: 
        // 1-6 (Дом белых) - Внизу Справа.
        // 19-24 (Дом черных) - Вверху Справа?
        // Нет, 1-6 и 19-24 находятся друг над другом.
        // Значит 24 над 1.
        // Если 1-6 Внизу Справа, то 24-19 Вверху Справа.
        
        // Значит индексы 0-5 (24..19) -> Справа.
        // Индексы 6-11 (18..13) -> Слева.
        
        // Слева: sideMargin + отступ
        // Но порядок рисования: 18, 17... 13. (Слева направо или Справа налево?)
        // 13 - крайний левый? или 18?
        // Стандарт: 12 слева внизу. 13 слева вверху.
        // Значит 13 (index 11) - крайний левый.
        // 18 (index 6) - ближе к бару.
        
        // Расчет x для левой верхней четверти:
        // x = (sideMargin + halfBoardWidth) - (pointInHalf * pointWidth + pointWidth/2)
        // Если pointInHalf = 0 (index 6, point 18), x должен быть у бара.
        // Если pointInHalf = 5 (index 11, point 13), x должен быть у левого края.
        
        x = (sideMargin + halfBoardWidth) - (pointInHalf * pointWidth + pointWidth / 2)
      }
    } else {
      pointNumber = 12 - (pointIndex - 12)
      const isLeftSide = pointIndex < 18 // 12-17 -> points 12..7
      
      if (isLeftSide) {
        // Левый низ (12..7)
        // 12 - крайний левый. 7 - у бара.
        // index 12 -> point 12. index 17 -> point 7.
        const pointInHalf = pointIndex - 12
        x = sideMargin + (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        // Правый низ (6..1)
        // 6 - у бара. 1 - крайний правый.
        // index 18 -> point 6. index 23 -> point 1.
        const pointInHalf = pointIndex - 18
        x = (sideMargin + halfBoardWidth + barWidth) + (pointInHalf * pointWidth + pointWidth / 2)
      }
    }
    
    let y = isTopRow ? topMargin : (height - bearOffHeight - 5) // -5 небольшой отступ от лотка
    
    // Для Nardi (и скина с лотком внизу) не инвертируем координаты для второго игрока.
    // Оба игрока видят доску одинаково (статика).
    /*
    if (!isPlayer1) {
      x = width - x
      y = height - y 
    }
    */
    
    return { x, y, isTopRow, pointWidth, pointHeight, pointNumber }
  }, [isPlayer1, debugConfig]) // Add debugConfig to dependency array

  // Определение позиции для кубиков
  // Кубики показываются на стороне игрока, у которого сейчас ход
  // Позиция адаптируется к размеру экрана и обновляется при изменении размера
  const updateDicePosition = useCallback(() => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    if (width === 0 || height === 0) return // Не вычисляем позицию если контейнер еще не отрисован
    
    // Размер кубиков адаптируется к размеру доски
    const diceSize = Math.min(width, height) * 0.08
    const diceWidth = diceSize * 7.5
    const diceHeight = diceSize * 4.5
    
    // Создаем временный canvas для вычисления координат точек
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    
    let xPos: number
    let yPos: number
    
    // Определяем, какой игрок сейчас ходит и где должны быть его кубики
    // Белые шашки (player1) находятся внизу, черные (player2) - вверху
    // Кубики должны быть в противоположном углу от шашек соперника
    // СТАНДАРТНАЯ ЛОГИКА (0 = Лево, Width = Право)
    // Эксперимент с инверсией провалился (width улетел вправо).
    // Возвращаем Player 1 вниз-вправо, Player 2 вверх-влево.
    // Используем безопасный отступ 150px от краев, чтобы точно попасть на поле.

    if (currentPlayer === 0) {
      // Player1 (белые) - Внизу Справа (Дом белых, пункты 1-6)
      // Размещаем в центре правой половины доски (дом белых)
      // width * 0.75 - примерный центр правой части
      xPos = width * 0.75
      yPos = height * 0.65
      
      console.log('🎲 Player1 dice position (BOTTOM-RIGHT):', { xPos, yPos })
    } else {
      // Player2 (черные, соперник) - Вверху Слева (Дом черных, пункт 13)
      // Размещаем в центре левой половины доски (дом черных)
      // width * 0.25 - примерный центр левой части
      xPos = width * 0.25
      yPos = height * 0.35
      
      console.log('🎲 Player2 dice position (TOP-LEFT):', { xPos, yPos })
    }

    console.log('🎲 Dice position updated:', { xPos, yPos, size: diceSize, currentPlayer, width, height })

    setDice3DPosition({
      x: xPos,
      y: yPos,
      size: diceSize,
    })
  }, [currentPlayer, getPointCoordinates])

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
  
  // Функция для определения точки по координатам
  const getPointAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement): number | null => {
    const width = canvas.width
    const height = canvas.height
    
    // Координаты клика
    const actualX = x
    const actualY = y
    
    // ГЛОБАЛЬНЫЕ ПАРАМЕТРЫ (дублируем логику из getPointCoordinates)
    const bearOffHeight = height * 0.13
    
    // Проверяем все точки
    // Прямой расчет попадания в точку на основе логики getPointCoordinates
    // Добавляем небольшой отступ (padding) для более легкого попадания
    const padding = 5;
    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
      const { x: pX, y: pY, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      
      const xStart = pX - pW / 2 - padding;
      const xEnd = pX + pW / 2 + padding;
      
      // Hitbox по вертикали:
      // Если isTopRow: от y=topMargin до y=topMargin+pH
      // Если !isTopRow: от y=(height-bearOffHeight-pH) до y=(height-bearOffHeight)
      // getPointCoordinates возвращает y основания.
      // TopRow: y = topMargin. Hitbox: y..y+pH.
      // BottomRow: y = height-bearOffHeight. Hitbox: y-pH..y.
      
      let yStart, yEnd;
      if (isTopRow) {
          yStart = pY - padding;
          yEnd = pY + pH + padding;
      } else {
          yStart = pY - pH - padding;
          yEnd = pY + padding;
      }
      
      if (actualX >= xStart && actualX <= xEnd && actualY >= yStart && actualY <= yEnd) {
        return pointIndex
      }
    }
    
    // Проверяем бар (упрощенно - центр экрана)
    const barWidth = width * 0.088
    const barX = (width - barWidth) / 2
    if (actualX >= barX && actualX <= barX + barWidth) {
      if (actualY >= height * 0.2 && actualY <= height * 0.8) {
         return isPlayer1 ? 24 : 25
      }
    }
    
    // Проверяем контейнеры (bearOff) - теперь СНИЗУ
    // Высота bearOffHeight
    if (actualY >= height - bearOffHeight) {
      // Весь низ - это bearOff? Или только определенные зоны?
      // Для простоты - весь низ.
      return -1
    }
    
    // В Sandbox режиме проверяем зону "удаления" (мусорка) в левом нижнем углу
    // Но bearOff теперь снизу. Мусорку можно положить в угол, поверх лотка.
    if (isSandbox) {
      const trashSize = 60
      const trashX = 0
      const trashY = height - trashSize
      if (actualX >= trashX && actualX <= trashX + trashSize && actualY >= trashY && actualY <= height) {
        return -3 // Код для мусорки
      }
    }
    
    return null
  }, [gameState, isPlayer1, gameMode, isSandbox, getPointCoordinates])
  
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
    
    // ГЛОБАЛЬНЫЕ ПАРАМЕТРЫ (дублируем логику из getPointCoordinates)
    const bearOffHeight = height * 0.036
    const topMargin = height * 0.06
    const sideMargin = width * 0.040 // Adjusted
    
    // Определяем параметры доски
    const bearOffWidth = width * 0.06
    const boardWidth = width - (bearOffWidth * 2)
    const barWidth = width * 0.043
    const barX = (width - barWidth) / 2
    
    // Рисуем фоновую картинку (Скин) на всю доску
    const globalSkinUrl = '/img/skin1.png'
    
    const img = new Image()
    img.src = globalSkinUrl
    
    // Рисуем фон
    if (img.complete) {
        ctx.drawImage(img, 0, 0, width, height)
    } else {
        img.onload = () => drawBoard()
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(0, 0, width, height)
    }
    
    // Треугольники НЕ РИСУЕМ (они есть на скине)
    
    // Отрисовка нумерации точек (1-24)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
        const { x, y, isTopRow, pointNumber } = getPointCoordinates(pointIndex, canvas)
        const getCoordinateText = (num: number) => {
            if (coordinateSystem === '1-24') return num.toString();
            const quarter = Math.floor((num - 1) / 6);
            const offset = (num - 1) % 6 + 1;
            const letters = ['A', 'B', 'C', 'D'];
            return `${letters[quarter]}${offset}`;
        }
        const coordText = getCoordinateText(pointNumber);
        
        let yOffset = 0;
        
        if (isTopRow) {
            // Top Row (13-24) -> Indices 0-11
            // Right Side: Indices 0-5 (Points 24-19)
            // Left Side: Indices 6-11 (Points 18-13)
            if (pointIndex < 6) {
                // Top Right
                yOffset = debugConfig.textTopRightY
            } else {
                // Top Left
                yOffset = debugConfig.textTopLeftY
            }
            ctx.fillText(coordText, x, y + yOffset)
        } else {
            // Bottom Row (1-12) -> Indices 12-23
            // Left Side: Indices 12-17 (Points 12-7)
            // Right Side: Indices 18-23 (Points 6-1)
            if (pointIndex < 18) {
                // Bottom Left
                yOffset = debugConfig.textBottomLeftY
            } else {
                // Bottom Right
                yOffset = debugConfig.textBottomRightY
            }
            ctx.fillText(coordText, x, y + yOffset)
        }
    }
    
    // Параметры для точек
    const halfBoardWidth = (boardWidth - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    // Вспомогательная функция для отрисовки шашки с цветом из checkersConfig
    const drawChecker = (cX: number, cY: number, size: number, isWhite: boolean, isMy: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      
      const imgKey = isWhite ? 'white' : 'red'
      const img = imagesRef.current[imgKey]

      if (img && img.complete) {
          // Тень для объема
          ctx.shadowBlur = size * 0.2
          ctx.shadowColor = 'rgba(0,0,0,0.4)'
          ctx.shadowOffsetY = 2
          
          // Увеличиваем размер изображения, но не слишком сильно, так как базовый размер уже увеличен
          const scale = debugConfig.checkerDrawScale
          const drawSize = size * scale
          
          ctx.drawImage(img, cX - drawSize/2, cY - drawSize/2, drawSize, drawSize)
      } else {
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
      }
      
      ctx.restore()
    }
    
    // ... остальной код ...


    

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
      
      // Увеличиваем размер шашки относительно ширины треугольника
      const checkerSize = Math.min(pW * debugConfig.checkerWidthRatio, pH * debugConfig.checkerHeightRatio) 
      const checkerBaseY = isTopRow 
        ? y + checkerSize/2 + debugConfig.checkerTopOffset
        : y - checkerSize/2 + debugConfig.checkerBottomOffset  
      
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
      
      // Ограничиваем подсветку высотой треугольника (pH) и позиционируем строго по треугольнику
      const hX = x - pW / 2
      const hY = isTopRow ? y : (y - pH)
      const hH = pH

      // 1. Подсветка точки под курсором
      if (hoveredPoint === pointIndex) {
        ctx.fillStyle = dragging ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        ctx.fillRect(hX, hY, pW, hH)
      }

      // 2. Подсветка валидных точек назначения при перетаскивании ИЛИ выборе точки
      if ((dragging || selectedPoint !== null) && validTargetPoints.has(pointIndex)) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
        ctx.fillRect(hX, hY, pW, hH)
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.lineWidth = 2
        ctx.strokeRect(hX + 2, hY + 2, pW - 4, hH - 4)
      }
      
      // 3. Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.3)'
        ctx.fillRect(hX, hY, pW, hH)
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
        ? fromY + checkerSize/2 + 2 + (fromCheckerCount - 1) * fromOverlap
        : fromY - checkerSize/2 - 2 - (fromCheckerCount - 1) * fromOverlap

      // Конечная позиция Y (куда приземлится)
      let endY;
      if (animatingChecker.to === -1 || animatingChecker.to >= 24) {
        endY = toY
      } else {
        const toCheckerCount = Math.abs(virtualGameState.points[animatingChecker.to])
        const toOverlap = (toCheckerCount + 1) > 5 ? (checkerSize * 0.8) : checkerSize
        endY = toTop
          ? toY + checkerSize/2 + 2 + toCheckerCount * toOverlap
          : toY - checkerSize/2 - 2 - toCheckerCount * toOverlap
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
    
    // Отрисовка области выноса (Теперь СНИЗУ, используем изображения сбоку)
    const bearOffAreaY = height - bearOffHeight

    if (virtualGameState.bearOff) {
      const bOff = virtualGameState.bearOff
      const whiteBearOffCount = bOff.white || 0
      const blackBearOffCount = bOff.black || 0
      
      // Изображения сбоку
      const whiteSideImg = imagesRef.current['whiteSide']
      const redSideImg = imagesRef.current['redSide']
      
      // Параметры для отрисовки сбоку (стоячие шашки)
      // Высота шашки сбоку = диаметру (примерно)
      const checkerSideHeight = bearOffHeight * 0.85
      
      // Вычисляем ширину по пропорциям изображения
      const getSideWidth = (img: HTMLImageElement | undefined) => {
          if (img && img.complete && img.height > 0) {
              return checkerSideHeight * (img.width / img.height)
          }
          return checkerSideHeight * 0.25 // Default thickness fallback
      }
      
      const whiteW = getSideWidth(whiteSideImg)
      const redW = getSideWidth(redSideImg)
      
      const yPos = bearOffAreaY + (bearOffHeight - checkerSideHeight) / 2
      
      // Белые шашки - Справа налево (Дом белых обычно справа)
      // Размещаем их в правой части лотка
      const startXWhite = width - sideMargin - whiteW
      
      for (let i = 0; i < whiteBearOffCount; i++) {
        // Плотная стопка со смещением
        const step = whiteW * 0.25
        const x = startXWhite - (i * step)
        
        if (whiteSideImg && whiteSideImg.complete) {
           ctx.drawImage(whiteSideImg, x, yPos, whiteW, checkerSideHeight)
        } else {
           ctx.fillStyle = '#F0F0F0'
           ctx.fillRect(x, yPos, whiteW, checkerSideHeight)
           ctx.strokeStyle = '#999'
           ctx.strokeRect(x, yPos, whiteW, checkerSideHeight)
        }
      }
      
      // Черные шашки - Слева направо (Дом черных обычно слева)
      // Размещаем их в левой части лотка
      const startXBlack = sideMargin
      
      for (let i = 0; i < blackBearOffCount; i++) {
        const step = redW * 0.25
        const x = startXBlack + (i * step)
        
        if (redSideImg && redSideImg.complete) {
           ctx.drawImage(redSideImg, x, yPos, redW, checkerSideHeight)
        } else {
           ctx.fillStyle = '#333333'
           ctx.fillRect(x, yPos, redW, checkerSideHeight)
           ctx.strokeStyle = '#000'
           ctx.strokeRect(x, yPos, redW, checkerSideHeight)
        }
      }
    }

    // Подсветка при перетаскивании в зону выноса (ВЕСЬ НИЗ)
    if ((dragging || selectedPoint !== null) && validTargetPoints.has(-1)) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
      ctx.fillRect(0, bearOffAreaY, width, bearOffHeight)
      
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
      ctx.lineWidth = 2
      ctx.strokeRect(0, bearOffAreaY, width, bearOffHeight)
      
      if (hoveredPoint === -1) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
        ctx.fillRect(0, bearOffAreaY, width, bearOffHeight)
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

  // ВАЖНО: Обновляем позицию кубиков когда появляются кубики или завершается анимация
  // Это гарантирует, что кубики перемещаются в правильный угол после анимации
  useEffect(() => {
    // Устанавливаем позицию сразу при появлении кубиков, даже во время анимации
    if (diceArray && diceArray.length > 0) {
      updateDicePosition()
    }
  }, [diceArray, updateDicePosition])

  // Дополнительно обновляем позицию после завершения анимации
  useEffect(() => {
    if (!diceAnimating && diceArray && diceArray.length > 0) {
      // Небольшая задержка для плавного перехода после завершения анимации
      const timeoutId = setTimeout(() => {
        updateDicePosition()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [diceAnimating, diceArray, updateDicePosition])
  
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

  // --- DEBUG UI COMPONENT ---
  const DebugUI = () => {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const touchStartRef = useRef<number | null>(null)
    const scrollStartRef = useRef<number>(0)

    if (!debugMode) return (
      <button 
        onClick={() => setDebugMode(true)}
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          zIndex: 100000,
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          border: 'none',
          padding: '5px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        ⚙️
      </button>
    )

    const handleChange = (key: keyof typeof debugConfig, value: number) => {
      setDebugConfig(prev => ({ ...prev, [key]: value }))
    }
    
    // Determine which config is currently active for display label
    const isMobile = containerRef.current && containerRef.current.offsetWidth < 768;

    // Custom touch handling for scrolling
    const handleTouchStart = (e: React.TouchEvent) => {
      // Allow slider interaction if starting on an input
      const isInput = (e.target as HTMLElement).tagName === 'INPUT';
      // If it's an input, we might still want to scroll if the drag is vertical,
      // but for now let's just capture everything for scrolling unless it's clearly horizontal later?
      // Simpler: Always capture start.
      
      e.stopPropagation()
      touchStartRef.current = e.touches[0].clientY
      if (scrollContainerRef.current) {
        scrollStartRef.current = scrollContainerRef.current.scrollTop
      }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
      e.stopPropagation()
      // Critical: prevent default to stop Telegram/Browser interference
      if (e.cancelable) e.preventDefault(); 
      
      if (touchStartRef.current === null || !scrollContainerRef.current) return
      
      const deltaY = touchStartRef.current - e.touches[0].clientY
      
      // Basic hysteresis to allow horizontal slider movement if deltaY is small?
      // But for now, let's just prioritize vertical scroll for the panel.
      scrollContainerRef.current.scrollTop = scrollStartRef.current + deltaY
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
      e.stopPropagation()
      touchStartRef.current = null
    }

    // Manual scroll buttons handlers
    const scrollUp = () => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ top: -50, behavior: 'smooth' })
    }
    const scrollDown = () => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ top: 50, behavior: 'smooth' })
    }

    return (
      <div 
        ref={scrollContainerRef}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 100000,
          background: 'rgba(0,0,0,0.85)',
          color: 'white',
          padding: '15px',
          borderRadius: '10px',
          fontSize: '12px',
          maxHeight: '60vh', // Further reduced height
          overflowY: 'hidden', // Hide native scrollbar, use manual
          border: '1px solid #444',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          width: '300px',
          touchAction: 'none', // We handle scrolling manually
          pointerEvents: 'auto',
        }}
        // Stop propagation of all pointer events so they don't reach the board
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        
        // Custom scrolling handlers
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
        
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, paddingBottom: '5px' }}>
          <h3 style={{ margin: 0 }}>Debug ({isMobile ? 'Mobile' : 'Desktop'})</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={scrollUp} style={{ fontSize: '16px', padding: '5px' }}>⬆️</button>
             <button onClick={scrollDown} style={{ fontSize: '16px', padding: '5px' }}>⬇️</button>
             <button onClick={() => setDebugMode(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        </div>
        
        <div style={{ marginBottom: '10px', fontSize: '10px', color: '#aaa' }}>
            Current Width: {containerRef.current?.offsetWidth}px
        </div>
        
        {[
          { key: 'sideMarginPct', label: 'Side Margin', min: 0, max: 0.1, step: 0.001 },
          { key: 'barWidthPct', label: 'Bar Width', min: 0, max: 0.2, step: 0.001 },
          { key: 'topMarginPct', label: 'Top Margin', min: 0, max: 0.2, step: 0.001 },
          { key: 'bearOffHeightPct', label: 'BearOff Height', min: 0, max: 0.3, step: 0.001 },
          { key: 'checkerWidthRatio', label: 'Checker Width Ratio', min: 0.5, max: 1.5, step: 0.01 },
          { key: 'checkerHeightRatio', label: 'Checker Height Ratio', min: 0.05, max: 0.3, step: 0.001 },
          { key: 'checkerDrawScale', label: 'Checker Draw Scale', min: 0.5, max: 1.5, step: 0.01 },
          { key: 'diceP1X', label: 'Dice P1 X (0-1)', min: 0, max: 1, step: 0.01 },
          { key: 'diceP1Y', label: 'Dice P1 Y (0-1)', min: 0, max: 1, step: 0.01 },
          { key: 'diceP2X', label: 'Dice P2 X (0-1)', min: 0, max: 1, step: 0.01 },
          { key: 'diceP2Y', label: 'Dice P2 Y (0-1)', min: 0, max: 1, step: 0.01 },
          { key: 'checkerTopOffset', label: 'Top Checker Offset (px)', min: -50, max: 50, step: 1 },
          { key: 'checkerBottomOffset', label: 'Bottom Checker Offset (px)', min: -50, max: 50, step: 1 },
          { key: 'highlightWidthScale', label: 'Highlight Width Scale', min: 0.5, max: 1.5, step: 0.01 },
          { key: 'highlightHeightScale', label: 'Highlight Height Scale', min: 0.5, max: 1.5, step: 0.01 },
          { key: 'highlightXOffset', label: 'Highlight X Offset (px)', min: -50, max: 50, step: 1 },
          { key: 'highlightYOffset', label: 'Highlight Y Offset (px)', min: -50, max: 50, step: 1 },
          { key: 'textTopLeftY', label: 'Text Top Left Y', min: -50, max: 50, step: 1 },
          { key: 'textTopRightY', label: 'Text Top Right Y', min: -50, max: 50, step: 1 },
          { key: 'textBottomLeftY', label: 'Text Bottom Left Y', min: -50, max: 50, step: 1 },
          { key: 'textBottomRightY', label: 'Text Bottom Right Y', min: -50, max: 50, step: 1 },
        ].map(item => (
          <div key={item.key} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>{item.label}</label>
              <span>{debugConfig[item.key as keyof typeof debugConfig].toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={debugConfig[item.key as keyof typeof debugConfig]}
              onChange={(e) => handleChange(item.key as keyof typeof debugConfig, parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        ))}
        
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="checkbox" 
                checked={!!debugDice}
                onChange={(e) => setDebugDice(e.target.checked ? [3, 4] : null)}
              />
              <span style={{ marginLeft: '5px' }}>Show Test Dice</span>
            </label>
          </div>

           <textarea 
             readOnly 
             value={JSON.stringify(debugConfig, null, 2)}
             style={{ width: '100%', height: '150px', fontSize: '10px', background: '#222', color: '#ddd', border: '1px solid #555' }}
           />
        </div>
      </div>
    )
  }
  
  // Use real dice or debug dice
  const effectiveDice = debugMode && debugDice ? debugDice : diceArray;
  
  return (
    <div ref={containerRef} className="backgammon-board-container">
      <DebugUI />
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
      {effectiveDice && effectiveDice.length > 0 && (
        <div
          style={{
            position: 'absolute',
            // Если идет анимация гифки, показываем её в центре экрана
            // После анимации переносим кубики в угол (внизу справа для player1, вверху слева для player2)
            left: diceAnimating 
              ? '50%'  // Во время анимации - в центре
              : dice3DPosition 
                ? `${dice3DPosition.x}px` // После анимации - в углу
                : '50%', // Fallback на центр, если позиция еще не вычислена
            top: diceAnimating 
              ? '50%'  // Во время анимации - в центре
              : dice3DPosition 
                ? `${dice3DPosition.y}px` // После анимации - в углу
                : '50%', // Fallback на центр, если позиция еще не вычислена
            width: dice3DPosition ? `${dice3DPosition.size * 7.5}px` : '200px',
            height: dice3DPosition ? `${dice3DPosition.size * 4.5}px` : '120px',
            transform: 'translate(-50%, -50%)', // Центрируем кубики относительно их позиции
            pointerEvents: 'none',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000, // Очень высокий z-index чтобы кубики были поверх всего
            transition: diceAnimating ? 'none' : 'all 0.5s ease-out',
            // Гарантируем, что кубики не выходят за границы доски
            maxWidth: '100%',
            maxHeight: '100%',
            // Добавляем визуальные эффекты для лучшей видимости
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.8))',
            opacity: 1, // Явно устанавливаем непрозрачность
            // Добавляем видимый фон для отладки (можно убрать позже)
            backgroundColor: debugMode ? 'rgba(255, 0, 0, 0.3)' : 'transparent', // Red bg in debug mode
            // Убеждаемся, что элемент виден
            visibility: 'visible',
          }}
        >
          {/* Показываем гифку, если она доступна для данного состояния кубиков */}
          <DiceGif 
            dice={effectiveDice}
            usedDiceIndices={usedDiceIndices}
            animating={diceAnimating}
            size={dice3DPosition?.size || 50}
          />

          {/* Если гифка не показывается (например, анимация закончилась), 
              показываем старые 3D кубики для отображения результата */}
          {!diceAnimating && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {(() => {
                const isDoubles = effectiveDice.length > 2;
                if (isDoubles) {
                  // В Sandbox всегда показываем все кубики по отдельности, чтобы не путать пользователя
                  if (isSandbox) {
                    // Фильтруем только неиспользованные кубики
                    const unusedDice = effectiveDice.filter((_, index) => !usedDiceIndices.has(index));
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
                  const dieValue = effectiveDice[0];
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
                  return effectiveDice.map((dieValue, index) => {
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
