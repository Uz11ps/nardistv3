import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { apiClient } from '../api/client'
import Dice3D from './Dice3D'
import DiceGif from './DiceGif'
import { DebugPanel } from './DebugPanel'

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
  onNoMoves?: () => void
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
  onNoMoves,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Определение формата кубиков (нужно объявить до использования в useEffect)
  const diceArray = dice 
    ? (Array.isArray(dice) ? dice : ('die1' in dice && 'die2' in dice ? [dice.die1, dice.die2] : null))
    : null

  // Скины теперь используют материалы (цвета) вместо текстур
  
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number; steps?: any[] }>>([])
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())

  // ВАЖНО: Определяем, является ли текущий набор кубиков дублем.
  // Дубль в нардax — это когда все кубики в массиве имеют одинаковое значение.
  // Это состояние должно быть стабильным на протяжении всего хода.
  // ВАЖНО: Дубль определяется только если изначально было 2+ одинаковых кубика.
  // После промежуточного подтверждения может остаться 1 кубик, но это не дубль.
  const isActuallyDoubles = useMemo(() => {
    if (!diceArray || diceArray.length === 0) return false;
    
    // Дубль может быть только если есть минимум 2 кубика
    // Если после промежуточного хода остался 1 кубик - это не дубль
    if (diceArray.length === 1) return false;
    
    // Если все кубики в массиве одинаковые — это дубль.
    // Это работает для 4, 3, 2 одинаковых кубиков.
    const allEqual = diceArray.every(d => d === diceArray[0]);
    
    // Если кубиков 2 и они разные — это точно не дубль.
    if (diceArray.length === 2 && !allEqual) return false;
    
    // В остальных случаях (4 одинаковых, 3 одинаковых, 2 одинаковых) — это дубль.
    return allEqual;
  }, [diceArray]);

  const [dice3DPosition, setDice3DPosition] = useState<{ x: number; y: number; size: number } | null>(null)

  // --- CONFIGURATIONS ---
    // Large Screen (Desktop) - Optimized
    const DESKTOP_CONFIG = {
      sideMarginLeftPct: 0.04,
      sideMarginRightPct: 0.05,
      barMarginLeftPct: 0.03,
      barMarginRightPct: 0.012,
      barWidthPct: 0.025,
      topMarginPct: 0.058,
      bearOffHeightPct: 0.134,
      checkerWidthRatio: 1.5,
      checkerHeightRatio: 0.252,
      checkerDrawScale: 1.28,
      diceP1X: 0.5,
      diceP1Y: 0.6,
      diceP2X: 0.16,
      diceP2Y: 0.24,
      checkerTopOffset: -349,
      checkerBottomOffset: 349,
      // Legacy text offsets (for fallback)
      textTopOffset: -15,
      textBottomOffset: 15,
      // New parameters for advanced highlight and text control
      highlightWidthScale: 1,
      highlightHeightScale: 1,
      highlightXOffset: 0,
      highlightYOffset: -31,
      // Valid moves highlight parameters
      validHighlightWidthScale: 1,
      validHighlightHeightScale: 1,
      validHighlightXOffset: 0,
      validHighlightYOffset: -31,
      // Dedicated bear-off valid highlight
      bearOffValidWidthScale: 1,
      bearOffValidHeightScale: 1,
      bearOffValidXOffset: 0,
      bearOffValidYOffset: 0,
      // Bottom row specific highlight offset (if needed separately, otherwise shared)
      highlightBottomYOffset: 26,
      validHighlightBottomYOffset: 26,

      // Dragging checker parameters
      dragCheckerSizeScale: 1,
      dragCheckerXOffset: 0,
      dragCheckerYOffset: 0,
      // Bear-off (lot) customization
      bearOffCheckerScale: 0.9,
      bearOffXOffset: 2,
      bearOffYOffset: 0,
      // Advanced text offsets (quadrants)
      textTopRightY: -316, // Points 19-24 (Indices 0-5)
      textTopLeftY: -316,  // Points 13-18 (Indices 6-11)
      textBottomLeftY: 316, // Points 7-12 (Indices 12-17)
      textBottomRightY: 316, // Points 1-6 (Indices 18-23)
    }

  // Small Screen (Mobile) - Optimized
  const MOBILE_CONFIG = {
    sideMarginLeftPct: 0.04,
    sideMarginRightPct: 0.05,
    barMarginLeftPct: 0.03,
    barMarginRightPct: 0.012,
    barWidthPct: 0.025,
    topMarginPct: 0.058,
    bearOffHeightPct: 0.134,
    checkerWidthRatio: 1.5,
    checkerHeightRatio: 0.252,
    checkerDrawScale: 1.28,
    diceP1X: 0.5,
    diceP1Y: 0.6,
    diceP2X: 0.16,
    diceP2Y: 0.24, 
    checkerTopOffset: -349, 
    checkerBottomOffset: 349,
    // Legacy text offsets
    textTopOffset: -15,
    textBottomOffset: 15,
    // New parameters for advanced highlight and text control
    highlightWidthScale: 1,
    highlightHeightScale: 1,
    highlightXOffset: 0,
    highlightYOffset: -31,
    // Valid moves highlight parameters
    validHighlightWidthScale: 1,
    validHighlightHeightScale: 1,
    validHighlightXOffset: 0,
    validHighlightYOffset: -31,
    // Dedicated bear-off valid highlight
    bearOffValidWidthScale: 1,
    bearOffValidHeightScale: 1,
    bearOffValidXOffset: 0,
    bearOffValidYOffset: 0,
    // Bottom row specific highlight offset (if needed separately, otherwise shared)
    highlightBottomYOffset: 26,
    validHighlightBottomYOffset: 26,

    // Dragging checker parameters
    dragCheckerSizeScale: 1,
    dragCheckerXOffset: 0,
    dragCheckerYOffset: 0,
    // Bear-off (lot) customization
    bearOffCheckerScale: 0.9,
    bearOffXOffset: 2,
    bearOffYOffset: 0,
    // Advanced text offsets (quadrants)
    textTopRightY: -316,
    textTopLeftY: -316, 
    textBottomLeftY: 316, 
    textBottomRightY: 316,
  }

  // --- DEBUG / ADJUSTMENT MODE ---
  const [debugMode, setDebugMode] = useState(false)
  
  // Загружаем конфиг из localStorage или используем дефолтный
  const loadDebugConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem('backgammon-debug-config-v15')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Check if config has new properties (e.g. sideMarginLeftPct). If not, it's legacy - ignore it.
        if (parsed.sideMarginLeftPct !== undefined) {
             // Мержим с дефолтным конфигом чтобы добавить новые параметры если они появились
             return { ...DESKTOP_CONFIG, ...parsed }
        } else {
             console.log('Detected legacy config in localStorage, ignoring to enforce new defaults.')
        }
      }
    } catch (e) {
      console.warn('Failed to load debug config from localStorage:', e)
    }
    return DESKTOP_CONFIG
  }, [])
  
  const [debugConfig, setDebugConfig] = useState(loadDebugConfig)
  
  // Сохраняем конфиг в localStorage при каждом изменении
  useEffect(() => {
    if (debugMode) {
      try {
        localStorage.setItem('backgammon-debug-config-v15', JSON.stringify(debugConfig))
      } catch (e) {
        console.warn('Failed to save debug config to localStorage:', e)
      }
    }
  }, [debugConfig, debugMode])

  // Responsive Config Switcher - ТОЛЬКО если нет сохраненного конфига
  useEffect(() => {
    // Если есть сохраненный конфиг - не переключаем автоматически
    const hasSavedConfig = localStorage.getItem('backgammon-debug-config-v12')
    if (hasSavedConfig || debugMode) return
    
    const handleResize = () => {
        if (containerRef.current) {
            const width = containerRef.current.offsetWidth
            if (width < 768) {
                setDebugConfig(MOBILE_CONFIG)
            } else {
                setDebugConfig(DESKTOP_CONFIG)
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
      // Загружаем все изображения включая skin один раз при монтировании
      // Браузер будет кешировать изображение автоматически
      img.src = src
      img.onload = () => {
        if (!isMounted) return
        imagesRef.current[key] = img
        loadedCount++
        if (loadedCount === totalCount) {
          setImagesLoaded(true)
        }
      }
      img.onerror = () => {
        if (!isMounted) return
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
          // Стандартная логика добавления
          // Если там уже есть шашки того же цвета, просто увеличиваем/уменьшаем
          // Если пусто - ставим
          if (points[m.to] * unit >= 0) {
              points[m.to] += unit
          } else {
              // Этого не должно происходить в корректной игре, кроме сбивания
              points[m.to] += unit
          }
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
    
    // ВАЖНО: Анимируемая шашка должна быть ВРЕМЕННО удалена из точки 'from', 
    // чтобы не дублироваться (одна стоит, вторая летит).
    // Но 'applyStep' выше уже мог изменить состояние, если ход завершен?
    // Нет, animatingChecker - это визуальное представление.
    // Если мы анимируем ход, который ЕЩЕ НЕ применен в pendingMoves/completedServerMoves (например, серверный ход в процессе),
    // то шашка все еще стоит на месте в virtualGameState.
    // Нам нужно "визуально" убрать одну шашку с source точки.
    
    if (animatingChecker && !animatingChecker.isServerMove) {
        // Для локальных ходов (которые уже в pendingMoves) ничего делать не надо, 
        // так как pendingMoves уже применились к virtualGameState.
        // Но если animatingChecker есть, а хода в pendingMoves нет (например, только начали drag/anim)?
        // Обычно startMoveAnimation вызывается ДО добавления в pendingMoves? 
        // Нет, обычно мы анимируем, а потом по завершении вызываем onMove -> добавление в pendingMoves.
        // Значит, пока идет анимация, в virtualGameState шашка еще на старом месте.
        // Нам нужно её скрыть.
        
        // НО! В текущей реализации onMove вызывается ПОСЛЕ завершения анимации.
        // Значит, в virtualGameState шашка все еще на 'from'.
        // Мы должны уменьшить count на 'from'.
        
        const m = animatingChecker
        if (m.from === 24) bar.white--
        else if (m.from === 25) bar.black--
        else if (m.from >= 0 && m.from < 24) {
            const val = points[m.from]
            if (val > 0) points[m.from]--
            else if (val < 0) points[m.from]++
        }
    } else if (animatingChecker && animatingChecker.isServerMove) {
        // Для серверных ходов: они еще НЕ в completedServerMoves (туда попадают после анимации).
        // Значит, шашка еще на 'from'. Скрываем её.
        const m = animatingChecker
        // Определяем цвет хода (для корректного уменьшения модуля числа)
        const isWhite = m.isWhite !== undefined ? m.isWhite : (isPlayer1 ? false : true)
        
        if (m.from === 24) bar.white--
        else if (m.from === 25) bar.black--
        else if (m.from >= 0 && m.from < 24) {
            const val = points[m.from]
            // Уменьшаем количество по модулю, сохраняя знак
            if (val > 0) points[m.from]--
            else if (val < 0) points[m.from]++
        }
    }

    return {
      ...gameState,
      points,
      bar,
      bearOff
    }
  }, [gameState, pendingMoves, completedServerMoves, isPlayer1, gameMode, animatingChecker])

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
        
        // Логирование для отладки индексации точек
        if (flatMoves.length > 0) {
          console.log('🎯 Valid moves received:', flatMoves.map(m => ({ from: m.from, to: m.to, die: m.die })))
        }
        
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
        
        // Для длинных нард: фильтруем ходы, которые создают незаконный 6-точечный блок
        if (gameMode === 'long' && !isSandbox) {
          const points = gameState?.points || []
          const activePlayer = isPlayer1 ? 0 : 1
          const BOARD_SIZE = 24
          const WHITE_HOME_START = 18 // Point 1-6 (indices 18-23)
          const BLACK_HOME_START = 6 // Point 13-18 (indices 6-11)
          
          // Проверяем, есть ли у противника шашки в доме
          let opponentHasCheckerInHome = false
          if (activePlayer === 0) {
            // Для белых проверяем дом черных (indices 6-11)
            for (let i = 6; i <= 11; i++) {
              if (points[i] < 0) {
                opponentHasCheckerInHome = true
                break
              }
            }
          } else {
            // Для черных проверяем дом белых (indices 18-23)
            for (let i = 18; i <= 23; i++) {
              if (points[i] > 0) {
                opponentHasCheckerInHome = true
                break
              }
            }
          }
          
          // Если противник не имеет шашек в доме - фильтруем ходы, создающие 6-точечный блок
          if (!opponentHasCheckerInHome) {
            flatMoves = flatMoves.filter(move => {
              const from = move.from
              const to = move.to
              
              // Если to выходит за пределы доски (bear off) - правило не применяется
              if (to < 0 || to >= BOARD_SIZE) {
                return true
              }
              
              // Проверяем все блоки, которые могут быть затронуты ходом
              const checkPoints = new Set<number>()
              if (from >= 0 && from < BOARD_SIZE) {
                for (let i = -5; i <= 5; i++) {
                  checkPoints.add((from + i + BOARD_SIZE) % BOARD_SIZE)
                }
              }
              for (let i = -5; i <= 5; i++) {
                checkPoints.add((to + i + BOARD_SIZE) % BOARD_SIZE)
              }
              
              // Для каждой точки, которая может быть началом блока, проверяем блок из 6 точек
              for (const potentialStart of checkPoints) {
                for (let offset = 0; offset < 6; offset++) {
                  const blockStart = (potentialStart - offset + BOARD_SIZE) % BOARD_SIZE
                  
                  let ourCountAfter = 0
                  let hasOpponentAfter = false
                  let blockIncludesFromOrTo = false
                  
                  // Проверяем блок из 6 точек, начиная с blockStart
                  for (let i = 0; i < 6; i++) {
                    const idx = (blockStart + i) % BOARD_SIZE
                    let value = points[idx] || 0
                    
                    // Отслеживаем, включает ли блок from или to
                    if (idx === from || idx === to) {
                      blockIncludesFromOrTo = true
                    }
                    
                    // Симуляция хода ПОСЛЕ
                    if (idx === from && from >= 0 && from < BOARD_SIZE) {
                      if (activePlayer === 0 && value > 0) value--
                      else if (activePlayer === 1 && value < 0) value++
                    } else if (idx === to) {
                      if (activePlayer === 0) value++
                      else value--
                    }
                    
                    // Подсчитываем наши шашки в блоке
                    if ((activePlayer === 0 && value > 0) || (activePlayer === 1 && value < 0)) {
                      ourCountAfter++
                    }
                    
                    // Проверяем наличие противника в блоке
                    if ((activePlayer === 0 && value < 0) || (activePlayer === 1 && value > 0)) {
                      hasOpponentAfter = true
                    }
                  }
                  
                  // Если блок включает from или to И после хода создается блок из 6 наших точек без противника
                  if (blockIncludesFromOrTo && ourCountAfter === 6 && !hasOpponentAfter) {
                    // Подсчитываем блок ДО хода
                    let ourCountBefore = 0
                    for (let i = 0; i < 6; i++) {
                      const idx = (blockStart + i) % BOARD_SIZE
                      const value = points[idx] || 0
                      
                      if ((activePlayer === 0 && value > 0) || (activePlayer === 1 && value < 0)) {
                        ourCountBefore++
                      }
                    }
                    
                    // Если блок создается заново (было меньше 6, стало 6) - запрещаем
                    if (ourCountBefore < 6) {
                      return false
                    }
                  }
                }
              }
              
              return true
            })
          }
        }
        
        // Не подсвечиваем все возможные точки автоматически
        // Подсветка будет только при перетаскивании шашки
        setPossibleMoves(flatMoves)

        // Если ходов нет, и это наш ход, и мы еще ничего не сделали - сообщаем об этом
        // Это нужно для автоматического пропуска хода
        if (flatMoves.length === 0 && hasDice && isMyTurn && pendingMoves.length === 0 && onNoMoves) {
          console.log('🚫 No possible moves detected, triggering onNoMoves');
          // Небольшая задержка, чтобы пользователь успел увидеть кубики
          setTimeout(() => {
            if (onNoMoves) onNoMoves();
          }, 1500);
        }

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
    // Для промежуточных ходов (выбор второй шашки) задержка должна быть минимальной!
    const animationDelay = 0
    
    // Обновляем предыдущее состояние
    prevPendingMovesRef.current = pendingMovesKey
    
    // Debounce для предотвращения частых запросов
    if (animationDelay === 0) {
      fetchPossibleMoves()
    } else {
      timeoutId = window.setTimeout(() => {
        fetchPossibleMoves()
      }, animationDelay)
    }
    
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
    
    // Отступы от центральной линии (бара) для левой и правой части
    const barMarginLeft = width * (debugConfig.barMarginLeftPct ?? 0)
    const barMarginRight = width * (debugConfig.barMarginRightPct ?? 0)

    // Уменьшаем отступы сбоку и ширину бара, чтобы треугольники стали шире
    const sideMarginLeft = width * (debugConfig.sideMarginLeftPct ?? debugConfig.sideMarginPct ?? 0.032)
    const sideMarginRight = width * (debugConfig.sideMarginRightPct ?? debugConfig.sideMarginPct ?? 0.047)
    
    // Рабочая область доски (без лотка и рамки)
    const playAreaHeight = height - bearOffHeight - topMargin
    
    // Центральная полоса (бар)
    const barWidth = width * debugConfig.barWidthPct
    
    // Вычисляем ширину половин доски отдельно
    const boardCenter = width / 2
    const barHalf = barWidth / 2
    
    const leftBoardWidth = (boardCenter - barHalf - barMarginLeft) - sideMarginLeft
    const rightBoardWidth = (width - sideMarginRight) - (boardCenter + barHalf + barMarginRight)
    
    // Ширина треугольника может отличаться слева и справа
    const pointWidthLeft = leftBoardWidth / 6
    const pointWidthRight = rightBoardWidth / 6
    
    const pointHeight = playAreaHeight * 0.42 // Высота треугольников
    
    const isTopRow = pointIndex < 12
    
    let x = 0
    let pointNumber = 0
    let pointWidth = 0 // Will be set based on side

    if (isTopRow) {
      pointNumber = 24 - pointIndex
      const isRightSide = pointIndex < 6
      
      if (isRightSide) {
        // СПРАВА ВВЕРХУ (24-19)
        pointWidth = pointWidthRight
        const pointInHalf = pointIndex
        // Справа: отступ справа (sideMarginRight)
        x = (width - sideMarginRight) - (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        // СЛЕВА ВВЕРХУ (18-13)
        pointWidth = pointWidthLeft
        const pointInHalf = pointIndex - 6
        // x = (boardCenter - barHalf) - (pointInHalf * pointWidth + pointWidth / 2)
        // pointInHalf=0 (Point 18) -> near bar.
        // pointInHalf=5 (Point 13) -> near margin.
        
        // ВАЖНО: Текущая логика была: 
        // x = (sideMargin + halfBoardWidth) - (pointInHalf * pointWidth + pointWidth / 2)
        // Это эквивалентно отсчету от БАРА влево? 
        // Если sideMargin + halfBoardWidth == Start of Bar.
        // То (Start of Bar) - offset.
        // Да, (boardCenter - barHalf) это левый край бара.
        
        x = (boardCenter - barHalf - barMarginLeft) - (pointInHalf * pointWidth + pointWidth / 2)
      }
    } else {
      // Для нижнего ряда: pointIndex 12-23 соответствуют точкам 12-1
      pointNumber = 24 - pointIndex
      const isLeftSide = pointIndex < 18 // 12-17 -> points 12..7
      
      if (isLeftSide) {
        // СЛЕВА ВНИЗУ (12-7)
        pointWidth = pointWidthLeft
        const pointInHalf = pointIndex - 12
        // x = sideMarginLeft + (pointInHalf * pointWidth + pointWidth / 2)
        x = sideMarginLeft + (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        // СПРАВА ВНИЗУ (6-1)
        pointWidth = pointWidthRight
        const pointInHalf = pointIndex - 18
        // x = (boardCenter + barHalf) + (pointInHalf * pointWidth + pointWidth / 2)
        x = (boardCenter + barHalf + barMarginRight) + (pointInHalf * pointWidth + pointWidth / 2)
      }
    }
    
    // Для верхнего ряда: y - это координата НИЗА треугольника (треугольники направлены вниз)
    // Для нижнего ряда: y - это координата ВЕРХА треугольника (треугольники направлены вверх)
    let y = isTopRow 
      ? topMargin + pointHeight  // Верхний ряд: низ треугольника
      : (height - bearOffHeight - pointHeight) // Нижний ряд: верх треугольника
    
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
    let width = rect.width
    let height = rect.height
    
    // ВАЖНО: Для модальных окон (реплей, анализ, админка) используем разумные ограничения на размер контейнера
    // Проверяем, находится ли контейнер внутри модального окна или имеет необоснованно большую высоту
    const isInModal = container.closest('.replay-modal') !== null || 
                      container.closest('.analysis-modal-v2') !== null || 
                      container.closest('.admin-modal-overlay') !== null ||
                      height > window.innerHeight * 1.5 // Если высота больше 1.5x viewport - это точно модальное окно или проблемный контейнер
    
    if (isInModal || height > 1500) { // Дополнительная проверка: если высота больше 1500px - применяем ограничения
      // Для модальных окон используем ограничения на основе viewport
      const MAX_MODAL_HEIGHT = window.innerHeight * 0.6 // Максимум 60% от высоты экрана
      const MAX_MODAL_WIDTH = window.innerWidth * 0.8 // Максимум 80% от ширины экрана
      
      // Если высота контейнера необоснованно большая (больше viewport), используем viewport
      if (height > MAX_MODAL_HEIGHT || height > window.innerHeight) {
        console.warn(`Container height in modal (${height}px) exceeds reasonable maximum, using viewport-based limit`)
        height = Math.min(MAX_MODAL_HEIGHT, rect.height || window.innerHeight * 0.5)
      }
      if (width > MAX_MODAL_WIDTH || width > window.innerWidth) {
        console.warn(`Container width in modal (${width}px) exceeds reasonable maximum, using viewport-based limit`)
        width = Math.min(MAX_MODAL_WIDTH, rect.width || window.innerWidth * 0.8)
      }
    } else {
      // Для обычной игры используем более мягкие ограничения
      const MAX_CONTAINER_HEIGHT = 2000 // Максимальная высота для обычной игры
      const MAX_CONTAINER_WIDTH = 2000 // Максимальная ширина для обычной игры
      
      if (height > MAX_CONTAINER_HEIGHT) {
        console.warn(`Container height (${height}px) exceeds maximum (${MAX_CONTAINER_HEIGHT}px), limiting to maximum`)
        height = MAX_CONTAINER_HEIGHT
      }
      if (width > MAX_CONTAINER_WIDTH) {
        console.warn(`Container width (${width}px) exceeds maximum (${MAX_CONTAINER_WIDTH}px), limiting to maximum`)
        width = MAX_CONTAINER_WIDTH
      }
    }
    
    if (width === 0 || height === 0) return // Не вычисляем позицию если контейнер еще не отрисован
    
    // Размер кубиков адаптируется к размеру доски
    // ВАЖНО: Ограничиваем максимальный размер для предотвращения слишком больших кубиков в модальных окнах (реплей)
    // Используем минимальное значение между размером контейнера и фиксированным максимумом
    const effectiveSize = Math.min(width, height)
    const maxDiceSize = 240 // Максимальный размер кубика в пикселях (для реплея и модальных окон) - увеличен в 3 раза
    const diceSize = Math.min(effectiveSize * 0.24, maxDiceSize / 7.5) // Размер кубика ограничен максимумом (увеличен коэффициент в 3 раза: 0.08 -> 0.24)
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

    // ВАЖНО: Используем параметры из debugConfig для позиции кубиков
    if (currentPlayer === 0) {
      // Player1 (белые) - используем diceP1X и diceP1Y из конфига
      xPos = width * (debugConfig.diceP1X ?? 0.5)
      yPos = height * (debugConfig.diceP1Y ?? 0.6)
      
      console.log('🎲 Player1 dice position (BOTTOM-RIGHT):', { xPos, yPos, config: { diceP1X: debugConfig.diceP1X, diceP1Y: debugConfig.diceP1Y } })
    } else {
      // Player2 (черные, соперник) - используем diceP2X и diceP2Y из конфига
      xPos = width * (debugConfig.diceP2X ?? 0.16)
      yPos = height * (debugConfig.diceP2Y ?? 0.24)
      
      console.log('🎲 Player2 dice position (TOP-LEFT):', { xPos, yPos, config: { diceP2X: debugConfig.diceP2X, diceP2Y: debugConfig.diceP2Y } })
    }
    
    // Ограничиваем позицию кубиков границами доски с учетом размера кубиков
    xPos = Math.max(diceWidth / 2, Math.min(width - diceWidth / 2, xPos))
    yPos = Math.max(diceHeight / 2, Math.min(height - diceHeight / 2, yPos))

    console.log('🎲 Dice position updated:', { xPos, yPos, size: diceSize, currentPlayer, width, height })

    setDice3DPosition({
      x: xPos,
      y: yPos,
      size: diceSize,
    })
  }, [currentPlayer, getPointCoordinates, debugConfig])

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
    
    // --- ADAPTIVE SCALING LOGIC FOR HITBOXES ---
    // Reference dimensions for mobile (iPhone 14/15 Pro Max)
    const REFERENCE_MOBILE_WIDTH = 430;
    const REFERENCE_MOBILE_HEIGHT = 932;
    const isMobile = width < 768;

    const scaleY = (val: number) => {
        // Всегда применяем масштабирование для всех размеров экрана
        const factor = height / REFERENCE_MOBILE_HEIGHT;
        return val * factor;
    }
    
    const scaleX = (val: number) => {
        // Всегда применяем масштабирование для всех размеров экрана
        const factor = width / REFERENCE_MOBILE_WIDTH;
        return val * factor;
    }
    // ------------------------------------------

    // Координаты клика
    const actualX = x
    const actualY = y
    
    // ГЛОБАЛЬНЫЕ ПАРАМЕТРЫ (дублируем логику из getPointCoordinates)
    const bearOffHeight = height * debugConfig.bearOffHeightPct
    
    // Проверяем все точки
    // Прямой расчет попадания в точку на основе логики getPointCoordinates
    // Добавляем небольшой отступ (padding) для более легкого попадания
    const padding = 5;
    // Определяем размер шашки для расширения хитбокса
    // Берем приблизительный размер на основе ширины точки
    const pW_approx = (width / 2) / 6; 
    const checkerSize_approx = pW_approx * debugConfig.checkerWidthRatio;

    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
      const { x: pX, y: pY, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      
      const xStart = pX - pW / 2 - padding;
      const xEnd = pX + pW / 2 + padding;
      
      // Hitbox по вертикали:
      // Расширяем хитбокс чтобы он покрывал визуальное положение шашек
      // которые могут быть смещены через checkerTopOffset/checkerBottomOffset
      let yStart, yEnd;
      
      if (isTopRow) {
          // Top Row: Triangle goes from (pY - pH) down to pY (tip)
          // Visual checkers start at: pY + scaleY(debugConfig.checkerTopOffset)
          // And go downwards.
          // Hitbox should cover from Min(TriangleBase, VisualBase) to Max(TriangleTip, VisualEnd)
          
          const triangleBase = pY - pH;
          const triangleTip = pY;
          const visualBase = pY + scaleY(debugConfig.checkerTopOffset);
          // Visual stack extends from (visualBase - size/2) to (visualBase + 5*overlap + size/2)
          const visualTop = visualBase - (checkerSize_approx / 2);
          const visualBottom = visualBase + (4 * (checkerSize_approx - 8)) + (checkerSize_approx / 2);
          
          yStart = Math.min(triangleBase, visualTop) - padding;
          yEnd = Math.max(triangleTip, visualBottom) + padding;
      } else {
          // Bottom Row: Triangle goes from pY (tip) down to (pY + pH)
          // Visual checkers start at: pY + scaleY(debugConfig.checkerBottomOffset)
          // And go upwards (decreasing Y) from the base.
          
          const triangleTip = pY;
          const triangleBase = pY + pH;
          
          // visualBase is the center of the first (bottom-most) checker
          const visualBase = pY + scaleY(debugConfig.checkerBottomOffset);
          // Visual stack extends from (visualBase + size/2) down to (visualBase - 5*overlap - size/2) up
          const visualBottom = visualBase + (checkerSize_approx / 2);
          const visualTop = visualBase - (4 * (checkerSize_approx - 8)) - (checkerSize_approx / 2);
          
          yStart = Math.min(triangleTip, visualTop) - padding;
          yEnd = Math.max(triangleBase, visualBottom) + padding;
      }
      
      if (actualX >= xStart && actualX <= xEnd && actualY >= yStart && actualY <= yEnd) {
        return pointIndex
      }
    }
    
    // Проверяем бар (упрощенно - центр экрана)
    // В sandbox режиме проверяем наличие шашек на баре, а не isPlayer1
    const barWidth = width * 0.088
    const barX = (width - barWidth) / 2
    if (actualX >= barX && actualX <= barX + barWidth) {
      if (actualY >= height * 0.2 && actualY <= height * 0.8) {
        // Проверяем наличие шашек на баре для определения какой бар (24 для белых, 25 для черных)
        const bar = gameState?.bar || { white: 0, black: 0 }
        // Если есть белые на баре - возвращаем 24, если черные - 25
        // Для sandbox проверяем оба бары
        if (isSandbox) {
          // В sandbox режиме возвращаем 24 если есть белые, иначе 25 если есть черные
          if (bar.white > 0) return 24
          if (bar.black > 0) return 25
        } else {
          // В обычной игре проверяем isPlayer1 для определения цвета
          return isPlayer1 ? 24 : 25
        }
      }
    }
    
    // Проверяем контейнеры (bearOff) - теперь СНИЗУ
    if (actualY >= height - bearOffHeight) {
      // В sandbox разрешаем всегда, если там есть шашки
      if (isSandbox) {
        const bearOff = gameState?.bearOff || { white: 0, black: 0 }
        const isRightSide = actualX > width / 2
        if (isRightSide && bearOff.white > 0) return -1
        if (!isRightSide && bearOff.black > 0) return -1
        
        // Если шашек нет в конкретной половине, но это sandbox - всё равно возвращаем -1
        // чтобы можно было начать перетаскивание "из пустоты" или если кликнули рядом
        return -1
      }
      return validTargetPoints.has(-1) ? -1 : null
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

    // --- ADAPTIVE SCALING LOGIC ---
    // Reference dimensions for mobile (iPhone 14/15 Pro Max)
    // The MOBILE_CONFIG values are tuned for this resolution.
    const REFERENCE_MOBILE_WIDTH = 430;
    const REFERENCE_MOBILE_HEIGHT = 932;
    const isMobile = width < 768;

    // Helper functions to scale fixed pixel offsets based on screen size
    // Используем одинаковую логику для portrait и landscape - просто растягиваем пропорционально
    // Всегда применяем масштабирование для всех размеров экрана
    const scaleY = (val: number) => {
        const factor = height / REFERENCE_MOBILE_HEIGHT;
        return val * factor;
    }

    const scaleX = (val: number) => {
        const factor = width / REFERENCE_MOBILE_WIDTH;
        return val * factor;
    }
    // ------------------------------
    
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    
    // ГЛОБАЛЬНЫЕ ПАРАМЕТРЫ (дублируем логику из getPointCoordinates)
    const bearOffHeight = height * debugConfig.bearOffHeightPct
    const topMargin = height * debugConfig.topMarginPct
    const sideMargin = width * 0.040 // Adjusted
    
    // Определяем параметры доски
    const bearOffWidth = width * 0.06
    const boardWidth = width - (bearOffWidth * 2)
    const barWidth = width * 0.043
    const barX = (width - barWidth) / 2
    
    // Рисуем фоновую картинку (Скин) на всю доску
    // Используем imageUrl из конфигурации скина, а не жестко закодированный путь
    const globalSkinUrl = myBoardColors.imageUrl || '/img/skin1.png'
    
    // Используем закешированное изображение из imagesRef (загружается один раз при монтировании)
    // Браузер автоматически кеширует изображение, поэтому оно не будет перезагружаться каждую игру
    const cachedSkinImg = imagesRef.current['skin']
    if (cachedSkinImg && cachedSkinImg.complete && cachedSkinImg.naturalWidth > 0) {
        ctx.drawImage(cachedSkinImg, 0, 0, width, height)
    } else {
        // Пока изображение загружается, показываем фон
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
        // Используем координаты без индексов
        const debugText = coordText;
        
        let yOffset = 0;
        
        if (isTopRow) {
            // Top Row (13-24) -> Indices 0-11
            // Right Side: Indices 0-5 (Points 24-19)
            // Left Side: Indices 6-11 (Points 18-13)
            if (pointIndex < 6) {
                // Top Right
                yOffset = scaleY(debugConfig.textTopRightY)
            } else {
                // Top Left
                yOffset = scaleY(debugConfig.textTopLeftY)
            }
            ctx.fillText(debugText, x, y + yOffset)
        } else {
            // Bottom Row (1-12) -> Indices 12-23
            // Left Side: Indices 12-17 (Points 12-7)
            // Right Side: Indices 18-23 (Points 6-1)
            if (pointIndex < 18) {
                // Bottom Left
                yOffset = scaleY(debugConfig.textBottomLeftY)
            } else {
                // Bottom Right
                yOffset = scaleY(debugConfig.textBottomRightY)
            }
            ctx.fillText(debugText, x, y + yOffset)
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
        ? y + checkerSize/2 + scaleY(debugConfig.checkerTopOffset)
        : y - checkerSize/2 + scaleY(debugConfig.checkerBottomOffset)  
      
      const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
      const isAnimatingFromThisPoint = animatingChecker && animatingChecker.from === pointIndex
      const isHead = gameMode === 'long' && (pointIndex === 0 || pointIndex === 12);
      
      const checkersToDrawTotal = isDraggingFromThisPoint ? checkerCount - 1 : checkerCount
      // Везде рисуем максимум 5 шашек визуально
      const checkersToDraw = Math.min(checkersToDrawTotal, 5)
      
      for (let i = 0; i < checkersToDraw; i++) {
        // Уменьшаем расстояние между шашками на 8 пикселей (накладываем их друг на друга)
        const overlap = checkerSize - 8
        const yOffset = i * overlap
        const checkerY = isTopRow 
          ? checkerBaseY + yOffset 
          : checkerBaseY - yOffset
        
        // Используем текстуры шашек если есть
        drawChecker(x, checkerY, checkerSize, isWhiteChecker, isMyPoint)
      }
      
      // Если шашек больше 5, показываем число на последней шашке (как в голове)
      if (checkerCount > 5 && !isDraggingFromThisPoint && !isAnimatingFromThisPoint) {
        const overlap = checkerSize - 8
        const lastCheckerY = isTopRow 
          ? checkerBaseY + ((checkersToDraw - 1) * overlap)
          : checkerBaseY - ((checkersToDraw - 1) * overlap)
        
        ctx.save()
        ctx.fillStyle = isWhiteChecker ? '#000' : '#FFF'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(checkerCount.toString(), x, lastCheckerY)
        ctx.restore()
      }
    })
    
    // Подсветка рисуется ПОВЕРХ треугольников и шашек
    // Используем цикл for для всех 24 точек
    for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
      const { x, y, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      
      // Ограничиваем подсветку высотой треугольника (pH) и позиционируем строго по треугольнику
      // Для верхнего ряда: y - это низ треугольника, подсветка идет вверх
      // Для нижнего ряда: y - это верх треугольника, подсветка идет вниз
      const hX = x - pW / 2
      const hY = isTopRow ? (y - pH) : y
      const hH = pH

      // 1. Подсветка точки под курсором
      if (hoveredPoint === pointIndex) {
        const highlightHW = pW * debugConfig.highlightWidthScale
        const highlightHH = hH * debugConfig.highlightHeightScale
        const highlightHX = hX + (pW - highlightHW) / 2 + scaleX(debugConfig.highlightXOffset)
        
        let highlightHY;
        if (isTopRow) {
             highlightHY = (y - pH) + (hH - highlightHH) / 2 + debugConfig.highlightYOffset;
        } else {
             const bottomOffset = (debugConfig as any).highlightBottomYOffset !== undefined 
                ? (debugConfig as any).highlightBottomYOffset 
                : -debugConfig.highlightYOffset;
             
             highlightHY = y + (hH - highlightHH) / 2 + bottomOffset;
        }
        
        ctx.fillStyle = dragging ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        ctx.fillRect(highlightHX, highlightHY, highlightHW, highlightHH)
      }
      
      // 2. Подсветка валидных точек назначения при перетаскивании
      if ((dragging || selectedPoint !== null) && validTargetPoints.has(pointIndex)) {
        // Применяем параметры из debugConfig для размера и смещения подсветки
        const validHW = pW * debugConfig.validHighlightWidthScale
        const validHH = hH * debugConfig.validHighlightHeightScale
        const validHX = hX + (pW - validHW) / 2 + scaleX(debugConfig.validHighlightXOffset)
        
        let validHY;
        if (isTopRow) {
             validHY = (y - pH) + (hH - validHH) / 2 + debugConfig.validHighlightYOffset;
        } else {
             const bottomOffset = (debugConfig as any).validHighlightBottomYOffset !== undefined 
                ? (debugConfig as any).validHighlightBottomYOffset 
                : -debugConfig.highlightYOffset;
             
             validHY = y + (hH - validHH) / 2 + bottomOffset;
        }
        
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
        ctx.fillRect(validHX, validHY, validHW, validHH)
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.lineWidth = 2
        ctx.strokeRect(validHX + 2, validHY + 2, validHW - 4, validHH - 4)
      }
      
      // 3. Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        const selectedHW = pW * debugConfig.highlightWidthScale
        const selectedHH = hH * debugConfig.highlightHeightScale
        const selectedHX = hX + (pW - selectedHW) / 2 + scaleX(debugConfig.highlightXOffset)
        
        let selectedHY;
        if (isTopRow) {
             selectedHY = (y - pH) + (hH - selectedHH) / 2 + debugConfig.highlightYOffset;
        } else {
             const bottomOffset = (debugConfig as any).highlightBottomYOffset !== undefined 
                ? (debugConfig as any).highlightBottomYOffset 
                : -debugConfig.highlightYOffset;
             
             selectedHY = y + (hH - selectedHH) / 2 + bottomOffset;
        }
        
        ctx.fillStyle = 'rgba(90, 127, 196, 0.3)'
        ctx.fillRect(selectedHX, selectedHY, selectedHW, selectedHH)
      }
      
    }
    
    // Отрисовка перетаскиваемой шашки (самый верхний слой)
    if (dragging && dragPosition) {
      // Для pointIndex: -1 (bear-off) используем стандартный размер точки
      const coords = getPointCoordinates(dragging.pointIndex === -1 ? 0 : dragging.pointIndex, canvas)
      const pW = coords.pointWidth
      const pH = coords.pointHeight
      const baseCheckerSize = Math.min(pW * debugConfig.checkerWidthRatio, pH * debugConfig.checkerHeightRatio)
      // Применяем масштаб из debugConfig
      const checkerSize = baseCheckerSize * debugConfig.dragCheckerSizeScale
      // Применяем смещения из debugConfig
      const dragX = dragPosition.x - dragging.offsetX + scaleX(debugConfig.dragCheckerXOffset)
      const dragY = dragPosition.y - dragging.offsetY + scaleY(debugConfig.dragCheckerYOffset)
      
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
      const checkerSize = Math.min(pW * debugConfig.checkerWidthRatio, pH * debugConfig.checkerHeightRatio)
      
      let toX, toY, toTop;
      if (animatingChecker.to === -1 || animatingChecker.to >= 24) {
        // Координаты контейнера выноса (СНИЗУ)
        // Целимся в центр нижней панели
        toX = width / 2
        toY = height - bearOffHeight / 2
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
      
      // Восстанавливаем оригинальное количество (до начала хода), так как virtualGameState уже обновлен
      const originalFromCount = fromCheckerCount + 1
      const fromOverlap = originalFromCount > 5 ? (checkerSize - 8) : checkerSize
      // Clamp index to 4 (max 5 checkers visually)
      const fromVisualIndex = Math.min(originalFromCount, 5) - 1
      
      const startY = fromTop 
        ? fromY + checkerSize/2 + scaleY(debugConfig.checkerTopOffset) + fromVisualIndex * fromOverlap
        : fromY - checkerSize/2 + scaleY(debugConfig.checkerBottomOffset) - fromVisualIndex * fromOverlap

      // Конечная позиция Y (куда приземлится)
      let endY;
      if (animatingChecker.to === -1 || animatingChecker.to >= 24) {
        endY = toY
      } else {
        const toCheckerCount = Math.abs(virtualGameState.points[animatingChecker.to])
        const finalToCount = toCheckerCount + 1
        const toOverlap = finalToCount > 5 ? (checkerSize - 8) : checkerSize
        // Clamp index to 4 (max 5 checkers visually)
        const toVisualIndex = Math.min(toCheckerCount, 4)
        
        endY = toTop
          ? toY + checkerSize/2 + scaleY(debugConfig.checkerTopOffset) + toVisualIndex * toOverlap
          : toY - checkerSize/2 + scaleY(debugConfig.checkerBottomOffset) - toVisualIndex * toOverlap
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
      // ВАЖНО: Позиция должна совпадать с хитбоксом бара (height * 0.2 до height * 0.8)
      if (whiteBarCount > 0) {
        const isAnimatingFromWhiteBar = animatingChecker && animatingChecker.from === 24
        const countToDraw = isAnimatingFromWhiteBar ? whiteBarCount - 1 : whiteBarCount
        // Позиционируем в центре хитбокса бара (от height * 0.2 до height * 0.8)
        const barHitboxTop = height * 0.2
        const barHitboxBottom = height * 0.8
        const barHitboxCenter = (barHitboxTop + barHitboxBottom) / 2
        // Начинаем от центра и идем вниз
        const barStartY = barHitboxCenter
        const isMyBar = isSandbox ? true : isPlayer1
        const overlap = countToDraw > 5 ? (checkerSize * 0.8) : checkerSize
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY + (i * overlap)
          // Ограничиваем позицию хитбоксом бара
          if (barY >= barHitboxTop && barY <= barHitboxBottom) {
            drawChecker(barCenterX, barY, checkerSize, true, isMyBar)
          }
        }
      }
      
      // Черные шашки на баре (отрицательные значения)
      // ВАЖНО: Позиция должна совпадать с хитбоксом бара (height * 0.2 до height * 0.8)
      if (blackBarCount > 0) {
        const isAnimatingFromBlackBar = animatingChecker && animatingChecker.from === 25
        const countToDraw = isAnimatingFromBlackBar ? blackBarCount - 1 : blackBarCount
        // Позиционируем в центре хитбокса бара (от height * 0.2 до height * 0.8)
        const barHitboxTop = height * 0.2
        const barHitboxBottom = height * 0.8
        const barHitboxCenter = (barHitboxTop + barHitboxBottom) / 2
        // Начинаем от центра и идем вверх
        const barStartY = barHitboxCenter
        const isMyBar = isSandbox ? true : !isPlayer1
        const overlap = countToDraw > 5 ? (checkerSize * 0.8) : checkerSize
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY - (i * overlap)
          // Ограничиваем позицию хитбоксом бара
          if (barY >= barHitboxTop && barY <= barHitboxBottom) {
            drawChecker(barCenterX, barY, checkerSize, false, isMyBar)
          }
        }
      }
    }
    
    // Отрисовка области выноса (Теперь СНИЗУ, используем изображения сбоку)
    const bearOffAreaY = height - bearOffHeight + (debugConfig.bearOffYOffset || 0)

    if (virtualGameState.bearOff) {
      const bOff = virtualGameState.bearOff
      const whiteBearOffCount = bOff.white || 0
      const blackBearOffCount = bOff.black || 0
      
      // Изображения сбоку
      const whiteSideImg = imagesRef.current['whiteSide']
      const redSideImg = imagesRef.current['redSide']
      
      // Параметры для отрисовки сбоку (стоячие шашки)
      // Высота шашки сбоку = диаметру (примерно)
      const checkerSideHeight = bearOffHeight * 0.85 * (debugConfig.bearOffCheckerScale || 1.0)
      
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
      const startXWhite = width - sideMargin - whiteW + (debugConfig.bearOffXOffset || 0)
      
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
      const startXBlack = sideMargin + (debugConfig.bearOffXOffset || 0)
      
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

    // Подсветка при перетаскивании в зону выноса (ВЕСЬ НИЗ - теперь разделен на 2 части)
    if ((dragging || selectedPoint !== null) && validTargetPoints.has(-1)) {
      // Determine which side to highlight based on checker color
      let isRightSide = true; // Default to Right (White)
      
      if (dragging && dragging.checkerColor) {
        isRightSide = dragging.checkerColor === 'white';
      } else if (selectedPoint !== null) {
        // Если точка выбрана кликом
        const val = virtualGameState?.points[selectedPoint] || 0;
        if (val !== 0) isRightSide = val > 0;
        else if (selectedPoint === 24) isRightSide = true;
        else if (selectedPoint === 25) isRightSide = false;
      }

      // Применяем параметры из debugConfig для размера и смещения подсветки bear-off
      // Используем ПОЛОВИНУ ширины доски как базу
      const halfWidth = width / 2;
      const bearOffValidHW = halfWidth * (debugConfig.bearOffValidWidthScale || debugConfig.validHighlightWidthScale || 1.0)
      const bearOffValidHH = bearOffHeight * (debugConfig.bearOffValidHeightScale || debugConfig.validHighlightHeightScale || 1.0)
      
      // Вычисляем центр нужной половины
      const centerX = isRightSide ? (width * 0.75) : (width * 0.25);
      
      const bearOffValidHX = centerX - (bearOffValidHW / 2) + scaleX(debugConfig.bearOffValidXOffset || debugConfig.validHighlightXOffset || 0)
      const bearOffValidHY = bearOffAreaY + (bearOffHeight - bearOffValidHH) / 2 + (debugConfig.bearOffValidYOffset || debugConfig.validHighlightYOffset || 0)
      
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
      ctx.fillRect(bearOffValidHX, bearOffValidHY, bearOffValidHW, bearOffValidHH)
      
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
      ctx.lineWidth = 2
      ctx.strokeRect(bearOffValidHX + 2, bearOffValidHY + 2, bearOffValidHW - 4, bearOffValidHH - 4)
      
      if (hoveredPoint === -1) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
        ctx.fillRect(bearOffValidHX, bearOffValidHY, bearOffValidHW, bearOffValidHH)
      }
    }

  }, [virtualGameState, isPlayer1, dragging, dragPosition, hoveredPoint, validTargetPoints, gameMode, animatingChecker, currentPlayer, getPointCoordinates, boardSkinPlayer1, boardSkinPlayer2, checkerSkinPlayer1, checkerSkinPlayer2, opponentBoardColors, myBoardColors, checkerColorsPlayer1, checkerColorsPlayer2, isSandbox])
  
  // Перерисовка при изменении состояния
  useEffect(() => {
    if (canvasRef.current && containerRef.current) {
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      
      // Ограничиваем размеры canvas, чтобы предотвратить огромные размеры в реплее/модальных окнах
      const isInModal = container.closest('.replay-modal') !== null || 
                        container.closest('.analysis-modal-v2') !== null || 
                        container.closest('.admin-modal-overlay') !== null ||
                        rect.height > window.innerHeight * 1.5
      
      let canvasWidth = rect.width
      let canvasHeight = rect.height
      
      if (isInModal || rect.height > 1500) {
        // Для модальных окон ограничиваем размеры
        const MAX_MODAL_HEIGHT = window.innerHeight * 0.6
        const MAX_MODAL_WIDTH = window.innerWidth * 0.8
        canvasWidth = Math.min(canvasWidth, MAX_MODAL_WIDTH)
        canvasHeight = Math.min(canvasHeight, MAX_MODAL_HEIGHT)
      } else {
        // Для обычной игры ограничиваем максимальными значениями
        canvasWidth = Math.min(canvasWidth, 2000)
        canvasHeight = Math.min(canvasHeight, 2000)
      }
      
      canvasRef.current.width = canvasWidth
      canvasRef.current.height = canvasHeight
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
        
        // Сбрасываем подсветку
        setValidTargetPoints(new Set())
        setShowBearOffButton(null)
        
        // Если это серверный ход, добавляем его в список завершенных
        if (finishedChecker.isServerMove) {
          setCompletedServerMoves(prev => [...prev, finishedChecker])
          
          // Если это был последний серверный ход из очереди
          if (serverMoveQueue.length === 0 && onServerMovesFinished) {
            console.log('🤖 All server moves finished')
            // ВАЖНО: Вызываем сразу, без задержки, чтобы состояние обновилось и можно было ходить
            // Сначала очищаем локальные завершенные ходы, чтобы избежать дублирования
            // при обновлении основного gameState из пропсов
            setCompletedServerMoves([]) 
            onServerMovesFinished()
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
    // Determine checker color at the start of animation to avoid "color flip" when stack becomes empty
    let isWhite = true;
    if (from === 24) isWhite = true;
    else if (from === 25) isWhite = false;
    else if (from >= 0 && from < 24 && virtualGameState?.points) {
         const val = virtualGameState.points[from] || 0;
         if (val !== 0) {
             isWhite = val > 0;
         } else {
             // Fallback if point is somehow empty (should not happen in valid move)
             // Default to current player's color for local moves
             isWhite = isPlayer1;
         }
    } else {
         isWhite = isPlayer1; 
    }

    setAnimatingChecker({
      from,
      to,
      die,
      steps,
      progress: 0,
      startTime: performance.now(),
      isWhite // Store the color explicitly
    })
    // Сбрасываем состояния взаимодействия
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
        
        // Ограничиваем размеры canvas, чтобы предотвратить огромные размеры в реплее/модальных окнах
        const isInModal = container.closest('.replay-modal') !== null || 
                          container.closest('.analysis-modal-v2') !== null || 
                          container.closest('.admin-modal-overlay') !== null ||
                          rect.height > window.innerHeight * 1.5
        
        let canvasWidth = rect.width
        let canvasHeight = rect.height
        
        if (isInModal || rect.height > 1500) {
          // Для модальных окон ограничиваем размеры
          const MAX_MODAL_HEIGHT = window.innerHeight * 0.6
          const MAX_MODAL_WIDTH = window.innerWidth * 0.8
          canvasWidth = Math.min(canvasWidth, MAX_MODAL_WIDTH)
          canvasHeight = Math.min(canvasHeight, MAX_MODAL_HEIGHT)
        } else {
          // Для обычной игры ограничиваем максимальными значениями
          canvasWidth = Math.min(canvasWidth, 2000)
          canvasHeight = Math.min(canvasHeight, 2000)
        }
        
        canvasRef.current.width = canvasWidth
        canvasRef.current.height = canvasHeight
        setContainerHeight(canvasHeight) // Используем ограниченную высоту
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
      // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
      // canvas.width/height - внутренний размер, rect.width/height - визуальный размер
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (touch.clientX - rect.left) * scaleX
      const y = (touch.clientY - rect.top) * scaleY
      
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
        // Если у нас была выбрана точка и мы тапаем по валидной цели - делаем ход
        if (selectedPoint !== null && validTargetPoints.has(pointIndex)) {
          const move = possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex)
          if (move) {
            startMoveAnimation(move.from, move.to, move.die, move.steps)
          }
          setSelectedPoint(null)
          setValidTargetPoints(new Set())
          return
        }

        // Если тапаем по той же точке - снимаем выделение
        if (selectedPoint === pointIndex) {
          setSelectedPoint(null)
          setValidTargetPoints(new Set())
          return
        }

        const points = virtualGameState?.points || []
        const bar = virtualGameState?.bar || { white: 0, black: 0 }
        
        let pointValue = 0
        if (pointIndex === 24) pointValue = bar.white
        else if (pointIndex === 25) pointValue = -bar.black // Для черных используем отрицательное значение
        else pointValue = points[pointIndex] || 0
        
        // В sandbox разрешаем перетаскивать любую шашку за обе стороны
        // В режиме play - drag & drop без выбора (как в обычной игре)
        // В режиме setup - сразу включаем свободное перемещение
        if (isSandbox) {
          if (pointValue !== 0) {
            // В режиме play используем drag & drop сразу без выбора (как в обычной игре)
            // В режиме setup - свободное перемещение
            const { x: pX, y: pY } = getPointCoordinates(pointIndex, canvas)
            if (sandboxMode === 'play') {
              // В play режиме начинаем drag & drop сразу, но с учетом правил игры (возможные ходы)
              // Если есть возможные ходы - используем обычную логику выбора, иначе - свободное перемещение
              const activePlayer = currentPlayer
              const isWhiteChecker = pointValue > 0
              const isBlackChecker = pointValue < 0
              const isMyChecker = (activePlayer === 0 && isWhiteChecker) || (activePlayer === 1 && isBlackChecker)
              
              // Проверяем есть ли возможные ходы для этой точки
            const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
            
            // В sandbox режиме разрешаем перетаскивать из bearOff
            if (isSandbox && pointIndex === -1) {
              const bearOff = virtualGameState?.bearOff || { white: 0, black: 0 }
              const isWhiteSide = x > canvas.width / 2
              const checkerColor = isWhiteSide ? 'white' : 'black'
              const count = isWhiteSide ? bearOff.white : bearOff.black
              
              if (count > 0) {
                setDragging({ 
                  pointIndex: -1, 
                  offsetX: 0, 
                  offsetY: 0,
                  freeMove: true,
                  checkerColor
                })
                setDragPosition({ x, y })
                return
              }
            }

            if (pointMoves.length > 0 && isMyChecker) {
                // Если есть возможные ходы - используем обычную логику выбора
                setSelectedPoint(pointIndex)
                const validTargets = new Set<number>()
                pointMoves.forEach(move => {
                  if (move.to !== undefined && move.to !== null) {
                    validTargets.add(move.to)
                  }
                })
                setValidTargetPoints(validTargets)
                setDragging({ pointIndex, offsetX: 0, offsetY: 0 })
                setDragPosition({ x, y })
                return
              }
            }
            
            // В setup режиме или если нет возможных ходов - свободное перемещение
            setDragging({ 
              pointIndex, 
              offsetX: x - pX, 
              offsetY: y - pY,
              freeMove: true 
            })
            setDragPosition({ x, y })
            return
          }
        }

        const activePlayer = isSandbox ? currentPlayer : (isPlayer1 ? 0 : 1)
        const isMyChecker = isSandbox ? pointValue !== 0 : (activePlayer === 0 ? pointValue > 0 : pointValue < 0)
    const isMyBar = isSandbox 
      ? (pointIndex === 24 ? (virtualGameState?.bar?.white || 0) > 0 : (pointIndex === 25 ? (virtualGameState?.bar?.black || 0) > 0 : false))
      : ((pointIndex === 24 && activePlayer === 0 && pointValue > 0) || (pointIndex === 25 && activePlayer === 1 && pointValue < 0))
    
    // В sandbox режиме разрешаем брать из bearOff (код -1)
    const isMyBearOff = isSandbox && pointIndex === -1 && (
      (virtualGameState?.bearOff?.white || 0) > 0 || (virtualGameState?.bearOff?.black || 0) > 0
    )
    
    if (isMyChecker || isMyBar || isMyBearOff) {
      const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
          let localTouchBearOffDie: number | null = null
          
          if (pointMoves.length > 0) {
            setSelectedPoint(pointIndex)
            const validTargets = new Set<number>()
            pointMoves.forEach(move => {
              if (move.to !== undefined && move.to !== null) {
                validTargets.add(move.to)
                if (move.to === -1) localTouchBearOffDie = move.die
              }
            })
            setValidTargetPoints(validTargets)

            // Начинаем перетаскивание (центрируем шашку)
            setDragging({ pointIndex, offsetX: 0, offsetY: 0 })
            setDragPosition({ x, y })
          } else {
            setSelectedPoint(null)
            setValidTargetPoints(new Set())
          }

          if (localTouchBearOffDie !== null) {
            setShowBearOffButton({ pointIndex, die: localTouchBearOffDie })
          } else {
            setShowBearOffButton(null)
          }
        } else {
          setSelectedPoint(null)
          setValidTargetPoints(new Set())
          setShowBearOffButton(null)
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
    // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

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
    // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
    // canvas.width/height - внутренний размер, rect.width/height - визуальный размер
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    // В sandbox режиме обрабатываем перетаскивание из bearOff
    if (isSandbox) {
      // Прямая проверка клика в зону bearOff снизу
      const bHeight = canvas.height * debugConfig.bearOffHeightPct
      if (y >= canvas.height - bHeight) {
        const isWhiteSide = x > canvas.width / 2
        const color = isWhiteSide ? 'white' : 'black'
        const count = isWhiteSide ? (virtualGameState?.bearOff?.white || 0) : (virtualGameState?.bearOff?.black || 0)
        
        if (count > 0 || sandboxMode === 'setup') {
          setDragging({ 
            pointIndex: -1, 
            offsetX: 0, 
            offsetY: 0,
            freeMove: true,
            checkerColor: color
          })
          setDragPosition({ x, y })
          return
        }
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

    // Если у нас была выбрана точка и мы кликаем по валидной цели - делаем ход (клик-клик)
    if (selectedPoint !== null && validTargetPoints.has(pointIndex)) {
      const move = possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex)
      if (move) {
        startMoveAnimation(move.from, move.to, move.die, move.steps)
      }
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      return
    }

    // Если кликаем по той же точке - снимаем выделение
    if (selectedPoint === pointIndex) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      return
    }
    
    // Для коротких нард: если есть шашки на баре, блокируем клики по точкам на доске
    if (gameMode === 'short' && !isSandbox) { // В sandbox не блокируем
      const bar = virtualGameState?.bar || { white: 0, black: 0 }
      const activePlayer = isPlayer1 ? 0 : 1
      const hasBarCheckers = activePlayer === 0 ? bar.white > 0 : bar.black > 0
      
      if (hasBarCheckers && pointIndex !== 24 && pointIndex !== 25) {
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
    let localBearOffDie: number | null = null
    
    if (pointMoves.length > 0) {
      setSelectedPoint(pointIndex)
      
      const validTargets = new Set<number>()
      pointMoves.forEach(move => {
        if (move.to !== undefined && move.to !== null) {
          validTargets.add(move.to)
          if (move.to === -1) localBearOffDie = move.die
        }
      })
      setValidTargetPoints(validTargets)

      // Начинаем перетаскивание сразу при mousedown
      setDragging({ pointIndex, offsetX: 0, offsetY: 0 })
      setDragPosition({ x, y })
    } else {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
    }
    
    if (localBearOffDie !== null) {
      setShowBearOffButton({ pointIndex, die: localBearOffDie })
    } else {
      setShowBearOffButton(null)
    }
  }
  
  // Обработка движения мыши
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
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
    // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
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
    setValidTargetPoints(new Set())
    setShowBearOffButton(null)
    setHoveredPoint(null)
  }
  
  // Обработка клика только для тройного клика (быстрый ход)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) return
    
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
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
    
    // Добавляем текущий клик в историю для тройного клика
    clickHistoryRef.current = [...recentHistory, { pointIndex, timestamp: now }]
    
    // Очищаем таймаут через задержку
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
    }
    
    clickTimeoutRef.current = window.setTimeout(() => {
      clickHistoryRef.current = []
      clickTimeoutRef.current = null
    }, CLICK_DELAY)
  }
  
  // ВАЖНО: Обновляем позицию кубиков когда появляются кубики или завершается анимация
  // Это гарантирует, что кубики перемещаются в правильный угол после анимации
  // ВАЖНО: Обновляем позицию кубиков только при изменении currentPlayer или завершении анимации
  // Не обновляем при каждом изменении diceArray, чтобы избежать смещения при дубле
  useEffect(() => {
    if (!diceAnimating && diceArray && diceArray.length > 0) {
      // Небольшая задержка для плавного перехода после завершения анимации
      const timeoutId = setTimeout(() => {
        updateDicePosition()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [diceAnimating, currentPlayer, diceArray?.length, updateDicePosition])
  
  // Определяем использованные кубики из pendingMoves
  // Используем Set для отслеживания индексов использованных кубиков (для дублей)
  const usedDiceIndices = useMemo(() => {
    if (!diceArray || !pendingMoves || pendingMoves.length === 0) {
      return new Set<number>()
    }
    
    const usedIndices = new Set<number>()
    // Создаем массив доступных индексов для каждого значения кубика
    const availableIndicesByValue = new Map<number, number[]>()
    diceArray.forEach((die, idx) => {
      if (!availableIndicesByValue.has(die)) {
        availableIndicesByValue.set(die, [])
      }
      availableIndicesByValue.get(die)!.push(idx)
    })
    
    pendingMoves.forEach(move => {
      // Если есть steps, используем их (для комбинированных ходов)
      if ((move as any).steps && Array.isArray((move as any).steps)) {
        (move as any).steps.forEach((step: any) => {
          const availableIndices = availableIndicesByValue.get(step.die) || []
          // Берем первый доступный индекс для этого значения кубика
          const idx = availableIndices.find(i => !usedIndices.has(i))
          if (idx !== undefined) {
            usedIndices.add(idx)
            // Удаляем использованный индекс из доступных
            const indexInArray = availableIndices.indexOf(idx)
            if (indexInArray !== -1) {
              availableIndices.splice(indexInArray, 1)
            }
          }
        })
      } else {
        // Ищем кубик по значению (для одиночных ходов)
        const availableIndices = availableIndicesByValue.get(move.die) || []
        const idx = availableIndices.find(i => !usedIndices.has(i))
        if (idx !== undefined) {
          usedIndices.add(idx)
          // Удаляем использованный индекс из доступных
          const indexInArray = availableIndices.indexOf(idx)
          if (indexInArray !== -1) {
            availableIndices.splice(indexInArray, 1)
          }
        } else if (gameMode === 'long') {
          // Для длинных нард пробуем найти сумму двух кубиков
          const sumValue = move.die
          // Ищем два кубика, сумма которых равна move.die
          for (const [dieValue1, indices1] of availableIndicesByValue.entries()) {
            const available1 = indices1.filter(i => !usedIndices.has(i))
            if (available1.length === 0) continue
            
            const dieValue2 = sumValue - dieValue1
            const indices2 = availableIndicesByValue.get(dieValue2) || []
            const available2 = indices2.filter(i => !usedIndices.has(i) && i !== available1[0])
            
            if (available2.length > 0) {
              // Нашли пару кубиков для суммы
              usedIndices.add(available1[0])
              usedIndices.add(available2[0])
              // Удаляем использованные индексы из доступных
              const idx1InArray = indices1.indexOf(available1[0])
              if (idx1InArray !== -1) indices1.splice(idx1InArray, 1)
              const idx2InArray = indices2.indexOf(available2[0])
              if (idx2InArray !== -1) indices2.splice(idx2InArray, 1)
              break
            }
          }
        }
      }
    })
    
    return usedIndices
  }, [diceArray, pendingMoves, gameMode])

  // Подсчитываем сколько ходов осталось при дубле
  const remainingMoves = useMemo(() => {
    if (!diceArray || diceArray.length === 0) return 0
    
    const isDoubles = isActuallyDoubles
    if (!isDoubles) return 0
    
    const totalDice = diceArray.length
    const usedCount = usedDiceIndices.size
    return totalDice - usedCount
  }, [diceArray, usedDiceIndices, isActuallyDoubles])

  // --- DEBUG UI COMPONENT ---
  const DebugUI = () => {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const scrollPositionRef = useRef<number>(0)
    const isScrollingRef = useRef<boolean>(false)
    
    // Сохраняем позицию скролла при каждом скролле
    useEffect(() => {
      const container = scrollContainerRef.current
      if (!container) return
      
      const handleScroll = () => {
        if (!isScrollingRef.current) {
          scrollPositionRef.current = container.scrollTop
        }
      }
      
      container.addEventListener('scroll', handleScroll, { passive: true })
      return () => container.removeEventListener('scroll', handleScroll)
    }, [])
    
    // Восстанавливаем позицию скролла СИНХРОННО при КАЖДОМ рендере
    // Это предотвращает сброс скролла при изменении debugConfig
    useLayoutEffect(() => {
      if (scrollContainerRef.current && scrollPositionRef.current > 0) {
        scrollContainerRef.current.scrollTop = scrollPositionRef.current
      }
    })

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
      // Просто изменяем состояние - контейнер скролла не пересоздается благодаря стабильному key
      setDebugConfig(prev => ({ ...prev, [key]: value }))
    }
    
    const handleIncrement = (key: keyof typeof debugConfig, delta: number) => {
      const currentValue = debugConfig[key as keyof typeof debugConfig]
      const item = [
        { key: 'sideMarginPct', label: 'Side Margin', min: 0, max: 2, step: 0.001 },
        { key: 'barWidthPct', label: 'Bar Width', min: 0, max: 2, step: 0.001 },
        { key: 'topMarginPct', label: 'Top Margin', min: 0, max: 2, step: 0.001 },
        { key: 'bearOffHeightPct', label: 'BearOff Height', min: 0, max: 2, step: 0.001 },
        { key: 'checkerWidthRatio', label: 'Checker Width Ratio', min: 0.01, max: 20, step: 0.01 },
        { key: 'checkerHeightRatio', label: 'Checker Height Ratio', min: 0.001, max: 5, step: 0.001 },
        { key: 'checkerDrawScale', label: 'Checker Draw Scale', min: 0.01, max: 20, step: 0.01 },
        { key: 'diceP1X', label: 'Dice P1 X (0-1)', min: -2, max: 3, step: 0.01 },
        { key: 'diceP1Y', label: 'Dice P1 Y (0-1)', min: -2, max: 3, step: 0.01 },
        { key: 'diceP2X', label: 'Dice P2 X (0-1)', min: -2, max: 3, step: 0.01 },
        { key: 'diceP2Y', label: 'Dice P2 Y (0-1)', min: -2, max: 3, step: 0.01 },
        { key: 'checkerTopOffset', label: 'Top Checker Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'checkerBottomOffset', label: 'Bottom Checker Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'highlightWidthScale', label: 'Highlight Width Scale', min: 0.01, max: 20, step: 0.01 },
        { key: 'highlightHeightScale', label: 'Highlight Height Scale', min: 0.01, max: 20, step: 0.01 },
        { key: 'highlightXOffset', label: 'Highlight X Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'highlightYOffset', label: 'Highlight Y Offset (px)', min: -1000, max: 1000, step: 1 },
        { key: 'textTopLeftY', label: 'Text Top Left Y', min: -1000, max: 1000, step: 1 },
        { key: 'textTopRightY', label: 'Text Top Right Y', min: -1000, max: 1000, step: 1 },
        { key: 'textBottomLeftY', label: 'Text Bottom Left Y', min: -1000, max: 1000, step: 1 },
        { key: 'textBottomRightY', label: 'Text Bottom Right Y', min: -1000, max: 1000, step: 1 },
      ].find(i => i.key === key)
      
      if (item) {
        // Для точной настройки используем step, но можно умножить на 10 для больших шагов
        const step = item.step
        const newValue = Math.max(item.min, Math.min(item.max, currentValue + (delta * step)))
        handleChange(key, newValue)
      }
    }
    
    // Determine which config is currently active for display label
    const isMobile = containerRef.current && containerRef.current.offsetWidth < 768;

    // Убрали кастомные обработчики touch - используем стандартный скролл

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
        key="debug-panel-scroll-container" // Стабильный key чтобы контейнер не пересоздавался
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
          maxHeight: '80vh',
          height: '80vh', // Фиксированная высота для скролла
          overflowY: 'auto', // Включаем скролл
          overflowX: 'hidden',
          border: '1px solid #444',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          width: '300px',
          pointerEvents: 'auto',
          WebkitOverflowScrolling: 'touch', // Плавный скролл на iOS
          overscrollBehavior: 'contain', // Предотвращаем скролл фона
        }}
        // Stop propagation of all pointer events so they don't reach the board
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          // Разрешаем стандартный скролл колесиком мыши
          e.stopPropagation()
        }}
        onTouchStart={(e) => {
          // Останавливаем только для того чтобы не передавать на canvas
          e.stopPropagation()
        }}
        onTouchMove={(e) => {
          // Разрешаем стандартный скролл на touch устройствах
          e.stopPropagation()
          // НЕ preventDefault - это блокирует скролл!
        }}
        onTouchEnd={(e) => {
          e.stopPropagation()
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10, paddingBottom: '5px' }}>
          <h3 style={{ margin: 0 }}>Debug ({isMobile ? 'Mobile' : 'Desktop'})</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             <button 
               onClick={() => {
                 const defaultConfig = isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG
                 setDebugConfig(defaultConfig)
                 localStorage.removeItem('backgammon-debug-config')
               }} 
               style={{ fontSize: '12px', padding: '3px 6px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
               title="Сбросить на дефолт"
             >
               Reset
             </button>
             <button onClick={scrollUp} style={{ fontSize: '16px', padding: '5px' }}>⬆️</button>
             <button onClick={scrollDown} style={{ fontSize: '16px', padding: '5px' }}>⬇️</button>
             <button onClick={() => setDebugMode(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
        </div>
        
        <div style={{ marginBottom: '10px', fontSize: '10px', color: '#aaa' }}>
            Current Width: {containerRef.current?.offsetWidth}px
        </div>
        
        {[
          { key: 'sideMarginPct', label: 'Side Margin', min: 0, max: 2, step: 0.001 },
          { key: 'barWidthPct', label: 'Bar Width', min: 0, max: 2, step: 0.001 },
          { key: 'topMarginPct', label: 'Top Margin', min: 0, max: 2, step: 0.001 },
          { key: 'bearOffHeightPct', label: 'BearOff Height', min: 0, max: 2, step: 0.001 },
          { key: 'checkerWidthRatio', label: 'Checker Width Ratio', min: 0.01, max: 20, step: 0.01 },
          { key: 'checkerHeightRatio', label: 'Checker Height Ratio', min: 0.001, max: 5, step: 0.001 },
          { key: 'checkerDrawScale', label: 'Checker Draw Scale', min: 0.01, max: 20, step: 0.01 },
          { key: 'diceP1X', label: 'Dice P1 X (0-1)', min: -2, max: 3, step: 0.01 },
          { key: 'diceP1Y', label: 'Dice P1 Y (0-1)', min: -2, max: 3, step: 0.01 },
          { key: 'diceP2X', label: 'Dice P2 X (0-1)', min: -2, max: 3, step: 0.01 },
          { key: 'diceP2Y', label: 'Dice P2 Y (0-1)', min: -2, max: 3, step: 0.01 },
          { key: 'checkerTopOffset', label: 'Top Checker Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'checkerBottomOffset', label: 'Bottom Checker Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'highlightWidthScale', label: 'Highlight Width Scale', min: 0.01, max: 20, step: 0.01 },
          { key: 'highlightHeightScale', label: 'Highlight Height Scale', min: 0.01, max: 20, step: 0.01 },
          { key: 'highlightXOffset', label: 'Highlight X Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'highlightYOffset', label: 'Highlight Y Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'validHighlightWidthScale', label: 'Valid Highlight Width Scale', min: 0.01, max: 20, step: 0.01 },
          { key: 'validHighlightHeightScale', label: 'Valid Highlight Height Scale', min: 0.01, max: 20, step: 0.01 },
          { key: 'validHighlightXOffset', label: 'Valid Highlight X Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'validHighlightYOffset', label: 'Valid Highlight Y Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'dragCheckerSizeScale', label: 'Drag Checker Size Scale', min: 0.01, max: 20, step: 0.01 },
          { key: 'dragCheckerXOffset', label: 'Drag Checker X Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'dragCheckerYOffset', label: 'Drag Checker Y Offset (px)', min: -1000, max: 1000, step: 1 },
          { key: 'textTopLeftY', label: 'Text Top Left Y', min: -1000, max: 1000, step: 1 },
          { key: 'textTopRightY', label: 'Text Top Right Y', min: -1000, max: 1000, step: 1 },
          { key: 'textBottomLeftY', label: 'Text Bottom Left Y', min: -1000, max: 1000, step: 1 },
          { key: 'textBottomRightY', label: 'Text Bottom Right Y', min: -1000, max: 1000, step: 1 },
        ].map(item => (
          <div key={item.key} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ flex: 1 }}>{item.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  onClick={() => handleIncrement(item.key as keyof typeof debugConfig, -1)}
                  style={{ fontSize: '14px', padding: '2px 6px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
                  title={`Уменьшить на ${item.step}`}
                >
                  −
                </button>
                <span style={{ minWidth: '80px', textAlign: 'center' }}>{debugConfig[item.key as keyof typeof debugConfig].toFixed(3)}</span>
                <button
                  onClick={() => handleIncrement(item.key as keyof typeof debugConfig, 1)}
                  style={{ fontSize: '14px', padding: '2px 6px', background: '#444', border: '1px solid #666', color: '#fff', cursor: 'pointer', borderRadius: '3px' }}
                  title={`Увеличить на ${item.step}`}
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={debugConfig[item.key as keyof typeof debugConfig]}
              onChange={(e) => {
                handleChange(item.key as keyof typeof debugConfig, parseFloat(e.target.value))
              }}
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
      {debugMode ? (
        <DebugPanel
          debugConfig={debugConfig}
          setDebugConfig={setDebugConfig}
          setDebugMode={setDebugMode}
          debugDice={debugDice}
          setDebugDice={setDebugDice}
          containerWidth={containerRef.current?.offsetWidth || 0}
          isMobile={containerRef.current ? containerRef.current.offsetWidth < 768 : false}
          MOBILE_CONFIG={MOBILE_CONFIG}
          DESKTOP_CONFIG={DESKTOP_CONFIG}
        />
      ) : (
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
      )}
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
            // ВАЖНО: Преобразуем координаты с учетом масштаба canvas
            const scaleX = canvasRef.current.width / rect.width
            const scaleY = canvasRef.current.height / rect.height
            const x = (e.clientX - rect.left) * scaleX
            const y = (e.clientY - rect.top) * scaleY
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
          // Убираем анимацию при инициализации позиции или во время анимации броска
          transition: (diceAnimating || !dice3DPosition) ? 'none' : 'all 0.5s ease-out',
          // Гарантируем, что кубики не выходят за границы доски
          maxWidth: '100%',
          maxHeight: '100%',
          // Добавляем визуальные эффекты для лучшей видимости
          filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.8))',
          // Показываем кубики только если они есть в gameState
          opacity: (effectiveDice && effectiveDice.length > 0) ? 1 : 0,
          visibility: (effectiveDice && effectiveDice.length > 0) ? 'visible' : 'hidden',
          // Добавляем видимый фон для отладки (можно убрать позже)
          backgroundColor: debugMode ? 'rgba(255, 0, 0, 0.3)' : 'transparent', // Red bg in debug mode
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
              if (!effectiveDice || effectiveDice.length === 0) return null;
              
              const dieValue = effectiveDice[0];
              // Вычисляем оставшиеся ходы (половинки)
              const movesCount = effectiveDice.length - usedDiceIndices.size;

              if (isActuallyDoubles) {
                // Всегда показываем 2 кубика при дубле
                // Логика затухания: кубик остается ярким (1.0) пока есть ходы (x2 или x1)
                // Затухает до 0.1 (x0) только когда полностью потрачен (после 2-го хода этого кубика)
                
                // Множители
                const d1Multiplier = movesCount >= 3 ? 2 : (movesCount >= 1 ? 1 : 0);
                const d2Multiplier = movesCount >= 4 ? 2 : (movesCount >= 2 ? 1 : 0);

                // Прозрачность: 1.0 если есть ходы, 0.1 если ходов нет
                const d1Opacity = d1Multiplier > 0 ? 1.0 : 0.1;
                const d2Opacity = d2Multiplier > 0 ? 1.0 : 0.1;

                const renderBadge = (multiplier: number) => {
                  if (multiplier === 0) return null;
                  return (
                    <div style={{
                      position: 'absolute',
                      top: '-15px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(232, 65, 66, 0.9)',
                      color: 'white',
                      borderRadius: '10px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      zIndex: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      pointerEvents: 'none'
                    }}>
                      x{multiplier}
                    </div>
                  );
                };

                return (
                  <>
                    <div style={{ opacity: d1Opacity, position: 'relative', transition: 'opacity 0.3s ease' }}>
                      {renderBadge(d1Multiplier)}
                      <Dice3D values={[dieValue]} animating={false} diceColor={currentPlayer === 0 ? diceColorPlayer1 : diceColorPlayer2} />
                    </div>
                    <div style={{ opacity: d2Opacity, position: 'relative', transition: 'opacity 0.3s ease' }}>
                      {renderBadge(d2Multiplier)}
                      <Dice3D values={[dieValue]} animating={false} diceColor={currentPlayer === 0 ? diceColorPlayer1 : diceColorPlayer2} />
                    </div>
                  </>
                );
              }

              // Обычный режим
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
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
