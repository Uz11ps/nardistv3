import { useEffect, useRef, useState, useCallback } from 'react'
import { apiClient } from '../api/client'
import Dice3D from './Dice3D'
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

const POINT_NUMBERS = [
  24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13,
  12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
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
  gameMode = 'long',
  player1Skins,
  player2Skins,
  diceAnimating = false,
  myPlayerId,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [diceRolling, setDiceRolling] = useState(false)
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number }>>([])
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())
  const animationFrameRef = useRef<number>()
  const [dice3DPositions, setDice3DPositions] = useState<{ x: number; y: number; size: number; spacing: number } | null>(null)
  
  const [dragging, setDragging] = useState(false)
  const [dragFromPoint, setDragFromPoint] = useState<number | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragHoverPoint, setDragHoverPoint] = useState<number | null>(null)
  
  // Текстуры скинов
  const [textures, setTextures] = useState<{
    myBoard?: HTMLImageElement
    opponentBoard?: HTMLImageElement
    myDice?: { [face: number]: HTMLImageElement }
    opponentDice?: { [face: number]: HTMLImageElement }
    myCheckers?: HTMLImageElement
    opponentCheckers?: HTMLImageElement
  }>({})
  
  const isPlayer1 = myPlayerId === player1Id
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
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = url
        })
      }
      
      // 1. Моя доска (левая сторона)
      if (myBoardSkin?.boardTextureUrl) {
        try {
          loaded.myBoard = await loadImage(myBoardSkin.boardTextureUrl)
        } catch (e) {
          console.error('Failed to load my board texture:', e)
        }
      }
      
      // 2. Доска оппонента (правая сторона)
      if (opponentBoardSkin?.boardTextureUrl) {
        try {
          loaded.opponentBoard = await loadImage(opponentBoardSkin.boardTextureUrl)
        } catch (e) {
          console.error('Failed to load opponent board texture:', e)
        }
      }
      
      // 3. Мои кубики (6 граней)
      loaded.myDice = {}
      const myDiceUrls = myDiceSkin?.diceTextureUrls || {}
      if (Object.keys(myDiceUrls).length > 0) {
        for (let face = 1; face <= 6; face++) {
          if (myDiceUrls[face]) {
            try {
              loaded.myDice[face] = await loadImage(myDiceUrls[face])
            } catch (e) {
              console.error(`Failed to load my dice texture face ${face}:`, e)
            }
          }
        }
      } else if (myDiceSkin?.diceTextureUrl) {
        // Fallback: одна текстура для всех граней
        try {
          const img = await loadImage(myDiceSkin.diceTextureUrl)
          loaded.myDice = { 1: img, 2: img, 3: img, 4: img, 5: img, 6: img }
        } catch (e) {
          console.error('Failed to load my dice texture:', e)
        }
      }
      
      // 4. Кубики оппонента (6 граней)
      loaded.opponentDice = {}
      const opponentDiceUrls = opponentDiceSkin?.diceTextureUrls || {}
      if (Object.keys(opponentDiceUrls).length > 0) {
        for (let face = 1; face <= 6; face++) {
          if (opponentDiceUrls[face]) {
            try {
              loaded.opponentDice[face] = await loadImage(opponentDiceUrls[face])
            } catch (e) {
              console.error(`Failed to load opponent dice texture face ${face}:`, e)
            }
          }
        }
      } else if (opponentDiceSkin?.diceTextureUrl) {
        try {
          const img = await loadImage(opponentDiceSkin.diceTextureUrl)
          loaded.opponentDice = { 1: img, 2: img, 3: img, 4: img, 5: img, 6: img }
        } catch (e) {
          console.error('Failed to load opponent dice texture:', e)
        }
      }
      
      // 5. Мои шашки (внизу на доске)
      const myCheckersUrl = isPlayer1
        ? (myCheckersSkin?.whiteCheckersTextureUrl || myCheckersSkin?.checkersTextureUrl)
        : (myCheckersSkin?.blackCheckersTextureUrl || myCheckersSkin?.checkersTextureUrl)
      if (myCheckersUrl) {
        try {
          loaded.myCheckers = await loadImage(myCheckersUrl)
        } catch (e) {
          console.error('Failed to load my checkers texture:', e)
        }
      }
      
      // 6. Шашки оппонента (вверху на доске)
      const opponentCheckersUrl = isPlayer1
        ? (opponentCheckersSkin?.blackCheckersTextureUrl || opponentCheckersSkin?.checkersTextureUrl)
        : (opponentCheckersSkin?.whiteCheckersTextureUrl || opponentCheckersSkin?.checkersTextureUrl)
      if (opponentCheckersUrl) {
        try {
          loaded.opponentCheckers = await loadImage(opponentCheckersUrl)
        } catch (e) {
          console.error('Failed to load opponent checkers texture:', e)
        }
      }
      
      setTextures(loaded)
    }
    
    loadTextures()
  }, [myBoardSkin, opponentBoardSkin, myDiceSkin, opponentDiceSkin, myCheckersSkin, opponentCheckersSkin, isPlayer1])
  
  const shouldMirror = !isPlayer1
  const myPlayerIndex = isPlayer1 ? 0 : 1
  
  const mirrorPointIndex = (index: number): number => {
    if (index < 0 || index >= 24) return index
    return 23 - index
  }
  
  const unmirrorPointIndex = (index: number): number => {
    if (index < 0 || index >= 24) return index
    return 23 - index
  }
  
  // Обработка gameState
  const pointsRaw = gameState?.points || []
  let points: number[] = Array.isArray(pointsRaw)
    ? pointsRaw.map((p: any) => {
        if (typeof p === 'number') return p
        if (p && typeof p === 'object') {
          if ('checkers' in p && Array.isArray(p.checkers)) {
            const count = p.checkers.length
            return p.color === 'white' ? count : -count
          }
          if ('value' in p && typeof p.value === 'number') {
            return p.value
          }
        }
        return 0
      })
    : []
  
  if (shouldMirror) {
    const mirrored: number[] = new Array(24)
    for (let i = 0; i < 24; i++) {
      mirrored[i] = -points[mirrorPointIndex(i)]
    }
    points = mirrored
  }
  
  let bar = gameState?.bar || { white: 0, black: 0 }
  let bearOff = gameState?.borneOff || gameState?.bearOff || { white: 0, black: 0 }
  
  if (Array.isArray(bar)) {
    bar = { white: bar[0] || 0, black: bar[1] || 0 }
  }
  if (Array.isArray(bearOff)) {
    bearOff = { white: bearOff[0] || 0, black: bearOff[1] || 0 }
  }
  
  if (shouldMirror) {
    bar = { white: bar.black, black: bar.white }
    bearOff = { white: bearOff.black, black: bearOff.white }
  }
  
  const diceArray: number[] = dice
    ? Array.isArray(dice)
      ? dice
      : [dice.die1, dice.die2]
    : []
  
  useEffect(() => {
    if (gameId && diceArray.length > 0 && isMyTurn && canMove) {
      apiClient
        .get(`/games/${gameId}/possible-moves`)
        .then((response: any) => {
          const allMoves = response.data?.allMoves || []
          const movesSet = new Set<string>()
          allMoves.forEach((moveSeq: any[]) => {
            moveSeq.forEach((move: any) => {
              movesSet.add(`${move.from}-${move.to}-${move.die}`)
            })
          })
          
          const uniqueMoves = Array.from(movesSet).map((key) => {
            let [from, to, die] = key.split('-').map(Number)
            if (shouldMirror) {
              from = from === -1 ? -1 : mirrorPointIndex(from)
              to = to === -1 ? -1 : mirrorPointIndex(to)
            }
            return { from, to, die }
          })
          
          setPossibleMoves(uniqueMoves)
        })
        .catch((error) => {
          console.error('Error loading possible moves:', error)
          setPossibleMoves([])
        })
    } else {
      setPossibleMoves([])
      setHighlightedPoints(new Set())
      setSelectedPoint(null)
    }
  }, [gameId, diceArray.join(','), isMyTurn, canMove, gameState?.currentPlayer, shouldMirror])
  
  useEffect(() => {
    if (gameId && selectedPoint !== null && diceArray.length > 0 && isMyTurn && canMove) {
      const originalPointIndex = shouldMirror ? unmirrorPointIndex(selectedPoint) : selectedPoint
      
      const quickHighlights = new Set<number>()
      const filteredMoves = possibleMoves.filter((move) => {
        return selectedPoint === -1 ? move.from === -1 : move.from === selectedPoint
      })
      filteredMoves.forEach((move) => {
        if (move.to >= 0 && move.to < 24) {
          quickHighlights.add(move.to)
        }
      })
      if (quickHighlights.size > 0) {
        setHighlightedPoints(quickHighlights)
      }
      
      apiClient
        .get(`/games/${gameId}/possible-moves/${originalPointIndex}`)
        .then((response: any) => {
          const movesFromPoint = response.data?.movesFromPoint || []
          const highlights = new Set<number>()
          movesFromPoint.forEach((move: any) => {
            if (move.to >= 0 && move.to < 24) {
              const displayIndex = shouldMirror ? mirrorPointIndex(move.to) : move.to
              highlights.add(displayIndex)
            }
          })
          setHighlightedPoints(highlights)
        })
        .catch(() => {})
    } else if (selectedPoint === null) {
      setHighlightedPoints(new Set())
    }
  }, [gameId, selectedPoint, diceArray.join(','), isMyTurn, canMove, shouldMirror, possibleMoves])
  
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const container = canvas.parentElement
    if (!container) return
    
    let containerWidth = container.clientWidth
    let containerHeight = container.clientHeight
    
    if (containerHeight > containerWidth * 0.5) {
      containerHeight = containerWidth * 0.5
    }
    
    if (containerWidth < 400) {
      containerWidth = 400
      containerHeight = 200
    }
    
    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    
    ctx.scale(dpr, dpr)
    
    const width = containerWidth
    const height = containerHeight
    const boardPadding = 0
    const boardWidth = width
    const boardHeight = height
    const pointWidth = boardWidth / 12
    const pointHeight = boardHeight / 2
    const barWidth = boardWidth * 0.12
    const barHeight = boardHeight * 0.3
    
    const barX = (boardWidth - barWidth) / 2
    const barY = (boardHeight - barHeight) / 2
    const barLeftX = barX
    const barRightX = barX + barWidth
    
    ctx.clearRect(0, 0, width, height)
    
    // Рисуем доски: слева моя, справа оппонента
    if (textures.myBoard) {
      ctx.drawImage(textures.myBoard, 0, 0, barLeftX, height)
    } else {
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(0, 0, barLeftX, height)
    }
    
    if (textures.opponentBoard) {
      const rightWidth = width - barRightX
      ctx.drawImage(textures.opponentBoard, barRightX, 0, rightWidth, height)
    } else {
      ctx.fillStyle = '#654321'
      ctx.fillRect(barRightX, 0, width - barRightX, height)
    }
    
    // Центральный бар
    ctx.fillStyle = '#4a4a4a'
    ctx.fillRect(barLeftX, 0, barWidth, height)
    
    // Рисуем точки и шашки
    for (let i = 0; i < 24; i++) {
      const pointNum = POINT_NUMBERS[i]
      const isTop = i < 12
      
      let x: number
      if (i < 12) {
        x = (11 - i) * pointWidth
      } else {
        x = (i - 12) * pointWidth
      }
      const y = isTop ? 0 : boardHeight
      
      // Номер точки
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#654321'
      ctx.lineWidth = 2
      const numY = isTop ? y + pointHeight - 5 : y - pointHeight + 15
      ctx.strokeText(pointNum.toString(), x + pointWidth / 2, numY)
      ctx.fillText(pointNum.toString(), x + pointWidth / 2, numY)
      
      // Шашки на точке
      const pointValue = points[i] || 0
      const checkerCount = Math.abs(pointValue)
      if (checkerCount > 0) {
        const isMyChecker = pointValue > 0
        const checkerColor = isMyChecker ? '#FFFFFF' : '#1a1a1a'
        const checkerRadius = 14
        const maxStack = 5
        const stackSpacing = 4
        
        const isDraggingFromThisPoint = dragging && dragFromPoint === i
        const checkersToDraw = isDraggingFromThisPoint
          ? Math.min(checkerCount - 1, maxStack)
          : Math.min(checkerCount, maxStack)
        
        for (let j = 0; j < checkersToDraw; j++) {
          let checkerY: number
          if (isTop) {
            checkerY = y + (j * stackSpacing) + checkerRadius
          } else {
            checkerY = y - (j * stackSpacing) - checkerRadius
          }
          
          const checkerX = x + pointWidth / 2
          
          const isSelected = !isDraggingFromThisPoint && selectedPoint === i && j === checkersToDraw - 1
          const scale = isSelected ? 1.2 : 1.0
          const offsetX = isSelected ? Math.sin(Date.now() / 100) * 3 : 0
          const offsetY = isSelected ? Math.cos(Date.now() / 100) * 2 : 0
          
          ctx.save()
          ctx.translate(checkerX + offsetX, checkerY + offsetY)
          ctx.scale(scale, scale)
          
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
          ctx.shadowBlur = 8
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
          
          const checkerTexture = isMyChecker ? textures.myCheckers : textures.opponentCheckers
          
          if (checkerTexture) {
            ctx.beginPath()
            ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
            ctx.save()
            ctx.clip()
            ctx.drawImage(checkerTexture, -checkerRadius, -checkerRadius, checkerRadius * 2, checkerRadius * 2)
            ctx.restore()
            
            ctx.beginPath()
            ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
            ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
            ctx.lineWidth = 2
            ctx.stroke()
          } else {
            ctx.fillStyle = checkerColor
            ctx.beginPath()
            ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
            ctx.lineWidth = 2
            ctx.stroke()
          }
          
          ctx.restore()
        }
        
        if (checkerCount > maxStack) {
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px Arial'
          ctx.textAlign = 'center'
          const countTextY = isTop
            ? y + maxStack * stackSpacing + checkerRadius + 15
            : y - maxStack * stackSpacing - checkerRadius - 10
          ctx.fillText(checkerCount.toString(), x + pointWidth / 2, countTextY)
        }
      }
      
      // Подсветка выбранной точки
      if (selectedPoint === i && isMyTurn && canMove) {
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
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      
      // Подсветка возможных ходов
      const isHighlighted = highlightedPoints.has(i) && isMyTurn && canMove &&
        ((selectedPoint !== null && selectedPoint !== i) || (dragging && dragFromPoint !== null && dragFromPoint !== i))
      if (isHighlighted) {
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
        const isDragTarget = dragging && dragHoverPoint === i
        ctx.fillStyle = isDragTarget ? 'rgba(0, 255, 0, 0.8)' : 'rgba(0, 255, 0, 0.6)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(0, 255, 0, 1.0)'
        ctx.lineWidth = isDragTarget ? 5 : 4
        ctx.stroke()
      }
      
      // Подсветка при наведении
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
    
    // Бар
    const barCenterX = barX + barWidth / 2
    const barCenterY = barY + barHeight / 2
    
    if (bar.white > 0) {
      for (let i = 0; i < Math.min(bar.white, 5); i++) {
        const checkerX = barCenterX - 20 + (i % 3) * 15
        const checkerY = barCenterY - 5 + Math.floor(i / 3) * 15
        
        ctx.save()
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
        
        if (textures.opponentCheckers) {
          ctx.beginPath()
          ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
          ctx.save()
          ctx.clip()
          ctx.drawImage(textures.opponentCheckers, checkerX - 12, checkerY - 12, 24, 24)
          ctx.restore()
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 2
          ctx.stroke()
        } else {
          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath()
          ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 2
          ctx.stroke()
        }
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
        
        if (textures.myCheckers) {
          ctx.beginPath()
          ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
          ctx.save()
          ctx.clip()
          ctx.drawImage(textures.myCheckers, checkerX - 12, checkerY - 12, 24, 24)
          ctx.restore()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 2
          ctx.stroke()
        } else {
          ctx.fillStyle = '#1a1a1a'
          ctx.beginPath()
          ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        ctx.restore()
      }
      
      if (bar.black > 5) {
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 12px Arial'
        ctx.fillText(bar.black.toString(), barCenterX + 25, barCenterY + 20)
      }
    }
    
    // Вынос
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
    
    // Кубики
    const diceAreaX = boardPadding + 20
    const diceAreaY = height - 100
    const diceSize = 40
    const diceSpacing = 50
    
    if (diceAnimating || diceRolling) {
      setDice3DPositions({ x: diceAreaX, y: diceAreaY, size: diceSize, spacing: diceSpacing })
    } else {
      setDice3DPositions(null)
    }
    
    if ((dice || diceRolling) && !diceAnimating) {
      const diceTextures = textures.myDice
      
      if (diceRolling && !diceAnimating) {
        const roll1 = Math.floor(Math.random() * 6) + 1
        const roll2 = Math.floor(Math.random() * 6) + 1
        const texture1 = diceTextures?.[roll1]
        const texture2 = diceTextures?.[roll2]
        drawDice(ctx, diceAreaX, diceAreaY, roll1, diceSize, true, false, texture1)
        drawDice(ctx, diceAreaX + diceSpacing, diceAreaY, roll2, diceSize, true, false, texture2)
      } else if (diceArray.length > 0) {
        diceArray.forEach((die, index) => {
          const texture = diceTextures?.[die]
          drawDice(ctx, diceAreaX + index * diceSpacing, diceAreaY, die, diceSize, false, false, texture)
        })
      }
    }
    
    // Перетаскиваемая шашка
    if (dragging && dragFromPoint !== null && dragPosition) {
      const pointValue = points[dragFromPoint] || 0
      const isPlayer1Checker = pointValue > 0
      const checkerColor = isPlayer1Checker ? '#FFFFFF' : '#1a1a1a'
      const checkerRadius = 14
      
      ctx.save()
      ctx.translate(dragPosition.x, dragPosition.y)
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
      ctx.shadowBlur = 12
      ctx.shadowOffsetX = 4
      ctx.shadowOffsetY = 4
      
      if (textures.myCheckers) {
        ctx.beginPath()
        ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
        ctx.save()
        ctx.clip()
        ctx.drawImage(textures.myCheckers, -checkerRadius, -checkerRadius, checkerRadius * 2, checkerRadius * 2)
        ctx.restore()
        ctx.beginPath()
        ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
        ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      } else {
        ctx.fillStyle = checkerColor
        ctx.beginPath()
        ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      
      ctx.restore()
    }
  }, [
    points, bar, bearOff, selectedPoint, hoverPoint, highlightedPoints, dice, diceRolling, diceAnimating,
    isMyTurn, canMove, dragging, dragFromPoint, dragPosition, textures
  ])
  
  const drawDice = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    value: number,
    size: number,
    rolling: boolean,
    dropping: boolean,
    diceTexture?: HTMLImageElement
  ) => {
    if (!diceTexture) {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(x, y, size, size)
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, size, size)
      
      ctx.fillStyle = '#1a1a1a'
      const dotSize = size / 6
      const dotPositions: { [key: number]: Array<[number, number]> } = {
        1: [[size / 2, size / 2]],
        2: [[size / 4, size / 4], [3 * size / 4, 3 * size / 4]],
        3: [[size / 4, size / 4], [size / 2, size / 2], [3 * size / 4, 3 * size / 4]],
        4: [[size / 4, size / 4], [3 * size / 4, size / 4], [size / 4, 3 * size / 4], [3 * size / 4, 3 * size / 4]],
        5: [[size / 4, size / 4], [3 * size / 4, size / 4], [size / 2, size / 2], [size / 4, 3 * size / 4], [3 * size / 4, 3 * size / 4]],
        6: [[size / 4, size / 4], [3 * size / 4, size / 4], [size / 4, size / 2], [3 * size / 4, size / 2], [size / 4, 3 * size / 4], [3 * size / 4, 3 * size / 4]],
      }
      const dots = dotPositions[value] || []
      dots.forEach(([dx, dy]) => {
        ctx.beginPath()
        ctx.arc(x + dx, y + dy, dotSize, 0, Math.PI * 2)
        ctx.fill()
      })
      return
    }
    
    ctx.save()
    let drawX = x
    let drawY = y
    
    if (rolling) {
      const rotation = (Date.now() / 50) % 360
      ctx.translate(drawX + size / 2, drawY + size / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-size / 2, -size / 2)
      drawX = 0
      drawY = 0
    }
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 3
    
    ctx.drawImage(diceTexture, drawX, drawY, size, size)
    
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.strokeRect(drawX, drawY, size, size)
    
    ctx.restore()
  }
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const resizeCanvas = () => {
      drawBoard()
    }
    
    const container = canvas.parentElement
    if (!container) return
    
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    
    resizeObserver.observe(container)
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('orientationchange', resizeCanvas)
    
    resizeCanvas()
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('orientationchange', resizeCanvas)
    }
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
    
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const boardWidth = width
    const boardHeight = height
    const pointWidth = boardWidth / 12
    const pointHeight = boardHeight / 2
    
    for (let i = 0; i < 24; i++) {
      const isTop = i < 12
      let pointX: number
      
      if (i < 12) {
        pointX = (11 - i) * pointWidth
      } else {
        pointX = (i - 12) * pointWidth
      }
      
      const pointY = isTop ? 0 : boardHeight
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
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (dragging && dragFromPoint !== null) {
      setDragPosition({ x, y })
      const hoveredPoint = getPointFromCoords(x, y)
      setDragHoverPoint(hoveredPoint)
      return
    }
    
    const hoveredPoint = getPointFromCoords(x, y)
    setHoverPoint(hoveredPoint)
  }
  
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !canMove || diceArray.length === 0) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const clickedPoint = getPointFromCoords(x, y)
    if (clickedPoint === null || clickedPoint < 0 || clickedPoint >= 24) return
    
    const pointValue = points[clickedPoint] || 0
    const myPlayerIndexMirrored = shouldMirror ? (myPlayerIndex === 0 ? 1 : 0) : myPlayerIndex
    const checkerCount = myPlayerIndexMirrored === 0 ? (pointValue > 0 ? pointValue : 0) : (pointValue < 0 ? Math.abs(pointValue) : 0)
    const isMyChecker = myPlayerIndexMirrored === 0 ? pointValue > 0 : pointValue < 0
    
    if (isMyChecker && checkerCount > 0) {
      const hasPossibleMoves = possibleMoves.some(move => move.from === clickedPoint)
      if (hasPossibleMoves) {
        setDragging(true)
        setDragFromPoint(clickedPoint)
        setDragPosition({ x, y })
        setSelectedPoint(clickedPoint)
      }
    }
  }
  
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || dragFromPoint === null) {
      handleCanvasClick(e)
      return
    }
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const dropPoint = getPointFromCoords(x, y)
    
    setDragging(false)
    const fromPoint = dragFromPoint
    setDragFromPoint(null)
    setDragPosition(null)
    setDragHoverPoint(null)
    
    if (dropPoint !== null && dropPoint >= 0 && dropPoint < 24 && highlightedPoints.has(dropPoint)) {
      const validMove = possibleMoves.find(
        move => move.from === fromPoint && move.to === dropPoint
      )
      
      if (validMove) {
        const originalFrom = shouldMirror ? unmirrorPointIndex(fromPoint) : fromPoint
        const originalTo = shouldMirror ? unmirrorPointIndex(dropPoint) : dropPoint
        onMove(originalFrom, originalTo, validMove.die)
        setSelectedPoint(null)
        setHighlightedPoints(new Set())
        return
      }
    }
    
    setSelectedPoint(null)
    setHighlightedPoints(new Set())
  }
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !canMove || diceArray.length === 0) return
    
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
      const myPlayerIndexMirrored = shouldMirror ? (myPlayerIndex === 0 ? 1 : 0) : myPlayerIndex
      const hasBarCheckers = (myPlayerIndexMirrored === 0 && bar.white > 0) || (myPlayerIndexMirrored === 1 && bar.black > 0)
      
      if (clickedPoint >= 0 && clickedPoint < 24) {
        const pointValue = points[clickedPoint] || 0
        if (pointValue !== 0) {
          const checkerCount = myPlayerIndexMirrored === 0 ? (pointValue > 0 ? pointValue : 0) : (pointValue < 0 ? Math.abs(pointValue) : 0)
          const isMyChecker = myPlayerIndexMirrored === 0 ? pointValue > 0 : pointValue < 0
          if (isMyChecker && checkerCount > 0) {
            const hasPossibleMoves = possibleMoves.some(move => move.from === clickedPoint)
            if (hasPossibleMoves) {
              setSelectedPoint(clickedPoint)
              return
            }
          }
        }
      }
      
      if (hasBarCheckers) {
        const hasPossibleMovesFromBar = possibleMoves.some(move => move.from === -1)
        if (hasPossibleMovesFromBar) {
          setSelectedPoint(-1)
          return
        }
      }
    } else {
      if (selectedPoint !== clickedPoint && highlightedPoints.has(clickedPoint)) {
        const validMove = possibleMoves.find(
          move => move.from === selectedPoint && move.to === clickedPoint
        )
        
        if (validMove) {
          const originalFrom = shouldMirror ? unmirrorPointIndex(selectedPoint) : selectedPoint
          const originalTo = shouldMirror ? unmirrorPointIndex(clickedPoint) : clickedPoint
          onMove(originalFrom, originalTo, validMove.die)
          setSelectedPoint(null)
          setHighlightedPoints(new Set())
        }
      } else if (selectedPoint === clickedPoint) {
        setSelectedPoint(null)
        setHighlightedPoints(new Set())
      } else {
        const pointValue = points[clickedPoint] || 0
        const isMyChecker = currentPlayer === 0 ? pointValue > 0 : pointValue < 0
        if (isMyChecker) {
          const hasPossibleMoves = possibleMoves.some(move => move.from === clickedPoint)
          if (hasPossibleMoves) {
            setSelectedPoint(clickedPoint)
          } else {
            setSelectedPoint(null)
            setHighlightedPoints(new Set())
          }
        } else {
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
  
  const diceTexturesFor3D = textures.myDice
  
  let dice1Value = 1
  let dice2Value = 1
  if (dice && typeof dice === 'object' && 'die1' in dice && 'die2' in dice) {
    dice1Value = dice.die1
    dice2Value = dice.die2
  } else if (Array.isArray(dice) && dice.length >= 2) {
    dice1Value = dice[0]
    dice2Value = dice[1]
  }

  return (
    <div className="backgammon-board-container" ref={containerRef}>
      {(player1Name || player2Name) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px 8px 0 0',
          fontSize: '14px',
          color: '#fff'
        }}>
          <div style={{ fontWeight: 'bold', color: shouldMirror ? '#888' : '#fff' }}>
            {shouldMirror ? (player1Name || 'Игрок 1') : (player2Name || 'Игрок 2')}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              {shouldMirror ? '⬜' : '⬛'}
            </span>
          </div>
          <div style={{ fontWeight: 'bold', color: shouldMirror ? '#fff' : '#888' }}>
            {shouldMirror ? (player2Name || 'Игрок 2') : (player1Name || 'Игрок 1')}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              {shouldMirror ? '⬛' : '⬜'}
            </span>
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50' }}>(Вы)</span>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (dragging) {
            setDragging(false)
            setDragFromPoint(null)
            setDragPosition(null)
            setDragHoverPoint(null)
            setSelectedPoint(null)
            setHighlightedPoints(new Set())
          }
        }}
        className="backgammon-board"
        style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
      />
      {diceAnimating && dice3DPositions && diceTexturesFor3D && Object.keys(diceTexturesFor3D).length > 0 && (
        <>
          <Dice3D
            value={dice1Value}
            textures={diceTexturesFor3D}
            x={dice3DPositions.x}
            y={dice3DPositions.y}
            size={dice3DPositions.size}
            rolling={true}
            onAnimationEnd={() => {}}
          />
          <Dice3D
            value={dice2Value}
            textures={diceTexturesFor3D}
            x={dice3DPositions.x + dice3DPositions.spacing}
            y={dice3DPositions.y}
            size={dice3DPositions.size}
            rolling={true}
            onAnimationEnd={() => {}}
          />
        </>
      )}
      {selectedPoint !== null && (
        <div className="selected-point-indicator">
          Выбрана точка {POINT_NUMBERS[selectedPoint]}
        </div>
      )}
    </div>
  )
}
