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
    const barWidth = width * 0.05
    const barX = (width - barWidth) / 2
    
    // Доступная ширина для треугольников (с каждой стороны от бара)
    const availableWidth = (width - barWidth) / 2
    
    // Ширина одного треугольника
    const pointWidth = availableWidth / 6
    const pointHeight = height / 2
    
    const isTopRow = pointIndex < 12
    const pointInRow = isTopRow ? pointIndex : pointIndex - 12
    
    // Разделение на левую и правую половины
    // Левая половина: точки 6-11 (верх) и 12-17 (низ)
    // Правая половина: точки 0-5 (верх) и 18-23 (низ)
    const isLeftHalf = (isTopRow && pointIndex >= 6) || (!isTopRow && pointIndex >= 12 && pointIndex < 18)
    const isRightHalf = (isTopRow && pointIndex < 6) || (!isTopRow && pointIndex >= 18)
    
    let x: number
    let localIndex: number
    
    if (isLeftHalf) {
      // Левая половина: от левого края к бару
      if (isTopRow) {
        localIndex = pointIndex - 6  // 0-5 для точек 6-11
      } else {
        localIndex = pointIndex - 12  // 0-5 для точек 12-17
      }
      x = localIndex * pointWidth + pointWidth / 2
    } else {
      // Правая половина: от бара к правому краю
      if (isTopRow) {
        localIndex = pointIndex  // 0-5 для точек 0-5
      } else {
        localIndex = pointIndex - 18  // 0-5 для точек 18-23
      }
      x = barX + barWidth + localIndex * pointWidth + pointWidth / 2
    }
    
    const y = isTopRow
      ? height / 2  // Верхний ряд: середина верхней половины
      : height / 2  // Нижний ряд: середина нижней половины
    
    return { x, y, isTopRow, pointWidth, pointHeight }
  }, [])
  
  // Функция для определения точки по координатам
  const getPointAtPosition = useCallback((x: number, y: number, canvas: HTMLCanvasElement): number | null => {
    const width = canvas.width
    const height = canvas.height
    const barWidth = width * 0.05
    const barX = (width - barWidth) / 2
    const availableWidth = (width - barWidth) / 2
    const pointWidth = availableWidth / 6
    const pointHeight = height / 2
    
    const points = gameState?.points || []
    
    // Проверяем все точки
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const { x: pointX, y: pointY, isTopRow, pointWidth: pWidth, pointHeight: pHeight } = getPointCoordinates(pointIndex, canvas)
      
      const triangleWidth = pWidth * 0.95
      const triangleHeight = pHeight * 0.95
      const dx = Math.abs(x - pointX)
      
      // Проверка попадания в треугольник (перевернутые треугольники)
      // Для верхнего ряда: треугольник от y - triangleHeight/2 до y + triangleHeight/2
      // Для нижнего ряда: треугольник от y - triangleHeight/2 до y + triangleHeight/2
      const inTriangle = dx < triangleWidth / 2 && 
        (isTopRow 
          ? (y >= pointY - triangleHeight / 2 && y <= pointY + triangleHeight / 2)
          : (y >= pointY - triangleHeight / 2 && y <= pointY + triangleHeight / 2))
      
      if (inTriangle) {
        return pointIndex
      }
    }
    
    // Проверяем бар
    const barYTop = pointHeight * 0.25
    const barYBottom = height - pointHeight * 0.25
    const barCheckWidth = pointWidth * 0.6
    
    if (Math.abs(x - (barX + barWidth / 2)) < barCheckWidth / 2 && y >= barYTop && y <= barYBottom) {
      return isPlayer1 ? 24 : 25
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
  }, [gameState, isPlayer1, gameMode, getPointCoordinates])
  
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
    const barWidth = width * 0.05
    const barX = (width - barWidth) / 2
    ctx.fillStyle = '#654321'
    ctx.fillRect(barX, 0, barWidth, height)
    
    const points = gameState.points || []
    // Доступная ширина для треугольников (с каждой стороны от бара)
    const availableWidth = (width - barWidth) / 2
    const pointWidth = availableWidth / 6
    const pointHeight = height / 2
    
    // Функция для отрисовки треугольной точки (перевернутые на 180 градусов)
    const drawTrianglePoint = (x: number, y: number, w: number, h: number, isTop: boolean, color: string) => {
      ctx.beginPath()
      if (isTop) {
        // Верхний треугольник: перевернут - вершина внизу, основание вверху
        ctx.moveTo(x, y + h / 2)  // Вершина внизу треугольника
        ctx.lineTo(x - w / 2, y - h / 2)  // Левая точка основания
        ctx.lineTo(x + w / 2, y - h / 2)  // Правая точка основания
      } else {
        // Нижний треугольник: перевернут - вершина вверху, основание внизу
        ctx.moveTo(x, y - h / 2)  // Вершина вверху треугольника
        ctx.lineTo(x - w / 2, y + h / 2)  // Левая точка основания
        ctx.lineTo(x + w / 2, y + h / 2)  // Правая точка основания
      }
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#654321'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    
    // Отрисовка всех 24 точек
    points.forEach((pointValue: number, pointIndex: number) => {
      const { x, y, isTopRow } = getPointCoordinates(pointIndex, canvas)
      
      // Треугольники занимают почти всю ширину точки, но с небольшим отступом
      const triangleWidth = pointWidth * 0.95
      const triangleHeight = pointHeight * 0.95
      
      // Чередование цветов треугольников (как на классической доске)
      const isLight = (pointIndex % 2 === 0 && isTopRow) || (pointIndex % 2 === 1 && !isTopRow)
      const triangleColor = isLight ? '#D4A574' : '#8B4513'
      
      // Подсветка возможных исходных точек (когда не перетаскиваем)
      if (!dragging && highlightedPoints.has(pointIndex)) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'
        drawTrianglePoint(x, y, triangleWidth + 8, triangleHeight + 8, isTopRow, 'rgba(0, 255, 0, 0.3)')
        ctx.strokeStyle = 'rgba(0, 255, 0, 1)'
        ctx.lineWidth = 4
        ctx.stroke()
      }
      
      // Подсветка валидных точек назначения при перетаскивании
      if (dragging && validTargetPoints.has(pointIndex)) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'
        drawTrianglePoint(x, y, triangleWidth + 5, triangleHeight + 5, isTopRow, 'rgba(0, 255, 0, 0.5)')
        ctx.strokeStyle = 'rgba(0, 255, 0, 1)'
        ctx.lineWidth = 4
        ctx.stroke()
      }
      
      // Подсветка точки под курсором
      if (dragging && hoveredPoint === pointIndex) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.6)'
        drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, 'rgba(255, 255, 0, 0.6)')
      }
      
      // Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.5)'
        drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, 'rgba(90, 127, 196, 0.5)')
      }
      
      // Рисуем треугольник точки
      drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow, triangleColor)
      
      // Отрисовка нумерации точек
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      if (isTopRow) {
        // Нумерация над верхними треугольниками
        ctx.fillText(pointIndex.toString(), x, y - triangleHeight / 2 - 15)
      } else {
        // Нумерация под нижними треугольниками
        ctx.fillText(pointIndex.toString(), x, y + triangleHeight / 2 + 15)
      }
      
      // Отрисовка шашек на точке
      if (pointValue !== 0) {
        const checkerCount = Math.abs(pointValue)
        const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
        const checkerSize = Math.min(pointWidth * 0.25, pointHeight * 0.3)
        
        const stackHeight = Math.min(checkerCount, 5) * checkerSize * 0.6
        // Для перевернутых треугольников: верхние шашки ближе к центру, нижние тоже
        const checkerBaseY = isTopRow ? y + triangleHeight * 0.2 : y - triangleHeight * 0.2
        const startY = isTopRow ? checkerBaseY : checkerBaseY - stackHeight
        
        const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
        const checkersToDraw = isDraggingFromThisPoint ? Math.min(checkerCount - 1, 5) : Math.min(checkerCount, 5)
        
        for (let i = 0; i < checkersToDraw; i++) {
          const checkerY = startY + i * checkerSize * 0.6
          
          // Простые шашки без текстур
          ctx.fillStyle = isMyPoint ? '#FFFFFF' : '#000000'
          ctx.beginPath()
          ctx.arc(x, checkerY, checkerSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#333'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        
        // Если шашек больше 5, показываем число
        if (checkerCount > 5) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(x - 18, isTopRow ? checkerBaseY - 22 : checkerBaseY + 2, 36, 18)
          ctx.fillStyle = '#000'
          ctx.font = 'bold 12px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(checkerCount.toString(), x, isTopRow ? checkerBaseY - 10 : checkerBaseY + 12)
        }
      }
    })
    
    // Отрисовка перетаскиваемой шашки
    if (dragging && dragPosition) {
      const checkerSize = Math.min((width / 12) * 0.25, (height / 2) * 0.3)
      const dragX = dragPosition.x - dragging.offsetX
      const dragY = dragPosition.y - dragging.offsetY
      
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.fillStyle = isPlayer1 ? '#FFFFFF' : '#000000'
      ctx.beginPath()
      ctx.arc(dragX, dragY, checkerSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 3
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
  
  // Обработка начала перетаскивания
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const pointIndex = getPointAtPosition(x, y, canvas)
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
    
    const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0) || 
                      (pointIndex === 24 && isPlayer1) || (pointIndex === 25 && !isPlayer1)
    
    if (!isMyPoint) return
    
    const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
    if (pointMoves.length === 0) return
    
    const { x: pointX, y: pointY } = getPointCoordinates(pointIndex, canvas)
    
    setDragging({ pointIndex, offsetX: x - pointX, offsetY: y - pointY })
    setDragPosition({ x, y })
    setSelectedPoint(pointIndex)
    
    const validTargets = new Set<number>()
    pointMoves.forEach(move => {
      if (move.to !== undefined && move.to !== null) {
        if ((move.to >= 0 && move.to < 24) || move.to === -1) {
          validTargets.add(move.to)
        }
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
