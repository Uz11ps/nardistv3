import { useEffect, useRef, useState, useCallback } from 'react'
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
  dice: Dice | null
  onMove: (from: number, to: number, die: number) => void
  onRollDice: () => void
  canMove: boolean
  isMyTurn: boolean
}

export default function BackgammonBoard({
  gameState,
  currentPlayer,
  dice,
  onMove,
  onRollDice,
  canMove,
  isMyTurn,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)

  const points: Point[] = gameState?.points || []
  const bar = gameState?.bar || { white: 0, black: 0 }
  const bearOff = gameState?.bearOff || { white: 0, black: 0 }

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const pointWidth = width / 12
    const boardHeight = height * 0.8
    const barWidth = width * 0.15

    // Очистка
    ctx.clearRect(0, 0, width, height)

    // Фон доски
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(0, 0, width, height)

    // Рисуем точки
    for (let i = 0; i < 24; i++) {
      const point = points[i] || { index: i, checkers: [], color: null }
      const isTop = i < 12
      const x = i < 12 ? (11 - i) * pointWidth : (i - 12) * pointWidth
      const y = isTop ? 0 : boardHeight

      // Треугольник точки
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + pointWidth / 2, y + (isTop ? boardHeight / 2 : -boardHeight / 2))
      ctx.lineTo(x + pointWidth, y)
      ctx.closePath()

      // Цвет точки
      if ((i + Math.floor(i / 6)) % 2 === 0) {
        ctx.fillStyle = '#D2691E'
      } else {
        ctx.fillStyle = '#CD853F'
      }
      ctx.fill()
      ctx.strokeStyle = '#654321'
      ctx.lineWidth = 2
      ctx.stroke()

      // Фишки на точке
      if (point.checkers && point.checkers.length > 0) {
        const checkerColor = point.color === 'white' ? '#FFFFFF' : '#000000'
        const checkerCount = point.checkers.length
        const maxVisible = 5

        for (let j = 0; j < Math.min(checkerCount, maxVisible); j++) {
          const checkerY = isTop
            ? y + boardHeight / 2 - (j + 1) * 20
            : y - boardHeight / 2 + (j + 1) * 20

          // Анимация выбранной фишки
          const isSelected = selectedPoint === i && j === checkerCount - 1
          const scale = isSelected ? 1.3 : 1.0
          const offsetX = isSelected ? (Math.sin(Date.now() / 150) * 4) : 0
          const offsetY = isSelected ? (Math.cos(Date.now() / 150) * 2) : 0

          ctx.save()
          ctx.translate(x + pointWidth / 2 + offsetX, checkerY + offsetY)
          ctx.scale(scale, scale)

          // Тень
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
          ctx.shadowBlur = 5
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2

          // Фишка
          ctx.beginPath()
          ctx.arc(0, 0, 12, 0, Math.PI * 2)
          ctx.fillStyle = checkerColor
          ctx.fill()
          ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#000000' : '#FFFFFF'
          ctx.lineWidth = 2
          ctx.stroke()

          ctx.restore()
        }

        // Показываем количество если больше 5
        if (checkerCount > maxVisible) {
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 14px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(
            checkerCount.toString(),
            x + pointWidth / 2,
            isTop ? y + boardHeight / 2 - 120 : y - boardHeight / 2 + 120
          )
        }
      }

      // Подсветка при наведении
      if (hoverPoint === i && isMyTurn && canMove) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + pointWidth / 2, y + (isTop ? boardHeight / 2 : -boardHeight / 2))
        ctx.lineTo(x + pointWidth, y)
        ctx.closePath()
        
        // Градиентная подсветка
        const gradient = ctx.createLinearGradient(x, y, x + pointWidth, y)
        gradient.addColorStop(0, 'rgba(255, 255, 0, 0.4)')
        gradient.addColorStop(1, 'rgba(255, 51, 51, 0.4)')
        ctx.fillStyle = gradient
        ctx.fill()
        
        // Свечение
        ctx.shadowColor = 'rgba(255, 255, 0, 0.8)'
        ctx.shadowBlur = 15
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }

    // Бар (для сбитых фишек)
    const barX = width / 2 - barWidth / 2
    const barY = boardHeight / 2 - 30

    if (bar.white > 0 || bar.black > 0) {
      ctx.fillStyle = '#654321'
      ctx.fillRect(barX, barY, barWidth, 60)

      // Белые фишки на баре
      for (let i = 0; i < bar.white; i++) {
        ctx.beginPath()
        ctx.arc(barX + barWidth / 2 - 15 + i * 10, barY + 15, 10, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Черные фишки на баре
      for (let i = 0; i < bar.black; i++) {
        ctx.beginPath()
        ctx.arc(barX + barWidth / 2 - 15 + i * 10, barY + 45, 10, 0, Math.PI * 2)
        ctx.fillStyle = '#000000'
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    // Вынос (bear off)
    const bearOffX = width - 40
    const bearOffY = height / 2

    if (bearOff.white > 0) {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(`Белые: ${bearOff.white}`, bearOffX, bearOffY - 20)
    }

    if (bearOff.black > 0) {
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(`Черные: ${bearOff.black}`, bearOffX, bearOffY + 20)
    }

    // Кубики
    if (dice) {
      const diceX = width / 2 - 60
      const diceY = height - 80

      // Анимация броска кубиков
      const rollAnimation = animating ? Math.random() * 360 : 0

      drawDice(ctx, diceX, diceY, dice.die1, rollAnimation)
      drawDice(ctx, diceX + 50, diceY, dice.die2, rollAnimation)
    }
  }, [points, bar, bearOff, selectedPoint, hoverPoint, dice, animating, isMyTurn, canMove])

  const drawDice = (ctx: CanvasRenderingContext2D, x: number, y: number, value: number, rotation: number) => {
    ctx.save()
    ctx.translate(x + 15, y + 15)
    ctx.rotate((rotation * Math.PI) / 180)

    // Кубик
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(-15, -15, 30, 30)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeRect(-15, -15, 30, 30)

    // Точки на кубике
    ctx.fillStyle = '#000000'
    const dotPositions: Record<number, number[][]> = {
      1: [[0, 0]],
      2: [[-8, -8], [8, 8]],
      3: [[-8, -8], [0, 0], [8, 8]],
      4: [[-8, -8], [8, -8], [-8, 8], [8, 8]],
      5: [[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]],
      6: [[-8, -8], [8, -8], [-8, 0], [8, 0], [-8, 8], [8, 8]],
    }

    const positions = dotPositions[value] || []
    positions.forEach(([dx, dy]) => {
      ctx.beginPath()
      ctx.arc(dx, dy, 3, 0, Math.PI * 2)
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
    drawBoard()
  }, [drawBoard])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !canMove) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pointWidth = canvas.width / 12
    const boardHeight = canvas.height * 0.8

    // Определяем на какую точку кликнули
    for (let i = 0; i < 24; i++) {
      const isTop = i < 12
      const pointX = i < 12 ? (11 - i) * pointWidth : (i - 12) * pointWidth
      const pointY = isTop ? 0 : boardHeight

      if (
        x >= pointX &&
        x <= pointX + pointWidth &&
        y >= (isTop ? pointY : pointY - boardHeight / 2) &&
        y <= (isTop ? pointY + boardHeight / 2 : pointY)
      ) {
        if (selectedPoint === null) {
          // Выбираем точку
          const point = points[i]
          if (point && point.checkers && point.checkers.length > 0) {
            const isMyChecker = currentPlayer === 0 ? point.color === 'white' : point.color === 'black'
            if (isMyChecker) {
              setSelectedPoint(i)
            }
          }
        } else {
          // Делаем ход
          if (dice && (selectedPoint !== i)) {
            const die = dice.die1 || dice.die2
            onMove(selectedPoint, i, die)
            setSelectedPoint(null)
          }
        }
        break
      }
    }
  }

  const handleRollDice = () => {
    if (!isMyTurn || dice) return
    setAnimating(true)
    setTimeout(() => {
      setAnimating(false)
      onRollDice()
    }, 500)
  }

  return (
    <div className="backgammon-board-container">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={(e) => {
          const canvas = canvasRef.current
          if (!canvas) return

          const rect = canvas.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top

          const pointWidth = canvas.width / 12
          const boardHeight = canvas.height * 0.8

          let found = false
          for (let i = 0; i < 24; i++) {
            const isTop = i < 12
            const pointX = i < 12 ? (11 - i) * pointWidth : (i - 12) * pointWidth
            const pointY = isTop ? 0 : boardHeight

            if (
              x >= pointX &&
              x <= pointX + pointWidth &&
              y >= (isTop ? pointY : pointY - boardHeight / 2) &&
              y <= (isTop ? pointY + boardHeight / 2 : pointY)
            ) {
              setHoverPoint(i)
              found = true
              break
            }
          }
          if (!found) setHoverPoint(null)
        }}
        className="backgammon-board"
      />
      {!dice && isMyTurn && (
        <button className="roll-dice-button" onClick={handleRollDice}>
          Бросить кубики
        </button>
      )}
    </div>
  )
}

