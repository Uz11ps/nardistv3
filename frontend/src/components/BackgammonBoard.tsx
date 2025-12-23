import { useEffect, useRef, useState, useCallback } from 'react'
import { apiClient, getImageUrl } from '../api/client'
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
  mySkins,
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
    defaultBoard?: HTMLImageElement
  }>({})
  
  const isPlayer1 = myPlayerId === player1Id
  
  // ЛЕВАЯ ЧАСТЬ - МОИ СКИНЫ И ШАШКИ (независимо от цвета, они слева снизу)
  // ПРАВАЯ ЧАСТЬ - ПРОТИВНИКА (справа сверху)
  // Используем mySkins если есть, иначе определяем по isPlayer1
  const myBoardSkin = mySkins?.board || (isPlayer1 ? player1Skins?.board : player2Skins?.board)
  const opponentBoardSkin = isPlayer1 ? player2Skins?.board : player1Skins?.board
  const myDiceSkin = mySkins?.dice || (isPlayer1 ? player1Skins?.dice : player2Skins?.dice)
  const opponentDiceSkin = isPlayer1 ? player2Skins?.dice : player1Skins?.dice
  const myCheckersSkin = mySkins?.checkers || (isPlayer1 ? player1Skins?.checkers : player2Skins?.checkers)
  const opponentCheckersSkin = isPlayer1 ? player2Skins?.checkers : player1Skins?.checkers
  
  // Логирование для отладки
  useEffect(() => {
    console.log('🎨 BackgammonBoard - Skins debug:', {
      isPlayer1,
      myPlayerId,
      player1Id,
      player1Skins,
      player2Skins,
      mySkins,
      myBoardSkin,
      myDiceSkin,
      myCheckersSkin,
    })
  }, [isPlayer1, myPlayerId, player1Id, player1Skins, player2Skins, mySkins, myBoardSkin, myDiceSkin, myCheckersSkin])
  
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
          // Используем getImageUrl для правильной обработки путей /uploads/ и /skins/
          const imageUrl = getImageUrl(url) || url
          img.src = imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`
        })
      }
      
      try {
        console.log('🎨 Loading textures:', {
          myBoardSkin,
          opponentBoardSkin,
          myDiceSkin,
          opponentDiceSkin,
          myCheckersSkin,
          opponentCheckersSkin,
        })
        
        // Загружаем текстуру доски (половина для каждого игрока)
        if (myBoardSkin?.boardTextureUrl) {
          const textureUrl = myBoardSkin.boardTextureUrl
          console.log('📦 Loading my board texture:', {
            original: textureUrl,
            processedUrl: getImageUrl(textureUrl),
            skinId: myBoardSkin.id,
            skinName: myBoardSkin.name,
            isDefault: myBoardSkin.isDefault,
            skin: myBoardSkin,
          })
          loaded.myBoard = await loadImage(textureUrl).catch((e) => {
            console.error('❌ Failed to load my board texture:', {
              error: e,
              originalUrl: textureUrl,
              processedUrl: getImageUrl(textureUrl),
              skinId: myBoardSkin.id,
            })
            return undefined
          })
          if (loaded.myBoard) {
            console.log('✅ Successfully loaded my board texture')
          }
        } else {
          console.warn('⚠️ No myBoardSkin.boardTextureUrl found:', {
            myBoardSkin,
            hasBoardSkin: !!myBoardSkin,
            boardTextureUrl: myBoardSkin?.boardTextureUrl,
            allKeys: myBoardSkin ? Object.keys(myBoardSkin) : [],
          })
        }
        if (opponentBoardSkin?.boardTextureUrl) {
          console.log('📦 Loading opponent board texture:', {
            original: opponentBoardSkin.boardTextureUrl,
            processedUrl: getImageUrl(opponentBoardSkin.boardTextureUrl),
            skinId: opponentBoardSkin.id,
            skinName: opponentBoardSkin.name,
            isDefault: opponentBoardSkin.isDefault,
          })
          loaded.opponentBoard = await loadImage(opponentBoardSkin.boardTextureUrl).catch((e) => {
            console.error('❌ Failed to load opponent board texture:', {
              error: e,
              originalUrl: opponentBoardSkin.boardTextureUrl,
              processedUrl: getImageUrl(opponentBoardSkin.boardTextureUrl),
            })
            return undefined
          })
        }
        
        // Загружаем текстуры кубиков (6 граней)
        // Проверяем diceTextureUrls (массив) или diceTextureUrl (одна текстура)
        if (myDiceSkin?.diceTextureUrls) {
          const diceFaces: { [face: number]: HTMLImageElement } = {}
          const textureUrls = typeof myDiceSkin.diceTextureUrls === 'string' 
            ? JSON.parse(myDiceSkin.diceTextureUrls) 
            : myDiceSkin.diceTextureUrls
          
          console.log('🎲 Loading my dice textures:', textureUrls)
          
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
        } else if (myDiceSkin?.diceTextureUrl) {
          // Fallback: если есть одна текстура для всех граней
          console.log('🎲 Loading single dice texture:', myDiceSkin.diceTextureUrl)
          const singleTexture = await loadImage(myDiceSkin.diceTextureUrl).catch(() => undefined)
          if (singleTexture) {
            loaded.myDice = {
              1: singleTexture, 2: singleTexture, 3: singleTexture,
              4: singleTexture, 5: singleTexture, 6: singleTexture,
            }
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
        
        // Загружаем текстуры шашек (белые и черные отдельно)
        // Игрок 1 (myPlayerId === player1Id) - белые шашки
        // Игрок 2 (opponent) - черные шашки
        const isPlayer1 = myPlayerId === player1Id
        
        if (isPlayer1) {
          // Я игрок 1 - белые шашки
          if (myCheckersSkin?.whiteCheckersTextureUrl) {
            console.log('♟️ Loading my white checkers texture:', myCheckersSkin.whiteCheckersTextureUrl)
            loaded.myCheckers = await loadImage(getImageUrl(myCheckersSkin.whiteCheckersTextureUrl) || myCheckersSkin.whiteCheckersTextureUrl).catch((e) => {
              console.error('❌ Failed to load my white checkers texture:', e)
              return undefined
            })
          } else if (myCheckersSkin?.checkersTextureUrl) {
            // Fallback на старую текстуру для обратной совместимости
            console.log('♟️ Loading my checkers texture (fallback):', myCheckersSkin.checkersTextureUrl)
            loaded.myCheckers = await loadImage(getImageUrl(myCheckersSkin.checkersTextureUrl) || myCheckersSkin.checkersTextureUrl).catch((e) => {
              console.error('❌ Failed to load my checkers texture:', e)
              return undefined
            })
          }
          
          // Противник - черные шашки
          if (opponentCheckersSkin?.blackCheckersTextureUrl) {
            console.log('♟️ Loading opponent black checkers texture:', opponentCheckersSkin.blackCheckersTextureUrl)
            loaded.opponentCheckers = await loadImage(getImageUrl(opponentCheckersSkin.blackCheckersTextureUrl) || opponentCheckersSkin.blackCheckersTextureUrl).catch((e) => {
              console.error('❌ Failed to load opponent black checkers texture:', e)
              return undefined
            })
          } else if (opponentCheckersSkin?.checkersTextureUrl) {
            // Fallback на старую текстуру для обратной совместимости
            console.log('♟️ Loading opponent checkers texture (fallback):', opponentCheckersSkin.checkersTextureUrl)
            loaded.opponentCheckers = await loadImage(getImageUrl(opponentCheckersSkin.checkersTextureUrl) || opponentCheckersSkin.checkersTextureUrl).catch((e) => {
              console.error('❌ Failed to load opponent checkers texture:', e)
              return undefined
            })
          }
        } else {
          // Я игрок 2 - черные шашки
          if (myCheckersSkin?.blackCheckersTextureUrl) {
            console.log('♟️ Loading my black checkers texture:', myCheckersSkin.blackCheckersTextureUrl)
            loaded.myCheckers = await loadImage(getImageUrl(myCheckersSkin.blackCheckersTextureUrl) || myCheckersSkin.blackCheckersTextureUrl).catch((e) => {
              console.error('❌ Failed to load my black checkers texture:', e)
              return undefined
            })
          } else if (myCheckersSkin?.checkersTextureUrl) {
            // Fallback на старую текстуру для обратной совместимости
            console.log('♟️ Loading my checkers texture (fallback):', myCheckersSkin.checkersTextureUrl)
            loaded.myCheckers = await loadImage(getImageUrl(myCheckersSkin.checkersTextureUrl) || myCheckersSkin.checkersTextureUrl).catch((e) => {
              console.error('❌ Failed to load my checkers texture:', e)
              return undefined
            })
          }
          
          // Противник - белые шашки
          if (opponentCheckersSkin?.whiteCheckersTextureUrl) {
            console.log('♟️ Loading opponent white checkers texture:', opponentCheckersSkin.whiteCheckersTextureUrl)
            loaded.opponentCheckers = await loadImage(getImageUrl(opponentCheckersSkin.whiteCheckersTextureUrl) || opponentCheckersSkin.whiteCheckersTextureUrl).catch((e) => {
              console.error('❌ Failed to load opponent white checkers texture:', e)
              return undefined
            })
          } else if (opponentCheckersSkin?.checkersTextureUrl) {
            // Fallback на старую текстуру для обратной совместимости
            console.log('♟️ Loading opponent checkers texture (fallback):', opponentCheckersSkin.checkersTextureUrl)
            loaded.opponentCheckers = await loadImage(getImageUrl(opponentCheckersSkin.checkersTextureUrl) || opponentCheckersSkin.checkersTextureUrl).catch((e) => {
              console.error('❌ Failed to load opponent checkers texture:', e)
              return undefined
            })
          }
        }
        
        // Загружаем дефолтную доску /img/доска.jpg
        try {
          const defaultBoardImg = new Image()
          defaultBoardImg.crossOrigin = 'anonymous'
          defaultBoardImg.src = '/img/доска.jpg'
          loaded.defaultBoard = await new Promise<HTMLImageElement>((resolve, reject) => {
            defaultBoardImg.onload = () => resolve(defaultBoardImg)
            defaultBoardImg.onerror = reject
            // Если изображение уже загружено
            if (defaultBoardImg.complete) {
              resolve(defaultBoardImg)
            }
          }).catch(() => undefined)
        } catch (e) {
          console.warn('Failed to load default board image:', e)
        }
        
        console.log('✅ Loaded textures:', loaded)
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
        const allMoves = response.data?.allMoves || []
        // Преобразуем массив массивов ходов в плоский список уникальных ходов
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
      // Дефолтная текстура - используем загруженное изображение /img/доска.jpg
      if (textures.defaultBoard) {
        ctx.drawImage(textures.defaultBoard, 0, 0, halfWidth, height)
      } else {
        // Fallback на коричневую заливку если изображение не загрузилось
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(0, 0, halfWidth, height)
      }
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
      // Дефолтная текстура - используем загруженное изображение /img/доска.jpg
      if (textures.defaultBoard) {
        ctx.drawImage(textures.defaultBoard, halfWidth, 0, halfWidth, height)
      } else {
        // Fallback на коричневую заливку если изображение не загрузилось
        ctx.fillStyle = '#654321'
        ctx.fillRect(halfWidth, 0, halfWidth, height)
      }
    }
    
    // Отрисовка точек (24 точки на доске для нардов)
    const points = gameState.points || []
    const pointWidth = width / 12
    const pointHeight = halfHeight / 2
    
    // Функция для отрисовки треугольной точки
    const drawTrianglePoint = (x: number, y: number, width: number, height: number, isTop: boolean) => {
      ctx.beginPath()
      if (isTop) {
        ctx.moveTo(x, y)
        ctx.lineTo(x - width / 2, y + height)
        ctx.lineTo(x + width / 2, y + height)
      } else {
        ctx.moveTo(x, y)
        ctx.lineTo(x - width / 2, y - height)
        ctx.lineTo(x + width / 2, y - height)
      }
      ctx.closePath()
    }
    
    points.forEach((pointValue: number, pointIndex: number) => {
      if (pointValue === 0) return
      
      // Определяем позицию точки
      // Точки 0-11: верхний ряд (правая часть доски)
      // Точки 12-23: нижний ряд (левая часть доски)
      const isTopRow = pointIndex < 12
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      
      // Определяем, моя это точка или противника
      // В нардах: положительные значения - один игрок, отрицательные - другой
      const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
      
      // Позиционирование точек
      // Верхний ряд: справа налево (точка 0 справа, точка 11 слева)
      // Нижний ряд: слева направо (точка 12 слева, точка 23 справа)
      const x = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const y = isTopRow
        ? pointHeight
        : height - pointHeight
      
      // Отрисовываем треугольную точку
      const triangleWidth = pointWidth * 0.8
      const triangleHeight = pointHeight * 0.9
      ctx.fillStyle = isTopRow ? '#D4A574' : '#8B4513'
      drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow)
      ctx.fill()
      ctx.strokeStyle = '#654321'
      ctx.lineWidth = 1
      ctx.stroke()
      
      const checkerCount = Math.abs(pointValue)
      const checkerSize = Math.min(pointWidth * 0.3, pointHeight * 0.35)
      const checkerTexture = isMyPoint ? textures.myCheckers : textures.opponentCheckers
      
      // Отрисовываем шашки на точке
      const stackHeight = Math.min(checkerCount, 5) * checkerSize * 0.7
      const checkerBaseY = isTopRow ? y + triangleHeight * 0.3 : y - triangleHeight * 0.3
      const startY = isTopRow ? checkerBaseY : checkerBaseY - stackHeight
      
      // Если перетаскиваем шашку с этой точки, не рисуем её здесь
      const isDraggingFromThisPoint = dragging && dragging.pointIndex === pointIndex
      const checkersToDraw = isDraggingFromThisPoint ? Math.min(checkerCount - 1, 5) : Math.min(checkerCount, 5)
      
      for (let i = 0; i < checkersToDraw; i++) {
        const checkerY = isTopRow 
          ? startY + i * checkerSize * 0.7
          : startY + i * checkerSize * 0.7
        
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
      
      // Если шашек больше 5, показываем число
      if (checkerCount > 5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(x - 20, isTopRow ? checkerBaseY - 25 : checkerBaseY + 5, 40, 20)
        ctx.fillStyle = '#000'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(checkerCount.toString(), x, isTopRow ? checkerBaseY - 12 : checkerBaseY + 18)
      }
      
      // Подсветка выбранной точки
      if (selectedPoint === pointIndex) {
        ctx.fillStyle = 'rgba(90, 127, 196, 0.4)'
        drawTrianglePoint(x, y, triangleWidth, triangleHeight, isTopRow)
        ctx.fill()
      }
      
      // Подсветка возможных ходов
      if (highlightedPoints.has(pointIndex)) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.lineWidth = 3
        drawTrianglePoint(x, y, triangleWidth + 10, triangleHeight + 10, isTopRow)
        ctx.stroke()
      }
    })
    
    // Отрисовка бара (середина доски)
    const barX = width / 2
    if (gameState.bar) {
      const bar = gameState.bar
      const myBarCount = isPlayer1 ? bar.white || 0 : bar.black || 0
      const opponentBarCount = isPlayer1 ? bar.black || 0 : bar.white || 0
      const checkerSize = Math.min(pointWidth * 0.3, pointHeight * 0.35)
      
      // Мои шашки на баре (снизу, слева от центра)
      if (myBarCount > 0) {
        const barStartY = height - pointHeight * 0.5
        for (let i = 0; i < myBarCount; i++) {
          const barY = barStartY - (i * checkerSize * 0.7)
          if (textures.myCheckers) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(barX - 30, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(textures.myCheckers, barX - 30 - checkerSize / 2, barY - checkerSize / 2, checkerSize, checkerSize)
            ctx.restore()
          } else {
            ctx.fillStyle = '#FFFFFF'
            ctx.beginPath()
            ctx.arc(barX - 30, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#333'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }
      }
      
      // Шашки противника на баре (сверху, справа от центра)
      if (opponentBarCount > 0) {
        const barStartY = pointHeight * 0.5
        for (let i = 0; i < opponentBarCount; i++) {
          const barY = barStartY + (i * checkerSize * 0.7)
          if (textures.opponentCheckers) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(barX + 30, barY, checkerSize / 2, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(textures.opponentCheckers, barX + 30 - checkerSize / 2, barY - checkerSize / 2, checkerSize, checkerSize)
            ctx.restore()
          } else {
            ctx.fillStyle = '#000000'
            ctx.beginPath()
            ctx.arc(barX + 30, barY, checkerSize / 2, 0, Math.PI * 2)
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
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      
      const pointX = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const pointY = isTopRow
        ? pointHeight
        : height - pointHeight
      
      // Проверяем, кликнули ли на шашку
      const checkerCount = Math.abs(pointValue)
      const checkerSize = Math.min(pointWidth * 0.3, pointHeight * 0.35)
      const isMyPoint = (isPlayer1 && pointValue > 0) || (!isPlayer1 && pointValue < 0)
      
      if (!isMyPoint) continue // Не можем перетаскивать чужие шашки
      
      // Проверяем, есть ли возможные ходы с этой точки
      const pointMoves = possibleMoves.filter(m => m.from === pointIndex)
      if (pointMoves.length === 0) continue
      
      // Проверяем расстояние до точки (треугольник)
      const triangleWidth = pointWidth * 0.8
      const triangleHeight = pointHeight * 0.9
      const dx = Math.abs(x - pointX)
      const dy = Math.abs(y - pointY)
      
      // Улучшенная проверка попадания в треугольник (учитываем форму треугольника)
      const inTriangle = dx < triangleWidth / 2 && dy < triangleHeight && 
        (isTopRow ? y >= pointY && y <= pointY + triangleHeight : y <= pointY && y >= pointY - triangleHeight)
      if (inTriangle) {
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
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      
      const pointX = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const pointY = isTopRow
        ? pointHeight
        : height - pointHeight
      
      // Улучшенная проверка попадания в треугольник
      const triangleWidth = pointWidth * 0.8
      const triangleHeight = pointHeight * 0.9
      const dx = Math.abs(x - pointX)
      const dy = Math.abs(y - pointY)
      const inTriangle = dx < triangleWidth / 2 && dy < triangleHeight &&
        (isTopRow ? y >= pointY && y <= pointY + triangleHeight : y <= pointY && y >= pointY - triangleHeight)
      
      if (inTriangle) {
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
      const pointInRow = isTopRow ? pointIndex : pointIndex - 12
      
      const pointX = isTopRow
        ? width - (pointInRow + 1) * pointWidth + pointWidth / 2
        : pointInRow * pointWidth + pointWidth / 2
      const pointY = isTopRow
        ? pointHeight
        : height - pointHeight
      
      // Улучшенная проверка попадания в треугольник
      const triangleWidth = pointWidth * 0.8
      const triangleHeight = pointHeight * 0.9
      const dx = Math.abs(x - pointX)
      const dy = Math.abs(y - pointY)
      const inTriangle = dx < triangleWidth / 2 && dy < triangleHeight &&
        (isTopRow ? y >= pointY && y <= pointY + triangleHeight : y <= pointY && y >= pointY - triangleHeight)
      
      if (inTriangle) {
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
