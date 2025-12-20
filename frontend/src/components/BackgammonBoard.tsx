import { useEffect, useRef, useState, useCallback } from 'react'
import { apiClient } from '../api/client'
import './BackgammonBoard.css'

interface Point {
  index: number
  checkers: number[]
  color: 'white' | 'black' | null
}

interface Dice {
  die1: number
  die2: number
}

interface BackgammonBoardProps {
  gameState: any
  currentPlayer: number
  dice: Dice | number[] | null
  onMove: (from: number, to: number, die: number) => void
  onRollDice: () => void
  canMove: boolean
  isMyTurn: boolean
  gameId?: string
  gameMode?: 'short' | 'long'
  playerSkins?: { board?: any; dice?: any; checkers?: any }
  opponentSkins?: { board?: any; dice?: any; checkers?: any }
}

// Правильная нумерация точек в нардах для отображения
// Верхний ряд: точки 24-13 (справа налево)
// Нижний ряд: точки 12-1 (слева направо)
const POINT_NUMBERS = [
  24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, // Верхний ряд (справа налево) - индексы 0-11
  12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, // Нижний ряд (слева направо) - индексы 12-23
]

export default function BackgammonBoard({
  gameState,
  currentPlayer,
  dice,
  onMove,
  onRollDice,
  canMove,
  isMyTurn,
  gameId,
  gameMode = 'long', // По умолчанию длинные нарды
  playerSkins,
  opponentSkins,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [diceRolling, setDiceRolling] = useState(false)
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number }>>([])
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())
  const [dragging, setDragging] = useState<{ point: number; offsetX: number; offsetY: number } | null>(null)
  const animationFrameRef = useRef<number>()

  // gameState.points - это массив чисел, где положительное число = белые шашки, отрицательное = черные
  const pointsRaw = gameState?.points || []
  const points: number[] = Array.isArray(pointsRaw)
    ? pointsRaw.map((p: any) => {
        // Если это число, возвращаем как есть
        if (typeof p === 'number') {
          return p
        }
        // Если это объект Point, преобразуем в число
        if (p && typeof p === 'object') {
          if ('checkers' in p && Array.isArray(p.checkers)) {
            const count = p.checkers.length
            return p.color === 'white' ? count : -count
          }
          // Если есть числовое значение напрямую
          if ('value' in p && typeof p.value === 'number') {
            return p.value
          }
        }
        return 0
      })
    : []
  
  const bar = gameState?.bar || (Array.isArray(gameState?.bar) ? { white: gameState.bar[0] || 0, black: gameState.bar[1] || 0 } : { white: 0, black: 0 })
  const bearOff = gameState?.borneOff || gameState?.bearOff || (Array.isArray(gameState?.borneOff) ? { white: gameState.borneOff[0] || 0, black: gameState.borneOff[1] || 0 } : { white: 0, black: 0 })

  // Нормализуем формат кубиков
  const diceArray: number[] = dice
    ? Array.isArray(dice)
      ? dice
      : [dice.die1, dice.die2]
    : []

  // Загружаем возможные ходы когда доступны кубики
  useEffect(() => {
    if (gameId && diceArray.length > 0 && isMyTurn && canMove) {
      console.log('🔄 Загружаем возможные ходы для игры', gameId)
      apiClient
        .get(`/games/${gameId}/possible-moves`)
        .then((response: any) => {
          const allMoves = response.data || []
          console.log('✅ Получены возможные ходы:', allMoves)
          
          // Извлекаем все возможные ходы из всех комбинаций
          const movesSet = new Set<string>()
          allMoves.forEach((moveSeq: any[]) => {
            moveSeq.forEach((move: any) => {
              movesSet.add(`${move.from}-${move.to}-${move.die}`)
            })
          })
          
          const uniqueMoves = Array.from(movesSet).map((key) => {
            const [from, to, die] = key.split('-').map(Number)
            return { from, to, die }
          })
          
          console.log('📋 Уникальные ходы:', uniqueMoves)
          // Логируем ходы с номерами точек для отладки
          uniqueMoves.forEach(move => {
            const fromPoint = move.from === -1 ? 'бар' : POINT_NUMBERS[move.from]
            const toPoint = move.to === -1 ? 'вынос' : (move.to >= 0 && move.to < 24 ? POINT_NUMBERS[move.to] : `индекс ${move.to}`)
            console.log(`  📍 Ход: с точки ${fromPoint} (индекс ${move.from}) на точку ${toPoint} (индекс ${move.to}) кубиком ${move.die}`)
          })
          setPossibleMoves(uniqueMoves)
        })
        .catch((error) => {
          console.error('❌ Ошибка загрузки возможных ходов:', error)
          setPossibleMoves([])
        })
    } else {
      setPossibleMoves([])
      setHighlightedPoints(new Set())
      setSelectedPoint(null)
    }
  }, [gameId, diceArray.join(','), isMyTurn, canMove, gameState?.currentPlayer])

  // При выборе точки подсвечиваем возможные ходы
  useEffect(() => {
    if (selectedPoint !== null && possibleMoves.length > 0) {
      const highlights = new Set<number>()
      const filteredMoves = possibleMoves.filter((move) => {
        if (selectedPoint === -1) {
          return move.from === -1
        }
        return move.from === selectedPoint
      })
      
      console.log(`✨ Подсвечиваем ходы для точки ${selectedPoint === -1 ? 'бар' : POINT_NUMBERS[selectedPoint]} (индекс ${selectedPoint}):`, filteredMoves)
      console.log(`📊 Всего возможных ходов: ${possibleMoves.length}, отфильтровано: ${filteredMoves.length}`)
      
      filteredMoves.forEach((move) => {
        // Добавляем все валидные целевые точки (включая вынос, но для визуализации используем только точки на доске)
        if (move.to >= 0 && move.to < 24) {
          highlights.add(move.to)
          console.log(`  ✅ Добавлена подсветка для точки ${POINT_NUMBERS[move.to]} (индекс ${move.to})`)
        } else if (move.to === -1 || move.to < 0) {
          // Вынос - не добавляем в highlights, но логируем
          console.log(`  📤 Вынос с точки ${POINT_NUMBERS[move.from]} (индекс ${move.from}) кубиком ${move.die}`)
        }
      })
      
      console.log(`🎯 Итоговые подсвеченные точки:`, Array.from(highlights).map(idx => `${POINT_NUMBERS[idx]} (${idx})`).join(', '))
      setHighlightedPoints(highlights)
    } else {
      if (selectedPoint !== null) {
        console.log(`⚠️ Нет возможных ходов для точки ${selectedPoint === -1 ? 'бар' : POINT_NUMBERS[selectedPoint]}`)
      }
      setHighlightedPoints(new Set())
    }
  }, [selectedPoint, possibleMoves])

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const boardPadding = 20
    const boardWidth = width - boardPadding * 2
    const boardHeight = height - boardPadding * 2
    const pointWidth = boardWidth / 12
    const pointHeight = boardHeight / 2
    const barWidth = boardWidth * 0.12
    const barHeight = boardHeight * 0.3

    // Очистка
    ctx.clearRect(0, 0, width, height)

    // Фон доски (темное дерево)
    const boardGradient = ctx.createLinearGradient(0, 0, width, height)
    boardGradient.addColorStop(0, '#8B4513')
    boardGradient.addColorStop(0.5, '#A0522D')
    boardGradient.addColorStop(1, '#8B4513')
    ctx.fillStyle = boardGradient
    ctx.fillRect(0, 0, width, height)

    // Рамка доски
    ctx.strokeStyle = '#654321'
    ctx.lineWidth = 4
    ctx.strokeRect(boardPadding, boardPadding, boardWidth, boardHeight)

    // Центральная линия (бар)
    const barX = boardPadding + (boardWidth - barWidth) / 2
    const barY = boardPadding + (boardHeight - barHeight) / 2
    
    // Фон бара
    ctx.fillStyle = '#654321'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 2
    ctx.strokeRect(barX, barY, barWidth, barHeight)

    // Рисуем точки (треугольники)
    for (let i = 0; i < 24; i++) {
      const pointNum = POINT_NUMBERS[i]
      const isTop = i < 12
      
      // Позиция точки
      let x: number
      if (i < 12) {
        // Верхний ряд (справа налево)
        x = boardPadding + (11 - i) * pointWidth
      } else {
        // Нижний ряд (слева направо)
        x = boardPadding + (i - 12) * pointWidth
      }

      // Позиция точки: для верхних - сверху, для нижних - снизу (прижаты к краю доски)
      // Для верхних точек: y = boardPadding (верхний край доски), треугольник рисуется вниз
      // Для нижних точек: y = boardPadding + boardHeight (нижний край доски), треугольник рисуется вверх от этой точки
      // Это означает что нижний край треугольника (основание) будет на y = boardPadding + boardHeight
      const y = isTop ? boardPadding : boardPadding + boardHeight

      // Цвет точки (чередование)
      const isLight = (Math.floor(i / 6) + i) % 2 === 0
      ctx.fillStyle = isLight ? '#DEB887' : '#CD853F'
      
      // Рисуем треугольник точки
      ctx.beginPath()
      if (isTop) {
        // Верхние треугольники - рисуются вниз
        ctx.moveTo(x, y)
        ctx.lineTo(x + pointWidth / 2, y + pointHeight)
        ctx.lineTo(x + pointWidth, y)
      } else {
        // Нижние треугольники - рисуются вверх (прижаты к низу доски)
        ctx.moveTo(x, y)
        ctx.lineTo(x + pointWidth / 2, y - pointHeight)
        ctx.lineTo(x + pointWidth, y)
      }
      ctx.closePath()
      ctx.fill()
      
      // Обводка треугольника
      ctx.strokeStyle = '#654321'
      ctx.lineWidth = 2
      ctx.stroke()

      // Номер точки - показываем всегда для удобства
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#654321'
      ctx.lineWidth = 2
      // Для верхних точек номер внизу треугольника, для нижних - вверху
      const numY = isTop ? y + pointHeight - 5 : y - pointHeight + 15
      ctx.strokeText(pointNum.toString(), x + pointWidth / 2, numY)
      ctx.fillText(pointNum.toString(), x + pointWidth / 2, numY)

      // Фишки на точке - используем скин если есть
      const pointValue = points[i] || 0
      const checkerCount = Math.abs(pointValue)
      if (checkerCount > 0) {
        const isPlayer1Checker = pointValue > 0
        const checkerSkin = isPlayer1Checker 
          ? (playerSkins?.checkers || opponentSkins?.checkers)
          : (opponentSkins?.checkers || playerSkins?.checkers)
        
        let checkerColor = pointValue > 0 ? '#FFFFFF' : '#1a1a1a'
        if (checkerSkin?.checkersConfig?.color) {
          checkerColor = checkerSkin.checkersConfig.color
        }
        const checkerRadius = 14
        const maxStack = 5
        const stackSpacing = 4

        // Рисуем фишки
        for (let j = 0; j < Math.min(checkerCount, maxStack); j++) {
          let checkerY: number
          if (isTop) {
            checkerY = y + pointHeight - checkerRadius - (j * stackSpacing)
          } else {
            // Для нижних точек фишки должны быть прижаты к низу треугольника
            checkerY = y - checkerRadius - (j * stackSpacing)
          }

          const checkerX = x + pointWidth / 2

          // Анимация выбранной фишки
          const isSelected = selectedPoint === i && j === checkerCount - 1
          const scale = isSelected ? 1.2 : 1.0
          const offsetX = isSelected ? Math.sin(Date.now() / 100) * 3 : 0
          const offsetY = isSelected ? Math.cos(Date.now() / 100) * 2 : 0

          ctx.save()
          ctx.translate(checkerX + offsetX, checkerY + offsetY)
          ctx.scale(scale, scale)

          // Тень фишки
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 8
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2

          // Градиент для фишки
          const checkerGradient = ctx.createRadialGradient(-3, -3, 0, 0, 0, checkerRadius)
          if (checkerColor === '#FFFFFF') {
            checkerGradient.addColorStop(0, '#FFFFFF')
            checkerGradient.addColorStop(1, '#E0E0E0')
          } else {
            checkerGradient.addColorStop(0, '#2a2a2a')
            checkerGradient.addColorStop(1, '#1a1a1a')
          }

          // Фишка
          ctx.beginPath()
          ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
          ctx.fillStyle = checkerGradient
          ctx.fill()
          
          // Обводка фишки
          ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
          ctx.lineWidth = 2
          ctx.stroke()

          // Блик на фишке
          ctx.beginPath()
          ctx.arc(-4, -4, 4, 0, Math.PI * 2)
          ctx.fillStyle = checkerColor === '#FFFFFF' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)'
          ctx.fill()

          ctx.restore()
        }

        // Показываем количество если больше maxStack
        if (checkerCount > maxStack) {
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px Arial'
          ctx.textAlign = 'center'
          // Позиция текста количества фишек: для верхних - внизу стопки, для нижних - вверху стопки
          const countTextY = isTop 
            ? y + pointHeight - checkerRadius - maxStack * stackSpacing - 10 
            : y - checkerRadius - maxStack * stackSpacing - 15
          ctx.fillText(
            checkerCount.toString(),
            x + pointWidth / 2,
            countTextY
          )
        }
      }

      // Подсветка возможных ходов (когда точка выбрана) - рисуем поверх всего
      if (highlightedPoints.has(i) && isMyTurn && canMove && selectedPoint !== null) {
        ctx.beginPath()
        if (isTop) {
          ctx.moveTo(x, y)
          ctx.lineTo(x + pointWidth / 2, y + pointHeight)
          ctx.lineTo(x + pointWidth, y)
        } else {
          ctx.moveTo(x, y)
          ctx.lineTo(x + pointWidth / 2, y - pointHeight)
          ctx.lineTo(x + pointWidth, y)
        }
        ctx.closePath()
        
        // Более яркая подсветка для лучшей видимости
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'
        ctx.fill()
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 1.0)'
        ctx.lineWidth = 4
        ctx.stroke()
      }

      // Подсветка при наведении (если точка не выбрана)
      if (hoverPoint === i && selectedPoint === null && isMyTurn && canMove) {
        ctx.beginPath()
        if (isTop) {
          ctx.moveTo(x, y)
          ctx.lineTo(x + pointWidth / 2, y + pointHeight)
          ctx.lineTo(x + pointWidth, y)
        } else {
          ctx.moveTo(x, y)
          ctx.lineTo(x + pointWidth / 2, y - pointHeight)
          ctx.lineTo(x + pointWidth, y)
        }
        ctx.closePath()
        
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
        ctx.fill()
        
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    // Фишки на баре (сбитые)
    const barCenterX = barX + barWidth / 2
    const barCenterY = barY + barHeight / 2

    if (bar.white > 0) {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Бар', barCenterX, barCenterY - 15)
      
      for (let i = 0; i < Math.min(bar.white, 5); i++) {
        const checkerX = barCenterX - 20 + (i % 3) * 15
        const checkerY = barCenterY - 5 + Math.floor(i / 3) * 15
        
        ctx.save()
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        
        ctx.beginPath()
        ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
      
      if (bar.white > 5) {
        ctx.fillStyle = '#1a1a1a'
        ctx.font = 'bold 12px Arial'
        ctx.fillText(bar.white.toString(), barCenterX + 25, barCenterY)
      }
    }

    if (bar.black > 0) {
      for (let i = 0; i < Math.min(bar.black, 5); i++) {
        const checkerX = barCenterX - 20 + (i % 3) * 15
        const checkerY = barCenterY + 10 + Math.floor(i / 3) * 15
        
        ctx.save()
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        
        ctx.beginPath()
        ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
        ctx.fillStyle = '#1a1a1a'
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
      
      if (bar.black > 5) {
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 12px Arial'
        ctx.fillText(bar.black.toString(), barCenterX + 25, barCenterY + 20)
      }
    }

    // Вынос (bear off)
    const bearOffX = width - 30
    const bearOffYTop = boardPadding + 20
    const bearOffYBottom = boardPadding + boardHeight - 20

    if (bearOff.white > 0) {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(`Вынос: ${bearOff.white}`, bearOffX, bearOffYTop)
    }

    if (bearOff.black > 0) {
      ctx.fillStyle = '#1a1a1a'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'right'
      ctx.fillText(`Вынос: ${bearOff.black}`, bearOffX, bearOffYBottom)
    }

    // Кубики с улучшенной анимацией
    if (dice || diceRolling) {
      const diceAreaX = boardPadding + 20
      const diceAreaY = height - 100
      const diceSize = 40
      const diceSpacing = 50

      if (diceRolling) {
        // Анимация броска кубиков
        const roll1 = Math.floor(Math.random() * 6) + 1
        const roll2 = Math.floor(Math.random() * 6) + 1
        drawDice(ctx, diceAreaX, diceAreaY, roll1, diceSize, true)
        drawDice(ctx, diceAreaX + diceSpacing, diceAreaY, roll2, diceSize, true)
      } else if (diceArray.length > 0) {
        // Отрисовка кубиков из массива
        diceArray.forEach((die, index) => {
          drawDice(ctx, diceAreaX + index * diceSpacing, diceAreaY, die, diceSize, false)
        })
      }
    }
  }, [points, bar, bearOff, selectedPoint, hoverPoint, highlightedPoints, dice, diceRolling, isMyTurn, canMove])

  const drawDice = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    value: number,
    size: number,
    rolling: boolean
  ) => {
    ctx.save()
    
    // Анимация вращения при броске
    if (rolling) {
      const rotation = (Date.now() / 50) % 360
      ctx.translate(x + size / 2, y + size / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-size / 2, -size / 2)
    }

    // Тень кубика
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 3

    // Градиент кубика
    const diceGradient = ctx.createLinearGradient(x, y, x + size, y + size)
    diceGradient.addColorStop(0, '#FFFFFF')
    diceGradient.addColorStop(1, '#E0E0E0')
    
    // Кубик
    ctx.fillStyle = diceGradient
    ctx.fillRect(x, y, size, size)
    
    // Обводка кубика
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, size, size)

    // Точки на кубике
    ctx.fillStyle = '#1a1a1a'
    const dotSize = size / 8
    const dotPositions: Record<number, number[][]> = {
      1: [[size / 2, size / 2]],
      2: [[size / 3, size / 3], [size * 2 / 3, size * 2 / 3]],
      3: [[size / 3, size / 3], [size / 2, size / 2], [size * 2 / 3, size * 2 / 3]],
      4: [
        [size / 3, size / 3],
        [size * 2 / 3, size / 3],
        [size / 3, size * 2 / 3],
        [size * 2 / 3, size * 2 / 3],
      ],
      5: [
        [size / 3, size / 3],
        [size * 2 / 3, size / 3],
        [size / 2, size / 2],
        [size / 3, size * 2 / 3],
        [size * 2 / 3, size * 2 / 3],
      ],
      6: [
        [size / 3, size / 3],
        [size * 2 / 3, size / 3],
        [size / 3, size / 2],
        [size * 2 / 3, size / 2],
        [size / 3, size * 2 / 3],
        [size * 2 / 3, size * 2 / 3],
      ],
    }

    const positions = dotPositions[value] || []
    positions.forEach(([dx, dy]) => {
      ctx.beginPath()
      ctx.arc(x + dx, y + dy, dotSize, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (container) {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
        drawBoard()
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [drawBoard])

  useEffect(() => {
    const animate = () => {
      drawBoard()
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drawBoard])

  const getPointFromCoords = (x: number, y: number): number | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const width = canvas.width
    const height = canvas.height
    const boardPadding = 20
    const boardWidth = width - boardPadding * 2
    const boardHeight = height - boardPadding * 2
    const pointWidth = boardWidth / 12
    const pointHeight = boardHeight / 2

    for (let i = 0; i < 24; i++) {
      const isTop = i < 12
      let pointX: number
      
      if (i < 12) {
        pointX = boardPadding + (11 - i) * pointWidth
      } else {
        pointX = boardPadding + (i - 12) * pointWidth
      }

      // Для нижних точек прижимаем к низу доски
      // boardHeight = height - boardPadding * 2, поэтому нижний край = boardPadding + boardHeight
      const pointY = isTop ? boardPadding : boardPadding + boardHeight

      // Проверяем клик в пределах треугольника
      const relativeX = x - pointX
      const relativeY = isTop ? y - pointY : pointY - y
      
      if (
        relativeX >= 0 &&
        relativeX <= pointWidth &&
        relativeY >= 0 &&
        relativeY <= pointHeight &&
        relativeX <= pointWidth - (relativeY / pointHeight) * pointWidth &&
        relativeX >= (relativeY / pointHeight) * pointWidth
      ) {
        return i
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !canMove || diceArray.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const clickedPoint = getPointFromCoords(x, y)
    if (clickedPoint === null) return

    const pointValue = points[clickedPoint] || 0
    const isMyChecker = currentPlayer === 0 ? pointValue > 0 : pointValue < 0
    
    if (isMyChecker && possibleMoves.some(move => move.from === clickedPoint)) {
      setDragging({ point: clickedPoint, offsetX: x, offsetY: y })
      setSelectedPoint(clickedPoint)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const hoveredPoint = getPointFromCoords(x, y)
    setHoverPoint(hoveredPoint)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) {
      const canvas = canvasRef.current
      if (!canvas) {
        setDragging(null)
        setSelectedPoint(null)
        return
      }

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const targetPoint = getPointFromCoords(x, y)
      
      if (targetPoint !== null && targetPoint !== dragging.point) {
        // Проверяем валидность хода
        const validMove = possibleMoves.find(
          move => move.from === dragging.point && move.to === targetPoint
        )
        
        if (validMove) {
          onMove(dragging.point, targetPoint, validMove.die)
          setSelectedPoint(null)
          setHighlightedPoints(new Set())
        }
      }

      setDragging(null)
      return
    }

    // Обычный клик если не было drag
    handleCanvasClick(e)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !canMove || diceArray.length === 0 || dragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const clickedPoint = getPointFromCoords(x, y)
    if (clickedPoint === null) {
      setSelectedPoint(null)
      return
    }

    if (selectedPoint === null) {
      // Выбираем точку или бар
      const hasBarCheckers = (currentPlayer === 0 && bar.white > 0) || (currentPlayer === 1 && bar.black > 0)
      
      // Проверяем клик по бару (обрабатывается отдельно, но для простоты считаем что бар = -1)
      // Сначала пробуем выбрать точку с шашкой
      if (clickedPoint >= 0 && clickedPoint < 24) {
        const pointValue = points[clickedPoint] || 0
        if (pointValue !== 0) {
          const checkerCount = currentPlayer === 0 ? (pointValue > 0 ? pointValue : 0) : (pointValue < 0 ? Math.abs(pointValue) : 0)
          const isMyChecker = currentPlayer === 0 ? pointValue > 0 : pointValue < 0
          if (isMyChecker && checkerCount > 0) {
            // Проверяем, есть ли возможные ходы с этой точки
            const hasPossibleMoves = possibleMoves.some(move => move.from === clickedPoint)
            console.log(`🎯 Клик по точке ${POINT_NUMBERS[clickedPoint]} (индекс ${clickedPoint}), есть ходы:`, hasPossibleMoves, 'Возможные ходы:', possibleMoves.filter(m => m.from === clickedPoint))
            if (hasPossibleMoves) {
              setSelectedPoint(clickedPoint)
              return
            } else {
              console.log('⚠️ Нет возможных ходов с этой точки')
            }
          }
        }
      }
      
      // Если есть шашки на баре и есть возможные ходы с бара, можно выбрать бар
      if (hasBarCheckers) {
        const hasPossibleMovesFromBar = possibleMoves.some(move => move.from === -1)
        if (hasPossibleMovesFromBar) {
          setSelectedPoint(-1)
          return
        }
      }
    } else {
      // Делаем ход
      if (selectedPoint !== clickedPoint && highlightedPoints.has(clickedPoint)) {
        // Находим подходящий кубик для хода
        const validMove = possibleMoves.find(
          move => move.from === selectedPoint && move.to === clickedPoint
        )
        
        console.log('🎲 Делаем ход:', { 
          from: selectedPoint, 
          fromPoint: POINT_NUMBERS[selectedPoint],
          to: clickedPoint, 
          toPoint: POINT_NUMBERS[clickedPoint],
          validMove,
          allPossibleMoves: possibleMoves.filter(m => m.from === selectedPoint)
        })
        
        if (validMove) {
          console.log('✅ Ход валиден, отправляем на сервер')
          onMove(selectedPoint, clickedPoint, validMove.die)
          setSelectedPoint(null)
          setHighlightedPoints(new Set())
        } else {
          console.log('❌ Ход невалиден - не найден в списке возможных ходов')
          console.log('Доступные ходы с точки', POINT_NUMBERS[selectedPoint], ':', possibleMoves.filter(m => m.from === selectedPoint))
        }
      } else if (selectedPoint === clickedPoint) {
        // Клик по уже выбранной точке - отменяем выбор
        console.log('🔄 Отмена выбора точки', { selectedPoint, clickedPoint })
        setSelectedPoint(null)
        setHighlightedPoints(new Set())
      } else {
        // Клик по другой точке, которая не подсвечена - выбираем новую точку если возможно
        const pointValue = points[clickedPoint] || 0
        const isMyChecker = currentPlayer === 0 ? pointValue > 0 : pointValue < 0
        if (isMyChecker) {
          const hasPossibleMoves = possibleMoves.some(move => move.from === clickedPoint)
          if (hasPossibleMoves) {
            console.log(`🔄 Выбираем новую точку ${POINT_NUMBERS[clickedPoint]} (индекс ${clickedPoint})`)
            setSelectedPoint(clickedPoint)
          } else {
            console.log('⚠️ Нет возможных ходов с этой точки, отменяем выбор')
            setSelectedPoint(null)
            setHighlightedPoints(new Set())
          }
        } else {
          // Клик по пустой точке или точке противника - отменяем выбор
          console.log('🔄 Клик по пустой точке или точке противника, отменяем выбор')
          setSelectedPoint(null)
          setHighlightedPoints(new Set())
        }
      }
    }
  }

  const handleRollDice = () => {
    if (!isMyTurn || dice) return
    
    setDiceRolling(true)
    setAnimating(true)
    
    // Анимация броска кубиков
    const rollDuration = 1000
    const startTime = Date.now()
    
    const rollInterval = setInterval(() => {
      if (Date.now() - startTime >= rollDuration) {
        clearInterval(rollInterval)
        setDiceRolling(false)
        setAnimating(false)
        onRollDice()
      } else {
        drawBoard()
      }
    }, 50)
  }

  return (
    <div className="backgammon-board-container">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (dragging) {
            setDragging(null)
            setSelectedPoint(null)
          }
        }}
        className="backgammon-board"
        style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
      />
      {!dice && isMyTurn && (
        <button className="roll-dice-button" onClick={handleRollDice} disabled={animating}>
          {animating ? 'Бросаю...' : 'Бросить кубики'}
        </button>
      )}
      {selectedPoint !== null && (
        <div className="selected-point-indicator">
          Выбрана точка {POINT_NUMBERS[selectedPoint]}
        </div>
      )}
    </div>
  )
}
