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
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
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
  
  const isPlayer1 = myPlayerId === player1Id

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
        setHighlightedPoints(new Set())
      }
      return
    }
    
    let timeoutId: NodeJS.Timeout | null = null
    
    const fetchPossibleMoves = async () => {
      try {
        // Теперь отправляем pendingMoves на сервер, чтобы получить актуальные варианты
        const response = await apiClient.post(`/games/${gameId}/possible-moves`, { 
          pendingMoves 
        })
        const flatMoves = response.data?.movesFromPoint || []
        const highlighted = new Set<number>()
        
        flatMoves.forEach((move: any) => {
          if (move.from !== undefined && move.from !== null && move.from !== -1) {
            highlighted.add(move.from)
          }
        })
        
        setPossibleMoves(flatMoves)
        setHighlightedPoints(highlighted)
      } catch (error) {
        console.error('Ошибка получения возможных ходов:', error)
        setPossibleMoves([])
        setHighlightedPoints(new Set())
      }
    }
    
    // Debounce для предотвращения частых запросов
    timeoutId = setTimeout(() => {
      fetchPossibleMoves()
    }, 100)
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [gameId, isMyTurn, canMove, diceKey, pendingMovesKey]) // Используем стабилизированные ключи
  
  // Определение позиции для кубиков
  useEffect(() => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    const isMyTurnNow = isMyTurn && canMove
    
    if (isMyTurnNow) {
      setDice3DPosition({
        x: width * 0.25,
        y: height * 0.5,
        size: Math.min(width, height) * 0.08,
      })
    } else {
      setDice3DPosition({
        x: width * 0.75,
        y: height * 0.5,
        size: Math.min(width, height) * 0.08,
      })
    }
  }, [isMyTurn, canMove])
  
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
    
    const y = isTopRow ? 0 : height
    
    return { x, y, isTopRow, pointWidth, pointHeight, pointNumber }
  }, [])
  
  // Функция для определения точки по координатам
  const getPointAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement): number | null => {
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
    
    // Проверяем все точки
    const points = gameState?.points || []
    
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const isTopRow = pointIndex < 12
      let columnXStart: number
      let columnXEnd: number
      
      if (isTopRow) {
        const isRightSide = pointIndex < 6
        if (isRightSide) {
          const pointInHalf = pointIndex
          columnXEnd = boardEndX - pointInHalf * pointWidth
          columnXStart = boardEndX - (pointInHalf + 1) * pointWidth
        } else {
          const pointInHalf = pointIndex - 6
          columnXEnd = barX - pointInHalf * pointWidth
          columnXStart = barX - (pointInHalf + 1) * pointWidth
        }
      } else {
        const isLeftSide = pointIndex < 18
        if (isLeftSide) {
          const pointInHalf = pointIndex - 12
          columnXStart = boardStartX + pointInHalf * pointWidth
          columnXEnd = boardStartX + (pointInHalf + 1) * pointWidth
        } else {
          const pointInHalf = pointIndex - 18
          columnXStart = barX + barWidth + pointInHalf * pointWidth
          columnXEnd = barX + barWidth + (pointInHalf + 1) * pointWidth
        }
      }
      
      if (x >= columnXStart && x <= columnXEnd) {
        if (isTopRow) {
          if (y <= height / 2) return pointIndex
        } else {
          if (y > height / 2) return pointIndex
        }
      }
    }
    
    // Проверяем бар
    if (x >= barX && x <= barX + barWidth) {
      if (y >= height * 0.25 && y <= height * 0.75) {
        return isPlayer1 ? 24 : 25
      }
    }
    
    // Проверяем контейнеры
    const leftContainerX = 0
    const rightContainerX = width - bearOffWidth
    const isLeftTarget = x >= leftContainerX && x <= leftContainerX + bearOffWidth
    const isRightTarget = x >= rightContainerX && x <= rightContainerX + bearOffWidth
    
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
    
    // Параметры области выноса (Контейнеры)
    const bearOffWidth = width * 0.06
    const boardWidth = width - (bearOffWidth * 2)
    const boardStartX = bearOffWidth
    
    // Фон доски
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(boardStartX, 0, boardWidth, height)
    
    // Центральная полоса (бар)
    const barWidth = boardWidth * 0.08
    const barX = boardStartX + (boardWidth - barWidth) / 2
    ctx.fillStyle = '#654321'
    ctx.fillRect(barX, 0, barWidth, height)
    
    // Параметры для точек
    const halfBoardWidth = (boardWidth - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    // Вспомогательная функция для отрисовки шашки
    const drawChecker = (cX: number, cY: number, size: number, color: string, isMy: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      
      // Тень для объема
      ctx.shadowBlur = size * 0.2
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowOffsetY = 2
      
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cX, cY, size / 2, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = isMy ? '#999' : '#000'
      ctx.lineWidth = 1.5
      ctx.stroke()
      
      // Внутренний декор шашки
      ctx.beginPath()
      ctx.arc(cX, cY, size * 0.35, 0, Math.PI * 2)
      ctx.strokeStyle = isMy ? '#DDD' : '#555'
      ctx.stroke()
      
      ctx.restore()
    }

    const points = virtualGameState.points || []
    
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
    
    // Сначала рисуем все треугольники и их подсветку
    points.forEach((_value: number, pointIndex: number) => {
      const { x, y, isTopRow, pointWidth: pW, pointHeight: pH, pointNumber } = getPointCoordinates(pointIndex, canvas)
      
      const triangleWidth = pW * 0.95
      const triangleHeight = pH * 0.95
      
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      const isLight = pointInRow % 2 === 0
      const triangleColor = isLight ? '#D4A574' : '#8B4513'
      
      // 1. Подсветка точки под курсором (самый нижний слой подсветки)
      if (hoveredPoint === pointIndex) {
        ctx.fillStyle = dragging ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        if (isTopRow) {
          ctx.fillRect(x - pW / 2, 0, pW, height / 2)
        } else {
          ctx.fillRect(x - pW / 2, height / 2, pW, height / 2)
        }
      }

      // 2. Подсветка возможных исходных точек (только после выбора шашки)
      if (!dragging && selectedPoint !== null && highlightedPoints.has(pointIndex)) {
        ctx.save()
        ctx.shadowBlur = 15
        ctx.shadowColor = 'rgba(0, 255, 0, 0.8)'
        drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, triangleColor)
        ctx.restore()
      }

      // 3. Подсветка валидных точек назначения при перетаскивании ИЛИ выборе точки
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
      
      // 4. Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.3)'
        if (isTopRow) {
          ctx.fillRect(x - pW / 2, 0, pW, height / 2)
        } else {
          ctx.fillRect(x - pW / 2, height / 2, pW, height / 2)
        }
      }
      
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
    })

    // Вторым проходом рисуем все шашки (чтобы они были поверх всех треугольников)
    points.forEach((pointValue: number, pointIndex: number) => {
      if (pointValue === 0) return
      
      const { x, y, isTopRow, pointWidth: pW, pointHeight: pH } = getPointCoordinates(pointIndex, canvas)
      const checkerCount = Math.abs(pointValue)
      const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
      
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
        
        drawChecker(x, checkerY, checkerSize, isMyPoint ? '#F0F0F0' : '#333333', isMyPoint)
      }
      
      // Если шашек больше 5, показываем число на последней шашке
      if (checkerCount > 5 && !isDraggingFromThisPoint && !isAnimatingFromThisPoint) {
        const overlap = checkerSize * 0.8
        const lastCheckerY = isTopRow 
          ? checkerBaseY + ((checkerCount - 1) * overlap)
          : checkerBaseY - ((checkerCount - 1) * overlap)
          
        ctx.fillStyle = isMyPoint ? '#000' : '#FFF'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(checkerCount.toString(), x, lastCheckerY)
      }
    })
    
    // Отрисовка перетаскиваемой шашки (самый верхний слой)
    if (dragging && dragPosition) {
      const { pointWidth: pW, pointHeight: pH } = getPointCoordinates(dragging.pointIndex, canvas)
      const checkerSize = Math.min(pW * 0.85, pH * 0.15)
      const dragX = dragPosition.x - dragging.offsetX
      const dragY = dragPosition.y - dragging.offsetY
      
      drawChecker(dragX, dragY, checkerSize, isPlayer1 ? '#F0F0F0' : '#333333', isPlayer1, 0.9)
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

      drawChecker(curX, curY, checkerSize, isPlayer1 ? '#F0F0F0' : '#333333', isPlayer1)
    }
    
    // Отрисовка бара
    if (virtualGameState.bar) {
      const bar = virtualGameState.bar
      const myBarCount = isPlayer1 ? bar.white || 0 : bar.black || 0
      const opponentBarCount = isPlayer1 ? bar.black || 0 : bar.white || 0
      const checkerSize = Math.min(pointWidth * 0.25, pointHeight * 0.3)
      const barX = width / 2
      
      if (myBarCount > 0) {
        const isAnimatingFromMyBar = animatingChecker && animatingChecker.from === (isPlayer1 ? 24 : 25)
        const countToDraw = isAnimatingFromMyBar ? myBarCount - 1 : myBarCount
        const barStartY = height - pointHeight * 0.3
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY - (i * checkerSize * 0.6)
          drawChecker(barX - 25, barY, checkerSize, '#FFFFFF', true)
        }
      }
      
      if (opponentBarCount > 0) {
        const isAnimatingFromOpponentBar = animatingChecker && animatingChecker.from === (isPlayer1 ? 25 : 24)
        const countToDraw = isAnimatingFromOpponentBar ? opponentBarCount - 1 : opponentBarCount
        const barStartY = pointHeight * 0.3
        for (let i = 0; i < countToDraw; i++) {
          const barY = barStartY + (i * checkerSize * 0.6)
          drawChecker(barX + 25, barY, checkerSize, '#000000', false)
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

    // Отрисовка выброшенных шашек в контейнерах
    if (virtualGameState.bearOff) {
      const bOff = virtualGameState.bearOff
      const myBearOffCount = isPlayer1 ? bOff.white || 0 : bOff.black || 0
      const opponentBearOffCount = isPlayer1 ? bOff.black || 0 : bOff.white || 0
      
      const checkerH = Math.min(height / 16, 15)
      const checkerW = bearOffWidth * 0.8
      
      // Мои выброшенные (снизу вверх)
      const myX = isPlayer1 ? rightContainerX : (gameMode === 'long' ? leftContainerX : rightContainerX)
      for (let i = 0; i < myBearOffCount; i++) {
        ctx.fillStyle = isPlayer1 ? '#F0F0F0' : '#333333'
        ctx.fillRect(myX + (bearOffWidth - checkerW) / 2, height - 10 - (i * (checkerH + 2)), checkerW, checkerH)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(myX + (bearOffWidth - checkerW) / 2, height - 10 - (i * (checkerH + 2)), checkerW, checkerH)
      }
      
      // Соперника выброшенные (сверху вниз)
      const oppX = isPlayer1 ? (gameMode === 'long' ? leftContainerX : rightContainerX) : rightContainerX
      for (let i = 0; i < opponentBearOffCount; i++) {
        ctx.fillStyle = isPlayer1 ? '#333333' : '#F0F0F0'
        ctx.fillRect(oppX + (bearOffWidth - checkerW) / 2, 10 + (i * (checkerH + 2)), checkerW, checkerH)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(oppX + (bearOffWidth - checkerW) / 2, 10 + (i * (checkerH + 2)), checkerW, checkerH)
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
  }, [virtualGameState, selectedPoint, highlightedPoints, isPlayer1, dragging, dragPosition, hoveredPoint, validTargetPoints, gameMode, getPointCoordinates, animatingChecker])
  
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
        // Анимация завершена
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
  
  // Обработка двойного клика (быстрый ход)
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // console.log('Double Click')
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    if (pointIndex === null) return
    
    // Ищем возможные ходы для этой точки
    const moves = possibleMoves.filter(m => m.from === pointIndex)
    if (moves.length === 0) return
    
    // Приоритет хода:
    // 1. Если есть ход на вынос (bearing off) - делаем его
    // 2. Если есть несколько ходов, берем тот, что использует большую кость (обычно выгоднее)
    // 3. Иначе берем первый доступный
    
    let bestMove = moves.find(m => m.to === -1) // Bearing off
    
    if (!bestMove) {
      // Сортируем по значению кубика (по убыванию), чтобы использовать больший кубик
      const sortedMoves = [...moves].sort((a, b) => b.die - a.die)
      bestMove = sortedMoves[0]
    }
    
    if (bestMove) {
      // console.log('Fast move:', bestMove)
      startMoveAnimation(bestMove.from, bestMove.to, bestMove.die, (bestMove as any).steps)
    }
  }

  // Обработка начала касания (мобильные устройства)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Предотвращаем конфликт с Telegram приложением
    e.stopPropagation()
    if (e.cancelable) e.preventDefault()
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
    
    // Предотвращаем прокрутку
    if (e.cancelable) e.preventDefault()
    
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
            startMoveAnimation(bearOffMove.from, bearOffMove.to, bearOffMove.die)
            return // startMoveAnimation сам все сбросит
          }
        } else if (validTargetPoints.has(targetPoint)) {
          const move = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === targetPoint)
          if (move) {
            startMoveAnimation(move.from, move.to, move.die)
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
    // Мы НЕ сбрасываем selectedPoint здесь, чтобы можно было увидеть кнопку "Сбросить" после перетаскивания
    // Но нам нужно обновить showBearOffButton если мы отпустили шашку на том же месте
    const bearOffMove = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === -1)
    if (bearOffMove) {
      setShowBearOffButton({ pointIndex: dragging.pointIndex, die: bearOffMove.die })
    }
    
    setHoveredPoint(null)
    // setValidTargetPoints(new Set()) // Тоже не сбрасываем для select-эффекта
  }
  
  // Обработка клика
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) return
    
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
    if (pointIndex !== null) {
      handlePointClick(pointIndex)
    }
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
          pointMoves.forEach(m => {
            targets.add(m.to)
            if (m.to === -1) bearOffDie = m.die
          })
          setValidTargetPoints(targets)
          if (bearOffDie !== null) {
            setShowBearOffButton({ pointIndex, die: bearOffDie })
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
      
      {/* Кубики */}
      {diceArray && diceArray.length > 0 && dice3DPosition && (
        <div
          style={{
            position: 'absolute',
            left: `${dice3DPosition.x - dice3DPosition.size}px`,
            top: `${dice3DPosition.y - dice3DPosition.size / 2}px`,
            width: `${dice3DPosition.size * 2.5}px`,
            height: `${dice3DPosition.size}px`,
            pointerEvents: 'none',
          }}
        >
          <Dice3D
            values={diceArray}
            animating={diceAnimating}
            diceTextures={undefined}
          />
        </div>
      )}
    </div>
  )
}
