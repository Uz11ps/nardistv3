import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { apiClient } from '../api/client'
import Dice3D from './Dice3D'
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
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Загружаем текстуры для скинов
  const [boardTexturePlayer1, setBoardTexturePlayer1] = useState<HTMLImageElement | null>(null)
  const [boardTexturePlayer2, setBoardTexturePlayer2] = useState<HTMLImageElement | null>(null)
  const [whiteCheckerTexture, setWhiteCheckerTexture] = useState<HTMLImageElement | null>(null)
  const [blackCheckerTexture, setBlackCheckerTexture] = useState<HTMLImageElement | null>(null)
  const [diceTexturesPlayer1, setDiceTexturesPlayer1] = useState<{ [face: number]: HTMLImageElement }>({})
  const [diceTexturesPlayer2, setDiceTexturesPlayer2] = useState<{ [face: number]: HTMLImageElement }>({})
  
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number; steps?: any[] }>>([])
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())
  const [dice3DPosition, setDice3DPosition] = useState<{ x: number; y: number; size: number } | null>(null)
  const [dragging, setDragging] = useState<{ pointIndex: number; offsetX: number; offsetY: number } | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [validTargetPoints, setValidTargetPoints] = useState<Set<number>>(new Set())
  const [showBearOffButton, setShowBearOffButton] = useState<{ pointIndex: number; die: number; steps?: any[] } | null>(null)
  const [animatingChecker, setAnimatingChecker] = useState<{
    from: number;
    to: number;
    die: number;
    steps?: any[];
    progress: number;
    startTime: number;
  } | null>(null)
  
  // Защита от случайных двойных кликов
  const lastClickRef = useRef<{ pointIndex: number; timestamp: number } | null>(null)
  const doubleClickTimeoutRef = useRef<number | null>(null)
  const isDoubleClickRef = useRef<boolean>(false)
  
  // Очистка таймаутов при размонтировании
  useEffect(() => {
    return () => {
      if (doubleClickTimeoutRef.current !== null) {
        window.clearTimeout(doubleClickTimeoutRef.current)
        doubleClickTimeoutRef.current = null
      }
    }
  }, [])
  
  const isPlayer1 = myPlayerId === player1Id

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

  // Fallback пути к дефолтным SVG файлам
  const DEFAULT_BOARD_TEXTURE = '/skins/default-board.svg'
  const DEFAULT_WHITE_CHECKER_TEXTURE = '/skins/default-checkers-white.svg'
  const DEFAULT_BLACK_CHECKER_TEXTURE = '/skins/default-checkers-black.svg'

  // Загружаем текстуры при изменении скинов с fallback на дефолтные SVG
  useEffect(() => {
    // Улучшенная функция загрузки изображения с поддержкой SVG и обработкой ошибок
    const loadImage = (url: string, onSuccess: (img: HTMLImageElement) => void, onError: () => void) => {
      const img = new Image()
      
      // Для SVG на мобильных устройствах может потребоваться другой подход
      // Убираем crossOrigin для локальных файлов, так как это может вызывать проблемы с SVG
      if (url.startsWith('http') && !url.includes(window.location.hostname)) {
        img.crossOrigin = 'anonymous'
      }
      
      // Добавляем таймаут для случаев, когда onerror не срабатывает
      let timeout: number | null = null
      
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
      }
      
      img.onload = () => {
        cleanup()
        // Проверяем, что изображение действительно загрузилось
        // Для SVG может быть width/height = 0, но это нормально, проверяем complete
        if (img.complete && (img.width > 0 || img.height > 0 || url.endsWith('.svg'))) {
          onSuccess(img)
        } else {
          // Если размеры 0 и это не SVG, значит изображение не загрузилось корректно
          onError()
        }
      }
      
      img.onerror = () => {
        cleanup()
        console.warn(`Failed to load image: ${url}`)
        onError()
      }
      
      // Таймаут для случаев, когда события не срабатывают
      timeout = setTimeout(() => {
        if (!img.complete) {
          console.warn(`Image load timeout: ${url}`)
          onError()
        }
      }, 5000)
      
      // Устанавливаем src в конце, чтобы обработчики были готовы
      img.src = url
    }

    // Загрузка текстуры доски для player1 (левая половина)
    const loadBoardTexturePlayer1 = () => {
      const textureUrl = boardSkinPlayer1?.boardTextureUrl
      
      if (textureUrl) {
        loadImage(
          textureUrl.startsWith('http') ? textureUrl : `${window.location.origin}${textureUrl}`,
          (img) => setBoardTexturePlayer1(img),
          () => {
            console.warn('Failed to load board texture for player1 from admin')
            setBoardTexturePlayer1(null)
          }
        )
      } else {
        setBoardTexturePlayer1(null)
      }
    }

    // Загрузка текстуры доски для player2 (правая половина)
    const loadBoardTexturePlayer2 = () => {
      const textureUrl = boardSkinPlayer2?.boardTextureUrl
      
      if (textureUrl) {
        loadImage(
          textureUrl.startsWith('http') ? textureUrl : `${window.location.origin}${textureUrl}`,
          (img) => setBoardTexturePlayer2(img),
          () => {
            console.warn('Failed to load board texture for player2 from admin')
            setBoardTexturePlayer2(null)
          }
        )
      } else {
        setBoardTexturePlayer2(null)
      }
    }

    loadBoardTexturePlayer1()
    loadBoardTexturePlayer2()

    // Загрузка текстур шашек для player1 (белые)
    const loadWhiteCheckerTexture = () => {
      const textureUrl = checkerSkinPlayer1?.whiteCheckersTextureUrl || DEFAULT_WHITE_CHECKER_TEXTURE
      
      loadImage(
        textureUrl.startsWith('http') ? textureUrl : `${window.location.origin}${textureUrl}`,
        (img) => setWhiteCheckerTexture(img),
        () => {
          // Fallback на дефолтную текстуру
          if (textureUrl !== DEFAULT_WHITE_CHECKER_TEXTURE) {
            loadImage(
              `${window.location.origin}${DEFAULT_WHITE_CHECKER_TEXTURE}`,
              (img) => setWhiteCheckerTexture(img),
              () => {
                console.warn('Failed to load default white checker texture')
                setWhiteCheckerTexture(null)
              }
            )
          } else {
            setWhiteCheckerTexture(null)
          }
        }
      )
    }

    loadWhiteCheckerTexture()

    // Загрузка текстур шашек для player2 (черные)
    const loadBlackCheckerTexture = () => {
      const textureUrl = checkerSkinPlayer2?.blackCheckersTextureUrl || DEFAULT_BLACK_CHECKER_TEXTURE
      
      loadImage(
        textureUrl.startsWith('http') ? textureUrl : `${window.location.origin}${textureUrl}`,
        (img) => setBlackCheckerTexture(img),
        () => {
          // Fallback на дефолтную текстуру
          if (textureUrl !== DEFAULT_BLACK_CHECKER_TEXTURE) {
            loadImage(
              `${window.location.origin}${DEFAULT_BLACK_CHECKER_TEXTURE}`,
              (img) => setBlackCheckerTexture(img),
              () => {
                console.warn('Failed to load default black checker texture')
                setBlackCheckerTexture(null)
              }
            )
          } else {
            setBlackCheckerTexture(null)
          }
        }
      )
    }

    loadBlackCheckerTexture()

    // Загрузка текстур костей для player1
    const loadDiceTexturesPlayer1 = async () => {
      const diceSkin = diceSkinPlayer1
      if (!diceSkin?.diceTextureUrls || typeof diceSkin.diceTextureUrls !== 'object') {
        setDiceTexturesPlayer1({})
        return
      }

      const textures: { [face: number]: HTMLImageElement } = {}
      const loadPromises: Promise<void>[] = []

      for (let face = 1; face <= 6; face++) {
        const textureUrl = diceSkin.diceTextureUrls[face]
        if (textureUrl) {
          loadPromises.push(
            new Promise<void>((resolve) => {
              loadImage(
                textureUrl.startsWith('http') ? textureUrl : `${window.location.origin}${textureUrl}`,
                (img) => {
                  textures[face] = img
                  resolve()
                },
                () => {
                  console.warn(`Failed to load dice texture for player1, face ${face}`)
                  resolve()
                }
              )
            })
          )
        }
      }

      await Promise.all(loadPromises)
      setDiceTexturesPlayer1(textures)
    }

    loadDiceTexturesPlayer1()

    // Загрузка текстур костей для player2
    const loadDiceTexturesPlayer2 = async () => {
      const diceSkin = diceSkinPlayer2
      if (!diceSkin?.diceTextureUrls || typeof diceSkin.diceTextureUrls !== 'object') {
        setDiceTexturesPlayer2({})
        return
      }

      const textures: { [face: number]: HTMLImageElement } = {}
      const loadPromises: Promise<void>[] = []

      for (let face = 1; face <= 6; face++) {
        const textureUrl = diceSkin.diceTextureUrls[face]
        if (textureUrl) {
          loadPromises.push(
            new Promise<void>((resolve) => {
              loadImage(
                textureUrl.startsWith('http') ? textureUrl : `${window.location.origin}${textureUrl}`,
                (img) => {
                  textures[face] = img
                  resolve()
                },
                () => {
                  console.warn(`Failed to load dice texture for player2, face ${face}`)
                  resolve()
                }
              )
            })
          )
        }
      }

      await Promise.all(loadPromises)
      setDiceTexturesPlayer2(textures)
    }

    loadDiceTexturesPlayer2()
  }, [boardSkinPlayer1?.boardTextureUrl, boardSkinPlayer2?.boardTextureUrl, checkerSkinPlayer1?.whiteCheckersTextureUrl, checkerSkinPlayer2?.blackCheckersTextureUrl, diceSkinPlayer1?.diceTextureUrls, diceSkinPlayer2?.diceTextureUrls])

  // Виртуальное состояние доски с учетом локальных ходов (очереди)
  const virtualGameState = useMemo(() => {
    if (!gameState?.points) return gameState
    
    const points = [...gameState.points]
    const bar = { ...(gameState.bar || { white: 0, black: 0 }) }
    const bearOff = { ...(gameState.bearOff || { white: 0, black: 0 }) }
    
    pendingMoves.forEach(move => {
      const applyStep = (m: any) => {
        // 1. Убираем шашку из исходной точки
        if (m.from === 24) bar.white--
        else if (m.from === 25) bar.black--
        else {
          const val = points[m.from]
          if (val > 0) points[m.from]--
          else if (val < 0) points[m.from]++
        }
        
        // 2. Добавляем в целевую точку
        if (m.to === -1) {
          if (isPlayer1) bearOff.white++
          else bearOff.black++
        } else if (m.to >= 0 && m.to < 24) {
          const unit = isPlayer1 ? 1 : -1
          
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

      if ((move as any).steps) {
        (move as any).steps.forEach((s: any) => applyStep(s))
      } else {
        applyStep(move)
      }
    })
    
    return {
      ...gameState,
      points,
      bar,
      bearOff
    }
  }, [gameState, pendingMoves, isPlayer1, gameMode])

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

  // Получение возможных ходов
  useEffect(() => {
    // Проверяем наличие кубиков
    const hasDice = diceKey !== null
    
    if (!gameId || !isMyTurn || !canMove || !hasDice) {
      // Не сбрасываем подсветку если это просто обновление состояния, а не смена хода
      if (!isMyTurn || !canMove) {
        setPossibleMoves([])
        // Не сбрасываем highlightedPoints, так как они не используются для автоматической подсветки
      }
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
        
        const flatMoves = response.data?.movesFromPoint || []
        
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
    
    // Debounce для предотвращения частых запросов (увеличиваем для уменьшения лагов)
    timeoutId = window.setTimeout(() => {
      fetchPossibleMoves()
    }, 300)
    
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [gameId, isMyTurn, canMove, diceKey, pendingMovesKey, pendingMoves]) // pendingMoves нужен для использования в fetchPossibleMoves
  
  // Определение позиции для кубиков
  // Мои кубики на моей части доски, его кубики на его части
  useEffect(() => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    // Для player1 (белые): кубики внизу справа
    // Для player2 (черные): кубики вверху слева
    // Показываем кубики текущего игрока на его части доски
    
    const currentPlayerIsMe = (currentPlayer === 0 && isPlayer1) || (currentPlayer === 1 && !isPlayer1)
    
    // Новая логика: Мои кубики всегда справа, кубики соперника всегда слева
    const xPos = currentPlayerIsMe ? width * 0.85 : width * 0.15;
    const yPos = currentPlayerIsMe ? height * 0.85 : height * 0.15;

    setDice3DPosition({
      x: xPos,
      y: yPos,
      size: Math.min(width, height) * 0.08,
    })
  }, [isPlayer1, currentPlayer, isMyTurn, canMove])
  
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
    
    // Координаты клика не инвертируем, так как доска больше не поворачивается
    const actualX = x
    const actualY = y
    
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
    
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      // Для player2 используем визуальный индекс для вычисления координат (как в getPointCoordinates)
      const visualPointIndex = isPlayer1 ? pointIndex : ((pointIndex + 12) % 24)
      const isTopRow = visualPointIndex < 12
      let columnXStart: number
      let columnXEnd: number
      
      if (isTopRow) {
        const isRightSide = visualPointIndex < 6
        if (isRightSide) {
          const pointInHalf = visualPointIndex
          columnXEnd = boardEndX - pointInHalf * pointWidth
          columnXStart = boardEndX - (pointInHalf + 1) * pointWidth
        } else {
          const pointInHalf = visualPointIndex - 6
          columnXEnd = barX - pointInHalf * pointWidth
          columnXStart = barX - (pointInHalf + 1) * pointWidth
        }
      } else {
        const isLeftSide = visualPointIndex < 18
        if (isLeftSide) {
          const pointInHalf = visualPointIndex - 12
          columnXStart = boardStartX + pointInHalf * pointWidth
          columnXEnd = boardStartX + (pointInHalf + 1) * pointWidth
        } else {
          const pointInHalf = visualPointIndex - 18
          columnXStart = barX + barWidth + pointInHalf * pointWidth
          columnXEnd = barX + barWidth + (pointInHalf + 1) * pointWidth
        }
      }
      
      if (actualX >= columnXStart && actualX <= columnXEnd) {
        if (isTopRow) {
          if (actualY <= height / 2) return pointIndex // Возвращаем реальный индекс
        } else {
          if (actualY > height / 2) return pointIndex // Возвращаем реальный индекс
        }
      }
    }
    
    // Проверяем бар
    if (actualX >= barX && actualX <= barX + barWidth) {
      if (actualY >= height * 0.25 && actualY <= height * 0.75) {
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
    
    return null
  }, [virtualGameState, isPlayer1, gameMode])
  
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
    
    // Левая половина доски (скины противника)
    const opponentBoardSkin = isPlayer1 ? boardSkinPlayer2 : boardSkinPlayer1
    const opponentBoardTexture = isPlayer1 ? boardTexturePlayer2 : boardTexturePlayer1
    const hasCustomOpponentTexture = opponentBoardSkin?.boardTextureUrl && opponentBoardTexture && opponentBoardTexture.complete
    
    if (hasCustomOpponentTexture) {
      try {
        ctx.drawImage(opponentBoardTexture, boardStartX, 0, leftHalfWidth, height)
      } catch (e) {
        console.error('Failed to draw opponent board texture:', e)
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(boardStartX, 0, leftHalfWidth, height)
      }
    } else {
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(boardStartX, 0, leftHalfWidth, height)
    }
    
    // Центральная полоса (бар)
    ctx.fillStyle = '#654321'
    ctx.fillRect(barX, 0, barWidth, height)
    
    // Правая половина доски (свои скины)
    const myBoardSkin = isPlayer1 ? boardSkinPlayer1 : boardSkinPlayer2
    const myBoardTexture = isPlayer1 ? boardTexturePlayer1 : boardTexturePlayer2
    const hasCustomMyTexture = myBoardSkin?.boardTextureUrl && myBoardTexture && myBoardTexture.complete
    
    if (hasCustomMyTexture) {
      try {
        ctx.drawImage(myBoardTexture, rightHalfStartX, 0, rightHalfWidth, height)
      } catch (e) {
        console.error('Failed to draw my board texture:', e)
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(rightHalfStartX, 0, rightHalfWidth, height)
      }
    } else {
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(rightHalfStartX, 0, rightHalfWidth, height)
    }
    
    // Параметры для точек
    const halfBoardWidth = (boardWidth - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    // Вспомогательная функция для отрисовки шашки
    const drawChecker = (cX: number, cY: number, size: number, isWhite: boolean, isMy: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      
      const radius = size / 2
      
      // Используем текстуру если есть, иначе цветной круг
      const texture = isWhite ? whiteCheckerTexture : blackCheckerTexture
      if (texture && texture.complete && (texture.width > 0 || texture.height > 0 || texture.src?.endsWith('.svg'))) {
        // Рисуем текстуру шашки
        ctx.save()
        ctx.beginPath()
        ctx.arc(cX, cY, radius, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(texture, cX - radius, cY - radius, size, size)
        ctx.restore()
        ctx.save()
        ctx.globalAlpha = alpha
      } else {
        // Фолбэк на цветной круг
        // Тень для объема
        ctx.shadowBlur = size * 0.2
        ctx.shadowColor = 'rgba(0,0,0,0.4)'
        ctx.shadowOffsetY = 2
        
        const color = isWhite ? '#F0F0F0' : '#333333'
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cX, cY, radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Внутренний декор шашки
        ctx.beginPath()
        ctx.arc(cX, cY, size * 0.35, 0, Math.PI * 2)
        ctx.strokeStyle = isMy ? (isWhite ? '#DDD' : '#555') : (isWhite ? '#AAA' : '#222')
        ctx.lineWidth = 1
        ctx.stroke()
      }
      
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
    
    // Функция для отрисовки треугольной точки (Классический вид)
    const drawTrianglePoint = (x: number, y: number, w: number, h: number, isTop: boolean, color: string) => {
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
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#5c3a21' // Более темная обводка для контраста
      ctx.lineWidth = 1
      ctx.stroke()
    }
    
    // Рисуем треугольники кодом ТОЛЬКО для дефолтных скинов (без кастомной текстуры)
    // ВСЕГДА рисуем треугольники если нет кастомной текстуры для соответствующей половины
    // Левая половина = противник, правая половина = свои
    const needsTrianglesOpponent = !hasCustomOpponentTexture
    const needsTrianglesMy = !hasCustomMyTexture
    
    if (needsTrianglesOpponent || needsTrianglesMy) {
      // Рисуем 24 треугольника (точки доски)
      for (let pointIndex = 0; pointIndex < 24; pointIndex++) {
        const { x, y, isTopRow, pointWidth: pW, pointHeight: pH, pointNumber } = getPointCoordinates(pointIndex, canvas)
        
        // Определяем, на какой половине доски находится точка
        // Левая = противник, правая = свои (с учетом инверсии для player2)
        const isLeftHalf = x < barX
        const needsTriangle = isLeftHalf ? needsTrianglesOpponent : needsTrianglesMy
        
        if (!needsTriangle) continue // Пропускаем если для этой половины есть кастомная текстура
        
        const triangleWidth = pW * 0.95
        const triangleHeight = pH * 0.95
        
        // Используем визуальный индекс для определения цвета
        // После инверсии координат для player2, isTopRow уже инвертирован, используем его напрямую
        const pointInRow = isTopRow ? pointIndex : pointIndex - 12
        const isLight = pointInRow % 2 === 0
        const triangleColor = isLight ? '#D4A574' : '#8B4513'
        
        // Рисуем сам треугольник
        drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, triangleColor)
        
        // Отрисовка нумерации точек (1-24)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        if (isTopRow) {
          ctx.fillText(pointNumber.toString(), x, y + 15)
        } else {
          ctx.fillText(pointNumber.toString(), x, y - 15)
        }
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
      const isMyPoint = (isPlayer1 && isWhiteChecker) || (!isPlayer1 && !isWhiteChecker)
      
      const checkerSize = Math.min(pW * 0.85, pH * 0.15) 
      const checkerBaseY = isTopRow 
        ? y + checkerSize/2 + 5 
        : y - checkerSize/2 - 5 
      
      const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
      const isAnimatingFromThisPoint = animatingChecker && animatingChecker.from === pointIndex
      const checkersToDraw = (isDraggingFromThisPoint || isAnimatingFromThisPoint) ? checkerCount - 1 : checkerCount
      
      for (let i = 0; i < checkersToDraw; i++) {
        // Если шашек много (больше 5), начинаем их накладывать друг на друга плотнее
        const overlap = checkerCount > 5 ? (checkerSize * 0.8) : checkerSize
        const yOffset = i * overlap
        const checkerY = isTopRow 
          ? checkerBaseY + yOffset 
          : checkerBaseY - yOffset
        
        // Используем текстуры шашек если есть
        drawChecker(x, checkerY, checkerSize, isWhiteChecker, isMyPoint)
      }
      
      // Если шашек больше 5, показываем число на последней шашке
      if (checkerCount > 5 && !isDraggingFromThisPoint && !isAnimatingFromThisPoint) {
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
      const { pointWidth: pW, pointHeight: pH } = getPointCoordinates(dragging.pointIndex, canvas)
      const checkerSize = Math.min(pW * 0.85, pH * 0.15)
      const dragX = dragPosition.x - dragging.offsetX
      const dragY = dragPosition.y - dragging.offsetY
      
      drawChecker(dragX, dragY, checkerSize, isPlayer1, isPlayer1, 0.9)
    }

    // Отрисовка анимируемой шашки
    if (animatingChecker) {
      const { x: fromX, y: fromY, isTopRow: fromTop, pointWidth: pW, pointHeight: pH } = getPointCoordinates(animatingChecker.from, canvas)
      const checkerSize = Math.min(pW * 0.85, pH * 0.15)
      
      let toX, toY, toTop;
      if (animatingChecker.to === -1) {
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

      // Начальная позиция Y (с учетом стопки)
      let fromCheckerCount = 0
      if (animatingChecker.from === 24 || animatingChecker.from === 25) {
        fromCheckerCount = isPlayer1 ? virtualGameState.bar.white : virtualGameState.bar.black
      } else {
        fromCheckerCount = Math.abs(virtualGameState.points[animatingChecker.from])
      }
      
      const fromOverlap = fromCheckerCount > 5 ? (checkerSize * 0.8) : checkerSize
      const startY = fromTop 
        ? fromY + checkerSize/2 + 5 + (fromCheckerCount - 1) * fromOverlap
        : fromY - checkerSize/2 - 5 - (fromCheckerCount - 1) * fromOverlap

      // Конечная позиция Y (куда приземлится)
      let endY;
      if (animatingChecker.to === -1) {
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

      // Определяем цвет шашки по исходной точке
      let fromPointValue = 0
      if (animatingChecker.from === 24 || animatingChecker.from === 25) {
        // Из бара - определяем по игроку
        fromPointValue = isPlayer1 ? 1 : -1
      } else {
        fromPointValue = virtualGameState.points[animatingChecker.from] || 0
      }
      const isWhiteChecker = fromPointValue > 0
      const isMyChecker = (isPlayer1 && isWhiteChecker) || (!isPlayer1 && !isWhiteChecker)
      
      drawChecker(curX, curY, checkerSize, isWhiteChecker, isMyChecker)
    }
    
    // Отрисовка бара
    if (virtualGameState.bar) {
      const bar = virtualGameState.bar
      const whiteBarCount = bar.white || 0
      const blackBarCount = bar.black || 0
      const checkerSize = Math.min(pointWidth * 0.25, pointHeight * 0.3)
      const barX = width / 2
      
      // Белые шашки на баре (положительные значения)
      if (whiteBarCount > 0) {
        const isAnimatingFromWhiteBar = animatingChecker && animatingChecker.from === 24
        const countToDraw = isAnimatingFromWhiteBar ? whiteBarCount - 1 : whiteBarCount
        const barStartY = height - pointHeight * 0.3
        const isMyBar = isPlayer1
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY - (i * checkerSize * 0.6)
          drawChecker(barX - 25, barY, checkerSize, true, isMyBar)
        }
      }
      
      // Черные шашки на баре (отрицательные значения)
      if (blackBarCount > 0) {
        const isAnimatingFromBlackBar = animatingChecker && animatingChecker.from === 25
        const countToDraw = isAnimatingFromBlackBar ? blackBarCount - 1 : blackBarCount
        const barStartY = pointHeight * 0.3
        const isMyBar = !isPlayer1
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY + (i * checkerSize * 0.6)
          drawChecker(barX + 25, barY, checkerSize, false, isMyBar)
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
    
    for (let i = 0; i < 24; i++) {
      const { x, y, isTopRow, pointNumber } = getPointCoordinates(i, canvas)
      
      // Определяем номер точки относительно игрока
      // Для игрока его дом всегда 1-6
      let displayNum = pointNumber
      
      // Если доска инвертирована для Player 2, номера тоже должны быть инвертированы
      // Но пользователь хочет систему "координаты ячеек": на моей стороне 1 2 3...
      // В классических нардах у каждого игрока своя нумерация от 1 до 24
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      const textY = isTopRow ? y + pointHeight + 15 : y - pointHeight - 15
      ctx.fillText(displayNum.toString(), x, textY)
    }
    if (virtualGameState.bearOff) {
      const bOff = virtualGameState.bearOff
      const whiteBearOffCount = bOff.white || 0
      const blackBearOffCount = bOff.black || 0
      
      const checkerH = Math.min(height / 16, 15)
      const checkerW = bearOffWidth * 0.8
      
      // Белые выброшенные шашки (снизу вверх, справа для player1, слева для player2 после инверсии)
      const whiteX = isPlayer1 ? rightContainerX : leftContainerX
      for (let i = 0; i < whiteBearOffCount; i++) {
        ctx.fillStyle = '#F0F0F0'
        ctx.fillRect(whiteX + (bearOffWidth - checkerW) / 2, height - 10 - (i * (checkerH + 2)), checkerW, checkerH)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(whiteX + (bearOffWidth - checkerW) / 2, height - 10 - (i * (checkerH + 2)), checkerW, checkerH)
      }
      
      // Черные выброшенные шашки (сверху вниз, слева для player1, справа для player2 после инверсии)
      const blackX = isPlayer1 ? leftContainerX : rightContainerX
      for (let i = 0; i < blackBearOffCount; i++) {
        ctx.fillStyle = '#333333'
        ctx.fillRect(blackX + (bearOffWidth - checkerW) / 2, 10 + (i * (checkerH + 2)), checkerW, checkerH)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(blackX + (bearOffWidth - checkerW) / 2, 10 + (i * (checkerH + 2)), checkerW, checkerH)
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
  }, [virtualGameState, selectedPoint, isPlayer1, dragging, dragPosition, hoveredPoint, validTargetPoints, gameMode, getPointCoordinates, animatingChecker, boardTexturePlayer1, boardTexturePlayer2, whiteCheckerTexture, blackCheckerTexture, currentPlayer])
  
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
    const duration = 300 // мс

    const animate = (time: number) => {
      const elapsed = time - animatingChecker.startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress < 1) {
        setAnimatingChecker(prev => prev ? { ...prev, progress } : null)
        animationFrame = requestAnimationFrame(animate)
      } else {
        // Анимация завершена - сначала сбрасываем выбор, потом вызываем onMove
        setSelectedPoint(null)
        setValidTargetPoints(new Set())
        setShowBearOffButton(null)
        onMove(animatingChecker.from, animatingChecker.to, animatingChecker.die, animatingChecker.steps)
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
  
  // Обработка двойного клика (быстрый ход) - явная обработка
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    // Устанавливаем флаг, что это двойной клик
    isDoubleClickRef.current = true
    
    // Отменяем таймаут одинарного клика
    if (doubleClickTimeoutRef.current !== null) {
      window.clearTimeout(doubleClickTimeoutRef.current)
      doubleClickTimeoutRef.current = null
    }
    
    // Очищаем информацию о последнем клике
    lastClickRef.current = null
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    if (pointIndex === null) {
      isDoubleClickRef.current = false
      return
    }
    
    // Ищем возможные ходы для этой точки
    const moves = possibleMoves.filter(m => m.from === pointIndex)
    if (moves.length === 0) {
      isDoubleClickRef.current = false
      return
    }
    
    // Приоритет хода для двойного клика:
    // 1. Если есть ход на вынос (bearing off) - делаем его
    // 2. Если есть несколько ходов, берем тот, что использует большую кость (обычно выгоднее)
    // 3. Если есть комбинированный ход (steps) - приоритет ему
    // 4. Иначе берем первый доступный
    
    let bestMove = moves.find(m => m.to === -1) // Bearing off
    
    if (!bestMove) {
      // Ищем комбинированные ходы (с steps)
      const combinedMoves = moves.filter(m => (m as any).steps && (m as any).steps.length > 1)
      if (combinedMoves.length > 0) {
        // Сортируем комбинированные ходы по сумме кубиков (по убыванию)
        const sortedCombined = [...combinedMoves].sort((a, b) => {
          const aSum = (a as any).steps?.reduce((sum: number, s: any) => sum + s.die, 0) || a.die
          const bSum = (b as any).steps?.reduce((sum: number, s: any) => sum + s.die, 0) || b.die
          return bSum - aSum
        })
        bestMove = sortedCombined[0]
      } else {
        // Сортируем по значению кубика (по убыванию), чтобы использовать больший кубик
        const sortedMoves = [...moves].sort((a, b) => b.die - a.die)
        bestMove = sortedMoves[0]
      }
    }
    
    if (bestMove) {
      // Выполняем быстрый ход
      startMoveAnimation(bestMove.from, bestMove.to, bestMove.die, (bestMove as any).steps)
    }
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      isDoubleClickRef.current = false
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
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    // Предотвращаем прокрутку страницы при перетаскивании шашки
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      
      const pointIndex = getPointAtPosition(x, y, canvas)
      if (pointIndex !== null) {
        // Проверяем, есть ли шашки на этой точке
        const points = gameState?.points || []
        let pointValue = 0
        if (pointIndex === 24 || pointIndex === 25) {
          const bar = gameState?.bar || { white: 0, black: 0 }
          pointValue = (pointIndex === 24 && isPlayer1) || (pointIndex === 25 && !isPlayer1) 
            ? (isPlayer1 ? bar.white : bar.black)
            : 0
        } else if (pointIndex >= 0 && pointIndex < points.length) {
          pointValue = points[pointIndex]
        }
        
        const isMyChecker = isPlayer1 ? pointValue > 0 : pointValue < 0
        const isMyBar = (pointIndex === 24 && isPlayer1) || (pointIndex === 25 && !isPlayer1)
        
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
    if (!dragging || !canvasRef.current) return
    
    // Предотвращаем прокрутку, zoom и другие стандартные жесты
    if (e.cancelable) {
      e.preventDefault()
    }
    e.stopPropagation()
    
    // Если множественное касание - прерываем перетаскивание
    if (e.touches.length > 1) {
      setDragging(null)
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      return
    }
    
    const touch = e.touches[0]
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    
    setDragPosition({ x, y })
    const hovered = getPointAtPosition(x, y, canvas)
    setHoveredPoint(hovered)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Предотвращаем стандартное поведение
    if (e.cancelable) {
      e.preventDefault()
    }
    e.stopPropagation()
    if (!dragging || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    // У TouchEnd нет координат в e.touches, используем последнюю позицию dragPosition
    if (dragPosition) {
      const x = dragPosition.x
      const y = dragPosition.y
      
      const targetPoint = getPointAtPosition(x, y, canvas)
      
      if (targetPoint !== null && dragging.pointIndex !== targetPoint) {
        if (targetPoint === -1) {
          const bearOffMove = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === -1)
          if (bearOffMove) {
            startMoveAnimation(bearOffMove.from, bearOffMove.to, bearOffMove.die, (bearOffMove as any).steps)
            return // startMoveAnimation сам все сбросит
          }
        } else if (validTargetPoints.has(targetPoint)) {
          const move = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === targetPoint)
          if (move) {
            startMoveAnimation(move.from, move.to, move.die, (move as any).steps)
            return // startMoveAnimation сам все сбросит
          }
        }
      }
    }
    
    setDragging(null)
    setDragPosition(null)
    setSelectedPoint(null)
    setHoveredPoint(null)
    setValidTargetPoints(new Set())
  }

  // Обработка начала перетаскивания
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // console.log('MouseDown', { canMove, isMyTurn, dragging })
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    // console.log('Clicked at', x, y, 'Point:', pointIndex)
    
    if (pointIndex === null) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }
    
    // Используем virtualGameState для проверки наличия шашки с учетом уже сделанных ходов
    const points = virtualGameState?.points || []
    let pointValue = 0
    
    if (pointIndex === 24 || pointIndex === 25) {
      const bar = virtualGameState?.bar || { white: 0, black: 0 }
      pointValue = (pointIndex === 24 && isPlayer1) || (pointIndex === 25 && !isPlayer1) 
        ? (isPlayer1 ? bar.white : bar.black)
        : 0
    } else if (pointIndex >= 0 && pointIndex < points.length) {
      pointValue = points[pointIndex]
    }
    
    if (pointValue === 0) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }
    
    // Проверяем, моя ли это шашка
    const isMyChecker = isPlayer1 ? pointValue > 0 : pointValue < 0
    const isMyBar = (pointIndex === 24 && isPlayer1) || (pointIndex === 25 && !isPlayer1)
    
    if (!isMyChecker && !isMyBar) {
      setSelectedPoint(null)
      setValidTargetPoints(new Set())
      setShowBearOffButton(null)
      return
    }
    
    // Разрешаем захватить шашку, даже если нет ходов, для визуального отклика
    // Но подсветим цели только если ходы есть
    const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
    
    const { x: pointX, y: pointY } = getPointCoordinates(pointIndex, canvas)
    
    // Начинаем перетаскивание
    setDragging({ pointIndex, offsetX: x - pointX, offsetY: y - pointY })
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
    if (!dragging || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const targetPoint = getPointAtPosition(x, y, canvas)
    
    if (targetPoint !== null && dragging.pointIndex !== targetPoint) {
      if (targetPoint === -1) {
        const bearOffMove = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === -1)
          if (bearOffMove) {
            startMoveAnimation(bearOffMove.from, bearOffMove.to, bearOffMove.die, bearOffMove.steps)
            return
          }
        } else if (validTargetPoints.has(targetPoint)) {
          const move = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === targetPoint)
          if (move) {
            startMoveAnimation(move.from, move.to, move.die, move.steps)
            return
          }
        }
    }
    
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
    
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    // Если это двойной клик, игнорируем одинарный клик
    if (isDoubleClickRef.current) {
      isDoubleClickRef.current = false
      return
    }
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    if (pointIndex === null) return
    
    // Проверяем, был ли это двойной клик на той же точке
    const now = Date.now()
    const DOUBLE_CLICK_DELAY = 300 // мс
    const lastClick = lastClickRef.current
    
    if (lastClick && 
        lastClick.pointIndex === pointIndex && 
        (now - lastClick.timestamp) < DOUBLE_CLICK_DELAY) {
      // Это потенциальный двойной клик - отменяем таймаут и не обрабатываем одинарный клик
      if (doubleClickTimeoutRef.current !== null) {
        window.clearTimeout(doubleClickTimeoutRef.current)
        doubleClickTimeoutRef.current = null
      }
      lastClickRef.current = null
      return
    }
    
    // Сохраняем информацию о клике
    lastClickRef.current = { pointIndex, timestamp: now }
    
    // Устанавливаем таймаут для обработки одинарного клика
    if (doubleClickTimeoutRef.current !== null) {
      window.clearTimeout(doubleClickTimeoutRef.current)
    }
    
    doubleClickTimeoutRef.current = window.setTimeout(() => {
      // Если таймаут истек, значит это был одинарный клик
      if (lastClickRef.current && lastClickRef.current.pointIndex === pointIndex) {
        handlePointClick(pointIndex)
        lastClickRef.current = null
      }
      doubleClickTimeoutRef.current = null
    }, DOUBLE_CLICK_DELAY)
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

    // Проверяем, есть ли ходы из этой точки
    const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
    
    if (selectedPoint === null) {
      // Если ничего не выбрано, выбираем текущую точку (если из неё есть ходы)
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
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
      
      {/* Кубики - скрываем если все использованы (после подтверждения хода) */}
      {diceArray && diceArray.length > 0 && dice3DPosition && usedDiceIndices.size < diceArray.length && (
        <div
          style={{
            position: 'absolute',
            left: `${dice3DPosition.x - dice3DPosition.size}px`,
            top: `${dice3DPosition.y - dice3DPosition.size / 2}px`,
            width: `${dice3DPosition.size * 2.5 * diceArray.length}px`,
            height: `${dice3DPosition.size}px`,
            pointerEvents: 'none',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          {diceArray.map((dieValue, index) => {
            const isUsed = usedDiceIndices.has(index)
            const isDoubles = diceArray.length >= 2 && diceArray.every(d => d === diceArray[0])
            
            // Не показываем использованные кубики
            if (isUsed) return null
            
            return (
              <div
                key={index}
                style={{
                  position: 'relative',
                }}
              >
                <Dice3D
                  values={[dieValue]}
                  animating={diceAnimating}
                  diceTextures={currentPlayer === 0 ? diceTexturesPlayer1 : diceTexturesPlayer2}
                />
                {/* Показываем сколько ходов осталось при дубле на каждом неиспользованном кубике */}
                {isDoubles && remainingMoves > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(255, 0, 0, 0.8)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      zIndex: 10,
                    }}
                  >
                    {remainingMoves}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
