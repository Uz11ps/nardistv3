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
  player1Skins,
  player2Skins,
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
  
  const [textures, setTextures] = useState<{
    myBoard?: HTMLImageElement
    opponentBoard?: HTMLImageElement
    myDice?: { [face: number]: HTMLImageElement }
    opponentDice?: { [face: number]: HTMLImageElement }
    myCheckers?: HTMLImageElement
    opponentCheckers?: HTMLImageElement
  }>({})
  
  const isPlayer1 = myPlayerId === player1Id
  
  // ЛЕВАЯ ЧАСТЬ - МОИ СКИНЫ И ШАШКИ (независимо от цвета, они слева снизу)
  // ПРАВАЯ ЧАСТЬ - ПРОТИВНИКА (справа сверху)
  const myBoardSkin = isPlayer1 ? player1Skins?.board : player2Skins?.board
  const opponentBoardSkin = isPlayer1 ? player2Skins?.board : player1Skins?.board
  const myDiceSkin = isPlayer1 ? player1Skins?.dice : player2Skins?.dice
  const opponentDiceSkin = isPlayer1 ? player2Skins?.dice : player1Skins?.dice
  const myCheckersSkin = isPlayer1 ? player1Skins?.checkers : player2Skins?.checkers
  const opponentCheckersSkin = isPlayer1 ? player2Skins?.checkers : player1Skins?.checkers
  
  // Загрузка текстур
  useEffect(() => {
    const loadTextures = async () => {
      const loaded: typeof textures = {}
      
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = url.startsWith('http') ? url : `${window.location.origin}${url}`
        })
      }
      
      try {
        // Загружаем текстуру доски (половина для каждого игрока)
        if (myBoardSkin?.boardTextureUrl) {
          loaded.myBoard = await loadImage(myBoardSkin.boardTextureUrl).catch(() => undefined)
        }
        if (opponentBoardSkin?.boardTextureUrl) {
          loaded.opponentBoard = await loadImage(opponentBoardSkin.boardTextureUrl).catch(() => undefined)
        }
        
        // Загружаем текстуры кубиков (6 граней)
        if (myDiceSkin?.diceTextureUrls) {
          const diceFaces: { [face: number]: HTMLImageElement } = {}
          const textureUrls = typeof myDiceSkin.diceTextureUrls === 'string' 
            ? JSON.parse(myDiceSkin.diceTextureUrls) 
            : myDiceSkin.diceTextureUrls
          
          for (let face = 1; face <= 6; face++) {
            if (textureUrls[face]) {
              try {
                diceFaces[face] = await loadImage(textureUrls[face])
              } catch (e) {
                console.warn(`Failed to load dice texture ${face}:`, e)
              }
            }
          }
          if (Object.keys(diceFaces).length > 0) {
            loaded.myDice = diceFaces
          }
        }
        
        if (opponentDiceSkin?.diceTextureUrls) {
          const diceFaces: { [face: number]: HTMLImageElement } = {}
          const textureUrls = typeof opponentDiceSkin.diceTextureUrls === 'string' 
            ? JSON.parse(opponentDiceSkin.diceTextureUrls) 
            : opponentDiceSkin.diceTextureUrls
          
          for (let face = 1; face <= 6; face++) {
            if (textureUrls[face]) {
              try {
                diceFaces[face] = await loadImage(textureUrls[face])
              } catch (e) {
                console.warn(`Failed to load opponent dice texture ${face}:`, e)
              }
            }
          }
          if (Object.keys(diceFaces).length > 0) {
            loaded.opponentDice = diceFaces
          }
        }
        
        // Загружаем текстуры шашек
        if (myCheckersSkin?.checkersTextureUrl) {
          loaded.myCheckers = await loadImage(myCheckersSkin.checkersTextureUrl).catch(() => undefined)
        }
        if (opponentCheckersSkin?.checkersTextureUrl) {
          loaded.opponentCheckers = await loadImage(opponentCheckersSkin.checkersTextureUrl).catch(() => undefined)
        }
        
        setTextures(loaded)
      } catch (error) {
        console.error('Ошибка загрузки текстур:', error)
      }
    }
    
    loadTextures()
  }, [myBoardSkin, opponentBoardSkin, myDiceSkin, opponentDiceSkin, myCheckersSkin, opponentCheckersSkin])
  
  // Получение возможных ходов
  useEffect(() => {
    if (!gameId || !isMyTurn || !canMove || !dice) return
    
    const fetchPossibleMoves = async () => {
      try {
        const response = await apiClient.get(`/games/${gameId}/possible-moves`)
        const moves = response.data?.moves || []
        setPossibleMoves(moves.flat() || [])
        
        const highlighted = new Set<number>()
        moves.flat().forEach((move: any) => {
          highlighted.add(move.from)
          highlighted.add(move.to)
        })
        setHighlightedPoints(highlighted)
      } catch (error) {
        console.error('Ошибка получения возможных ходов:', error)
      }
    }
    
    fetchPossibleMoves()
  }, [gameId, isMyTurn, canMove, dice, gameState])
  
  // Определение позиции для кубиков (на части доски, чей ход)
  useEffect(() => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    // Кубики кидаются на половину доски, чей ход
    // Если мой ход - кубики на левой половине доски (моя половина = две четверти)
    // Если ход противника - кубики на правой половине доски (его половина = две четверти)
    const isMyTurnNow = isMyTurn && canMove
    
    if (isMyTurnNow) {
      // Моя половина доски (левая половина = две четверти)
      setDice3DPosition({
        x: width * 0.25,
        y: height * 0.5,
        size: Math.min(width, height) * 0.08,
      })
    } else {
      // Половина противника (правая половина = две четверти)
      setDice3DPosition({
        x: width * 0.75,
        y: height * 0.5,
        size: Math.min(width, height) * 0.08,
      })
    }
  }, [isMyTurn, canMove])
  
  // Отрисовка доски
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx || !gameState) return
    
    const width = canvas.width
    const height = canvas.height
    
    // Сбрасываем трансформации
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    
    const halfWidth = width / 2
    const halfHeight = height / 2
    const quarterHeight = height / 4
    
    // ЛЕВАЯ ПОЛОВИНА ДОСКИ - МОЯ (две четверти: верхняя левая + нижняя левая)
    // Рисуем всю левую половину доски
    if (textures.myBoard) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, halfWidth, height)
      ctx.clip()
      // Рисуем текстуру доски на всю левую половину (две четверти)
      ctx.drawImage(textures.myBoard, 0, 0, halfWidth, height)
      ctx.restore()
    } else {
      // Дефолтная текстура - коричневая доска
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(0, 0, halfWidth, height)
    }
    
    // ПРАВАЯ ПОЛОВИНА ДОСКИ - ПРОТИВНИКА (две четверти: верхняя правая + нижняя правая)
    // Рисуем всю правую половину доски
    if (textures.opponentBoard) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(halfWidth, 0, halfWidth, height)
      ctx.clip()
      // Рисуем текстуру доски на всю правую половину (две четверти)
      ctx.drawImage(textures.opponentBoard, halfWidth, 0, halfWidth, height)
      ctx.restore()
    } else {
      // Дефолтная текстура
      ctx.fillStyle = '#654321'
      ctx.fillRect(halfWidth, 0, halfWidth, height)
    }
    
    // Отрисовка точек (24 точки на доске для нардов)
    const points = gameState.points || []
    const pointWidth = width / 12
    const pointHeight = halfHeight / 2
    
    points.forEach((pointValue: number, pointIndex: number) => {
      if (pointValue === 0) return
      
      // Определяем позицию точки
      // Точки 1-12: верхний ряд (правая часть доски - противник)
      // Точки 13-24: нижний ряд (левая часть доски - я)
      const isTopRow = pointIndex < 12
      const pointInRow = pointIndex % 12
      
      // Определяем, моя это точка или противника
      // В нардах: положительные значения - один игрок, отрицательные - другой
      const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
      
      const x = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const y = isTopRow
        ? pointHeight
        : halfHeight + pointHeight
      
      const checkerCount = Math.abs(pointValue)
      const checkerSize = Math.min(pointWidth * 0.35, pointHeight * 0.4)
      const checkerTexture = isMyPoint ? textures.myCheckers : textures.opponentCheckers
      
      // Отрисовываем шашки
      const stackHeight = Math.min(checkerCount, 5) * checkerSize * 0.6
      const startY = isTopRow ? y - stackHeight : y
      
      // Если перетаскиваем шашку с этой точки, не рисуем её здесь
      const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
      const checkersToDraw = isDraggingFromThisPoint ? Math.min(checkerCount - 1, 5) : Math.min(checkerCount, 5)
      
      for (let i = 0; i < checkersToDraw; i++) {
        const checkerY = isTopRow 
          ? startY + i * checkerSize * 0.6
          : startY + i * checkerSize * 0.6
        
        if (checkerTexture) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(x, checkerY, checkerSize / 2, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(
            checkerTexture,
            x - checkerSize / 2,
            checkerY - checkerSize / 2,
            checkerSize,
            checkerSize
          )
          ctx.restore()
        } else {
          // Дефолтные шашки
          ctx.fillStyle = isMyPoint ? '#FFFFFF' : '#000000'
          ctx.beginPath()
          ctx.arc(x, checkerY, checkerSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#333'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
      
      // Рисуем перетаскиваемую шашку
      if (isDraggingFromThisPoint && dragPosition) {
        const checkerSize = Math.min(pointWidth * 0.35, pointHeight * 0.4)
        const dragX = dragPosition.x - dragging.offsetX
        const dragY = dragPosition.y - dragging.offsetY
        
        ctx.save()
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.arc(dragX, dragY, checkerSize / 2, 0, Math.PI * 2)
        ctx.clip()
        if (checkerTexture) {
          ctx.drawImage(
            checkerTexture,
            dragX - checkerSize / 2,
            dragY - checkerSize / 2,
            checkerSize,
            checkerSize
          )
        } else {
          ctx.fillStyle = isMyPoint ? '#FFFFFF' : '#000000'
          ctx.beginPath()
          ctx.arc(dragX, dragY, checkerSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#333'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        ctx.restore()
      }
      
      // Если шашек больше 5, показываем число (только количество, не номер поля)
      if (checkerCount > 5) {
        ctx.fillStyle = '#FFF'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(x - 20, isTopRow ? y - stackHeight - 25 : y + stackHeight + 5, 40, 20)
        ctx.fillStyle = '#000'
        ctx.fillText(checkerCount.toString(), x, isTopRow ? y - stackHeight - 12 : y + stackHeight + 18)
      }
      
      // Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.4)'
        ctx.beginPath()
        ctx.arc(x, y, pointWidth / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      
      // Подсветка возможных ходов
      if (highlightedPoints.has(pointIndex)) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, pointWidth / 2 + 5, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
    
    // Отрисовка бара (середина доски)
    const barX = width / 2
    if (gameState.bar) {
      const bar = gameState.bar
      const myBarCount = isPlayer1 ? bar.white || 0 : bar.black || 0
      const opponentBarCount = isPlayer1 ? bar.black || 0 : bar.white || 0
      const checkerSize = Math.min(pointWidth * 0.35, pointHeight * 0.4)
      
      // Мои шашки на баре (снизу, слева от центра)
      if (myBarCount > 0) {
        for (let i = 0; i < myBarCount; i++) {
          const barY = halfHeight + (i * checkerSize * 0.6) + checkerSize
          if (textures.myCheckers) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(barX - 20, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(textures.myCheckers, barX - 20 - checkerSize / 2, barY - checkerSize / 2, checkerSize, checkerSize)
            ctx.restore()
          } else {
            ctx.fillStyle = '#FFFFFF'
            ctx.beginPath()
            ctx.arc(barX - 20, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#333'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }
      }
      
      // Шашки противника на баре (сверху, справа от центра)
      if (opponentBarCount > 0) {
        for (let i = 0; i < opponentBarCount; i++) {
          const barY = halfHeight - (i * checkerSize * 0.6) - checkerSize
          if (textures.opponentCheckers) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(barX + 20, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(textures.opponentCheckers, barX + 20 - checkerSize / 2, barY - checkerSize / 2, checkerSize, checkerSize)
            ctx.restore()
          } else {
            ctx.fillStyle = '#000000'
            ctx.beginPath()
            ctx.arc(barX + 20, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#333'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }
      }
    }
  }, [gameState, textures, selectedPoint, highlightedPoints, isPlayer1, dragging, dragPosition])
  
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
  
  // Обновление размера canvas при изменении размера контейнера
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
    
    const width = canvas.width
    const height = canvas.height
    const halfWidth = width / 2
    const halfHeight = height / 2
    const pointWidth = width / 12
    const pointHeight = halfHeight / 2
    
    // Определяем на какую точку кликнули
    const points = gameState?.points || []
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const pointValue = points[pointIndex]
      if (pointValue === 0) continue
      
      const isTopRow = pointIndex < 12
      const pointInRow = pointIndex % 12
      
      const pointX = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const pointY = isTopRow
        ? pointHeight
        : halfHeight + pointHeight
      
      // Проверяем, кликнули ли на шашку
      const checkerCount = Math.abs(pointValue)
      const checkerSize = Math.min(pointWidth * 0.35, pointHeight * 0.4)
      const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
      
      if (!isMyPoint) continue // Не можем перетаскивать чужие шашки
      
      // Проверяем, есть ли возможные ходы с этой точки
      const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
      if (pointMoves.length === 0) continue
      
      // Проверяем расстояние до шашек на этой точке
      const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2))
      if (distance < checkerSize / 2 + 10) {
        setDragging({ pointIndex, offsetX: x - pointX, offsetY: y - pointY })
        setDragPosition({ x, y })
        setSelectedPoint(pointIndex)
        return
      }
    }
  }
  
  // Обработка движения мыши при перетаскивании
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setDragPosition({ x, y })
  }
  
  // Обработка отпускания мыши
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const width = canvas.width
    const height = canvas.height
    const halfWidth = width / 2
    const halfHeight = height / 2
    const pointWidth = width / 12
    const pointHeight = halfHeight / 2
    
    // Определяем на какую точку перетащили
    const points = gameState?.points || []
    let targetPoint: number | null = null
    
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const isTopRow = pointIndex < 12
      const pointInRow = pointIndex % 12
      
      const pointX = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const pointY = isTopRow
        ? pointHeight
        : halfHeight + pointHeight
      
      const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2))
      if (distance < pointWidth / 2) {
        targetPoint = pointIndex
        break
      }
    }
    
    // Если перетащили на валидную точку, делаем ход
    if (targetPoint !== null && dragging.pointIndex !== targetPoint) {
      const move = possibleMoves.find(m => m.from === dragging.pointIndex && m.to === targetPoint)
      if (move) {
        onMove(move.from, move.to, move.die)
      }
    }
    
    setDragging(null)
    setDragPosition(null)
    setSelectedPoint(null)
  }
  
  // Обработка клика по точке (для совместимости)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) return // Если перетаскиваем, не обрабатываем клик
    
    if (!canMove || !isMyTurn || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const width = canvas.width
    const height = canvas.height
    const halfWidth = width / 2
    const halfHeight = height / 2
    const pointWidth = width / 12
    const pointHeight = halfHeight / 2
    
    // Определяем на какую точку кликнули
    const points = gameState?.points || []
    points.forEach((pointValue: number, pointIndex: number) => {
      const isTopRow = pointIndex < 12
      const pointInRow = pointIndex % 12
      
      const pointX = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const pointY = isTopRow
        ? pointHeight
        : halfHeight + pointHeight
      
      const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2))
      if (distance < pointWidth / 2) {
        handlePointClick(pointIndex)
      }
    })
  }
  
  const handlePointClick = (pointIndex: number) => {
    if (!canMove || !isMyTurn) return
    
    if (selectedPoint === null) {
      // Выбираем точку для хода
      const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
      if (pointMoves.length > 0) {
        setSelectedPoint(pointIndex)
      }
    } else {
      // Делаем ход
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
  
  // Определяем, чьи кубики показывать
  const currentDiceTextures = isMyTurn && canMove ? textures.myDice : textures.opponentDice
  
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
      
      {/* Кубики - отображаются на части доски, чей ход */}
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
            diceTextures={currentDiceTextures}
          />
        </div>
      )}
    </div>
  )
}
