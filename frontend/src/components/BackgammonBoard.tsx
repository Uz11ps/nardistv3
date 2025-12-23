import { useEffect, useRef, useState, useCallback } from 'react'
import { apiClient } from '../api/client'
import Dice3D from './Dice3D'
import './BackgammonBoard.css'

interface BackgammonBoardProps {
  gameState: any
  currentPlayer: number
  dice: { die1: number; die2: number } | number[] | null
  onMove: (from: number, to: number, die: number) => void
  onRollDice: () => void
  canMove: boolean
  isMyTurn: boolean
  gameId?: string
  gameMode?: 'short' | 'long'
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
  diceAnimating = false,
  myPlayerId,
  player1Id,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number }>>([])
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())
  const [dice3DPosition, setDice3DPosition] = useState<{ x: number; y: number; size: number } | null>(null)
  const [dragging, setDragging] = useState<{ pointIndex: number; offsetX: number; offsetY: number } | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [validTargetPoints, setValidTargetPoints] = useState<Set<number>>(new Set())
  
  const isPlayer1 = myPlayerId === player1Id
  
  // Получение возможных ходов
  useEffect(() => {
    if (!gameId || !isMyTurn || !canMove || !dice) return
    
    const fetchPossibleMoves = async () => {
      try {
        const response = await apiClient.get(`/games/${gameId}/possible-moves`)
        const allMoves = response.data?.allMoves || []
        const movesSet = new Set<string>()
        const flatMoves: Array<{ from: number; to: number; die: number }> = []
        
        allMoves.forEach((moveSeq: Array<{ from: number; to: number; die: number }>) => {
          moveSeq.forEach((move) => {
            const key = `${move.from}-${move.to}-${move.die}`
            if (!movesSet.has(key)) {
              movesSet.add(key)
              flatMoves.push(move)
            }
          })
        })
        
        setPossibleMoves(flatMoves)
        
        const highlighted = new Set<number>()
        flatMoves.forEach((move: any) => {
          if (move.from !== undefined && move.from !== null) highlighted.add(move.from)
          if (move.to !== undefined && move.to !== null && move.to >= 0 && move.to < 24) highlighted.add(move.to)
        })
        setHighlightedPoints(highlighted)
      } catch (error) {
        console.error('Ошибка получения возможных ходов:', error)
        setPossibleMoves([])
        setHighlightedPoints(new Set())
      }
    }
    
    fetchPossibleMoves()
  }, [gameId, isMyTurn, canMove, dice, gameState])
  
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
    
    // Ширина бара в центре
    const barWidth = width * 0.08 // Чуть шире бар для наглядности
    const barX = (width - barWidth) / 2
    
    // Доступная ширина для одной половины (левой или правой)
    const halfBoardWidth = (width - barWidth) / 2
    
    // Ширина одного треугольника (в одной половине 6 треугольников)
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45 // Высота чуть меньше половины, чтобы в центре было место
    
    const isTopRow = pointIndex < 12
    
    // Система нумерации нард:
    // Index 0 = Point 24 (Top Right)
    // Index 11 = Point 13 (Top Left)
    // Index 12 = Point 12 (Bottom Left)
    // Index 23 = Point 1 (Bottom Right)
    
    let x: number
    let pointNumber: number
    
    // Определяем, в какой половине находится точка
    // Верхний ряд: 0-5 (справа), 6-11 (слева)
    // Нижний ряд: 12-17 (слева), 18-23 (справа)
    
    if (isTopRow) {
      // Верхний ряд: Points 24-13 (справа налево)
      pointNumber = 24 - pointIndex
      const isRightSide = pointIndex < 6 // 0-5 -> Правая часть
      
      if (isRightSide) {
        // Правая часть (от края до бара): индексы 0-5
        const pointInHalf = pointIndex
        // Справа налево: width - (отступ)
        x = width - (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        // Левая часть (от бара до края): индексы 6-11
        const pointInHalf = pointIndex - 6
        // Справа налево от левого края бара: barX - (отступ)
        x = barX - (pointInHalf * pointWidth + pointWidth / 2)
      }
    } else {
      // Нижний ряд: Points 12-1 (слева направо)
      pointNumber = 12 - (pointIndex - 12)
      const isLeftSide = pointIndex < 18 // 12-17 -> Левая часть
      
      if (isLeftSide) {
        // Левая часть (от края до бара): индексы 12-17
        const pointInHalf = pointIndex - 12
        // Слева направо: 0 + (отступ)
        x = (pointInHalf * pointWidth + pointWidth / 2)
      } else {
        // Правая часть (от бара до края): индексы 18-23
        const pointInHalf = pointIndex - 18
        // Слева направо от правого края бара: barX + barWidth + (отступ)
        x = barX + barWidth + (pointInHalf * pointWidth + pointWidth / 2)
      }
    }
    
    // Основания треугольников прижаты к краям доски
    const y = isTopRow
      ? 0      // Верхний край
      : height // Нижний край
    
    return { x, y, isTopRow, pointWidth, pointHeight, pointNumber }
  }, [])
  
  // Функция для определения точки по координатам
  const getPointAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement): number | null => {
    const width = canvas.width
    const height = canvas.height
    
    // Пересчитываем параметры, как в drawBoard
    const barWidth = width * 0.08
    const barX = (width - barWidth) / 2
    const halfBoardWidth = (width - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    // Проверяем все точки
    const points = gameState?.points || []
    
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const isTopRow = pointIndex < 12
      
      let columnXStart: number
      let columnXEnd: number
      
      // Определяем X-границы колонки для этой точки
      if (isTopRow) {
        // Верхний ряд: 0-5 (справа), 6-11 (слева)
        const isRightSide = pointIndex < 6
        if (isRightSide) {
          // Правая часть
          const pointInHalf = pointIndex
          // x центра = width - (pointInHalf * pointWidth + pointWidth / 2)
          // Границы: от (width - (pointInHalf + 1) * pointWidth) до (width - pointInHalf * pointWidth)
          columnXEnd = width - pointInHalf * pointWidth
          columnXStart = width - (pointInHalf + 1) * pointWidth
        } else {
          // Левая часть
          const pointInHalf = pointIndex - 6
          // x центра = barX - (pointInHalf * pointWidth + pointWidth / 2)
          // Границы: от (barX - (pointInHalf + 1) * pointWidth) до (barX - pointInHalf * pointWidth)
          columnXEnd = barX - pointInHalf * pointWidth
          columnXStart = barX - (pointInHalf + 1) * pointWidth
        }
      } else {
        // Нижний ряд: 12-17 (слева), 18-23 (справа)
        const isLeftSide = pointIndex < 18
        if (isLeftSide) {
          // Левая часть
          const pointInHalf = pointIndex - 12
          // x центра = (pointInHalf * pointWidth + pointWidth / 2)
          columnXStart = pointInHalf * pointWidth
          columnXEnd = (pointInHalf + 1) * pointWidth
        } else {
          // Правая часть
          const pointInHalf = pointIndex - 18
          // x центра = barX + barWidth + (pointInHalf * pointWidth + pointWidth / 2)
          columnXStart = barX + barWidth + pointInHalf * pointWidth
          columnXEnd = barX + barWidth + (pointInHalf + 1) * pointWidth
        }
      }
      
      // Проверяем X
      if (x >= columnXStart && x <= columnXEnd) {
        // Проверяем Y (расширенная зона: вся половина высоты доски)
        if (isTopRow) {
          if (y <= height / 2) return pointIndex
        } else {
          if (y > height / 2) return pointIndex
        }
      }
    }
    
    // Проверяем бар
    const barCheckWidth = pointWidth * 0.8
    if (Math.abs(x - (barX + barWidth / 2)) < barCheckWidth / 2) {
      if (y >= height * 0.25 && y <= height * 0.75) {
        return isPlayer1 ? 24 : 25
      }
    }
    
    // Проверяем область выноса
    const bearOffMargin = pointWidth * 1.5
    
    if (gameMode === 'long') {
      if (isPlayer1 && x < bearOffMargin && y > height - pointHeight && y < height) {
        return -1
      } else if (!isPlayer1 && x > width - bearOffMargin && y > 0 && y < pointHeight) {
        return -1
      }
    } else {
      if (isPlayer1 && x > width - bearOffMargin && y > 0 && y < pointHeight) {
        return -1
      } else if (!isPlayer1 && x < bearOffMargin && y > height - pointHeight && y < height) {
        return -1
      }
    }
    
    return null
  }, [gameState, isPlayer1, gameMode])
  
  // Отрисовка доски
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx || !gameState) return
    
    const width = canvas.width
    const height = canvas.height
    
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    
    // Фон доски
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(0, 0, width, height)
    
    // Центральная полоса (бар)
    const barWidth = width * 0.08
    const barX = (width - barWidth) / 2
    ctx.fillStyle = '#654321'
    ctx.fillRect(barX, 0, barWidth, height)
    
    // Параметры для отрисовки
    const halfBoardWidth = (width - barWidth) / 2
    const pointWidth = halfBoardWidth / 6
    const pointHeight = height * 0.45
    
    const points = gameState.points || []
    
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
      const { x, y, isTopRow, pointWidth, pointHeight, pointNumber } = getPointCoordinates(pointIndex, canvas)
      
      const triangleWidth = pointWidth * 0.95
      const triangleHeight = pointHeight * 0.95
      
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      const isLight = pointInRow % 2 === 0
      const triangleColor = isLight ? '#D4A574' : '#8B4513'
      
      // 1. Подсветка точки под курсором (самый нижний слой подсветки)
      if (hoveredPoint === pointIndex) {
        ctx.fillStyle = dragging ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)'
        if (isTopRow) {
          ctx.fillRect(x - pointWidth / 2, 0, pointWidth, height / 2)
        } else {
          ctx.fillRect(x - pointWidth / 2, height / 2, pointWidth, height / 2)
        }
      }

      // 2. Подсветка возможных исходных точек (когда не перетаскиваем)
      if (!dragging && highlightedPoints.has(pointIndex)) {
        ctx.save()
        ctx.shadowBlur = 15
        ctx.shadowColor = 'rgba(0, 255, 0, 0.8)'
        drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, triangleColor)
        ctx.restore()
      } else if (dragging && validTargetPoints.has(pointIndex)) {
        // 3. Подсветка валидных точек назначения при перетаскивании
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'
        if (isTopRow) {
          ctx.fillRect(x - pointWidth / 2, 0, pointWidth, height / 2)
        } else {
          ctx.fillRect(x - pointWidth / 2, height / 2, pointWidth, height / 2)
        }
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.lineWidth = 2
        ctx.strokeRect(x - pointWidth / 2 + 2, isTopRow ? 2 : height / 2 + 2, pointWidth - 4, height / 2 - 4)
      }
      
      // 4. Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.3)'
        if (isTopRow) {
          ctx.fillRect(x - pointWidth / 2, 0, pointWidth, height / 2)
        } else {
          ctx.fillRect(x - pointWidth / 2, height / 2, pointWidth, height / 2)
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
      
      const { x, y, isTopRow, pointWidth, pointHeight } = getPointCoordinates(pointIndex, canvas)
      const checkerCount = Math.abs(pointValue)
      const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
      
      const checkerSize = Math.min(pointWidth * 0.85, pointHeight * 0.15) 
      const checkerBaseY = isTopRow 
        ? y + checkerSize/2 + 5 
        : y - checkerSize/2 - 5 
      
      const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
      const checkersToDraw = isDraggingFromThisPoint ? checkerCount - 1 : checkerCount
      
      for (let i = 0; i < checkersToDraw; i++) {
        // Если шашек много (больше 5), начинаем их накладывать друг на друга плотнее
        const overlap = checkerCount > 5 ? (checkerSize * 0.8) : checkerSize
        const yOffset = i * overlap
        const checkerY = isTopRow 
          ? checkerBaseY + yOffset 
          : checkerBaseY - yOffset
        
        // Рисуем шашку
        ctx.save()
        
        // Тень для объема
        ctx.shadowBlur = 4
        ctx.shadowColor = 'rgba(0,0,0,0.4)'
        ctx.shadowOffsetY = 2
        
        ctx.fillStyle = isMyPoint ? '#F0F0F0' : '#333333'
        ctx.beginPath()
        ctx.arc(x, checkerY, checkerSize / 2, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.strokeStyle = isMyPoint ? '#999' : '#000'
        ctx.lineWidth = 1.5
        ctx.stroke()
        
        // Внутренний декор шашки
        ctx.beginPath()
        ctx.arc(x, checkerY, checkerSize * 0.35, 0, Math.PI * 2)
        ctx.strokeStyle = isMyPoint ? '#DDD' : '#555'
        ctx.stroke()
        
        ctx.restore()
      }
      
      // Если шашек больше 5, показываем число на последней шашке
      if (checkerCount > 5 && !isDraggingFromThisPoint) {
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
      const { pointWidth, pointHeight } = getPointCoordinates(dragging.pointIndex, canvas)
      const checkerSize = Math.min(pointWidth * 0.85, pointHeight * 0.15)
      const dragX = dragPosition.x - dragging.offsetX
      const dragY = dragPosition.y - dragging.offsetY
      
      ctx.save()
      ctx.shadowBlur = 15
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      
      ctx.globalAlpha = 0.9
      ctx.fillStyle = isPlayer1 ? '#F0F0F0' : '#333333'
      ctx.beginPath()
      ctx.arc(dragX, dragY, checkerSize / 2, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = isPlayer1 ? '#999' : '#000'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Декор перетаскиваемой шашки
      ctx.beginPath()
      ctx.arc(dragX, dragY, checkerSize * 0.35, 0, Math.PI * 2)
      ctx.strokeStyle = isPlayer1 ? '#DDD' : '#555'
      ctx.stroke()
      
      ctx.restore()
    }
    
    // Отрисовка бара
    if (gameState.bar) {
      const bar = gameState.bar
      const myBarCount = isPlayer1 ? bar.white || 0 : bar.black || 0
      const opponentBarCount = isPlayer1 ? bar.black || 0 : bar.white || 0
      const checkerSize = Math.min(pointWidth * 0.25, pointHeight * 0.3)
      const barX = width / 2
      
      if (myBarCount > 0) {
        const barStartY = height - pointHeight * 0.3
        for (let i = 0; i < myBarCount; i++) {
          const barY = barStartY - (i * checkerSize * 0.6)
          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath()
          ctx.arc(barX - 25, barY, checkerSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#333'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
      
      if (opponentBarCount > 0) {
        const barStartY = pointHeight * 0.3
        for (let i = 0; i < opponentBarCount; i++) {
          const barY = barStartY + (i * checkerSize * 0.6)
          ctx.fillStyle = '#000000'
          ctx.beginPath()
          ctx.arc(barX + 25, barY, checkerSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#333'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }
    
    // Отрисовка области выноса
    if (dragging && validTargetPoints.has(-1)) {
      const bearOffMargin = pointWidth * 1.5
      
      if (gameMode === 'long') {
        if (isPlayer1) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.4)'
          ctx.fillRect(0, height - pointHeight, bearOffMargin, pointHeight)
          ctx.strokeStyle = 'rgba(0, 255, 0, 1)'
          ctx.lineWidth = 4
          ctx.strokeRect(0, height - pointHeight, bearOffMargin, pointHeight)
          if (hoveredPoint === -1) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'
            ctx.fillRect(0, height - pointHeight, bearOffMargin, pointHeight)
          }
        } else {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.4)'
          ctx.fillRect(width - bearOffMargin, 0, bearOffMargin, pointHeight)
          ctx.strokeStyle = 'rgba(0, 255, 0, 1)'
          ctx.lineWidth = 4
          ctx.strokeRect(width - bearOffMargin, 0, bearOffMargin, pointHeight)
          if (hoveredPoint === -1) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'
            ctx.fillRect(width - bearOffMargin, 0, bearOffMargin, pointHeight)
          }
        }
      } else {
        if (isPlayer1) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.4)'
          ctx.fillRect(width - bearOffMargin, 0, bearOffMargin, pointHeight)
          ctx.strokeStyle = 'rgba(0, 255, 0, 1)'
          ctx.lineWidth = 4
          ctx.strokeRect(width - bearOffMargin, 0, bearOffMargin, pointHeight)
          if (hoveredPoint === -1) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'
            ctx.fillRect(width - bearOffMargin, 0, bearOffMargin, pointHeight)
          }
        } else {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.4)'
          ctx.fillRect(0, height - pointHeight, bearOffMargin, pointHeight)
          ctx.strokeStyle = 'rgba(0, 255, 0, 1)'
          ctx.lineWidth = 4
          ctx.strokeRect(0, height - pointHeight, bearOffMargin, pointHeight)
          if (hoveredPoint === -1) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'
            ctx.fillRect(0, height - pointHeight, bearOffMargin, pointHeight)
          }
        }
      }
    }
  }, [gameState, selectedPoint, highlightedPoints, isPlayer1, dragging, dragPosition, hoveredPoint, validTargetPoints, gameMode, getPointCoordinates])
  
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
  
  // Обновление размера canvas
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current
        const rect = container.getBoundingClientRect()
        canvasRef.current.width = rect.width
        canvasRef.current.height = rect.height
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
      onMove(bestMove.from, bestMove.to, bestMove.die)
      // Сбрасываем выделение
      setSelectedPoint(null)
      setDragging(null)
      setDragPosition(null)
      setValidTargetPoints(new Set())
    }
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
    
    if (pointIndex === null) return
    
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
    
    if (pointValue === 0) return
    
    // Проверяем, моя ли это шашка
    const isMyChecker = isPlayer1 ? pointValue > 0 : pointValue < 0
    const isMyBar = (pointIndex === 24 && isPlayer1) || (pointIndex === 25 && !isPlayer1)
    
    if (!isMyChecker && !isMyBar) return
    
    // Разрешаем захватить шашку, даже если нет ходов, для визуального отклика
    // Но подсветим цели только если ходы есть
    const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
    
    const { x: pointX, y: pointY } = getPointCoordinates(pointIndex, canvas)
    
    // Начинаем перетаскивание
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
          onMove(bearOffMove.from, bearOffMove.to, bearOffMove.die)
        }
      } else if (validTargetPoints.has(targetPoint)) {
        const move = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === targetPoint)
        if (move) {
          onMove(move.from, move.to, move.die)
        }
      }
    }
    
    setDragging(null)
    setDragPosition(null)
    setSelectedPoint(null)
    setHoveredPoint(null)
    setValidTargetPoints(new Set())
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
    
    if (selectedPoint === null) {
      const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
      if (pointMoves.length > 0) {
        setSelectedPoint(pointIndex)
      }
    } else {
      const move = possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex)
      if (move) {
        onMove(move.from, move.to, move.die)
        setSelectedPoint(null)
      } else {
        setSelectedPoint(pointIndex)
      }
    }
  }
  
  // Определение формата кубиков
  const diceArray = dice 
    ? (Array.isArray(dice) ? dice : [dice.die1, dice.die2])
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
      />
      
      {/* Кубики */}
      {diceArray && dice3DPosition && (
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
