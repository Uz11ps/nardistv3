import { useEffect, useRef, useState, useCallback } from 'react'
import { apiClient, getImageUrl } from '../api/client'
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
  player1Skins?: { board?: any; dice?: any; checkers?: any }  // Скины player1 (белые шашки)
  player2Skins?: { board?: any; dice?: any; checkers?: any }  // Скины player2 (черные шашки)
  mySkins?: { board?: any; dice?: any; checkers?: any }       // Скины текущего пользователя (для доски и кубиков)
  diceAnimating?: boolean
  myPlayerId?: string
  player1Id?: string
  player2Id?: string
  player1Name?: string
  player2Name?: string
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
  player1Skins,
  player2Skins,
  mySkins,
  diceAnimating = false,
  myPlayerId,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
}: BackgammonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [diceRolling, setDiceRolling] = useState(false)
  const [diceAnimationStart, setDiceAnimationStart] = useState<number | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<Array<{ from: number; to: number; die: number }>>([])
  const [highlightedPoints, setHighlightedPoints] = useState<Set<number>>(new Set())
  const animationFrameRef = useRef<number>()
  
  // Состояние для drag and drop
  const [dragging, setDragging] = useState(false)
  const [dragFromPoint, setDragFromPoint] = useState<number | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragHoverPoint, setDragHoverPoint] = useState<number | null>(null)
  
  // Загруженные текстуры скинов
  const [loadedTextures, setLoadedTextures] = useState<{
    board?: HTMLImageElement
    dice?: HTMLImageElement
    whiteCheckers?: HTMLImageElement  // Для player1 (белые шашки)
    blackCheckers?: HTMLImageElement  // Для player2 (черные шашки)
  }>({})
  
  // Загружаем текстуры скинов
  // ЛОГИКА: 
  // - Доска и кубики: из mySkins (скины текущего пользователя)
  // - Белые шашки: из player1Skins (player1 всегда играет белыми)
  // - Черные шашки: из player2Skins (player2 всегда играет черными)
  useEffect(() => {
    console.log('🔄 ========== LOADING TEXTURES ==========')
    console.log('🔄 player1Skins:', JSON.stringify(player1Skins, null, 2))
    console.log('🔄 player2Skins:', JSON.stringify(player2Skins, null, 2))
    console.log('🔄 mySkins:', JSON.stringify(mySkins, null, 2))
    
    const textures: {
      board?: HTMLImageElement
      dice?: HTMLImageElement
      whiteCheckers?: HTMLImageElement
      blackCheckers?: HTMLImageElement
    } = {}
    let loadedCount = 0
    const totalTextures = 4 // доска, кубики, белые шашки, черные шашки
    
    const checkAndDraw = () => {
      loadedCount++
      if (loadedCount === totalTextures) {
        console.log('✅ All textures loaded:', textures)
        setLoadedTextures(textures)
      }
    }
    
    // 1. Загружаем текстуру ДОСКИ из mySkins (скины текущего пользователя)
    // БЕЗ ДЕФОЛТНЫХ ФАЙЛОВ - только если есть скин в БД
    const boardTextureUrl = mySkins?.board?.boardTextureUrl
    if (boardTextureUrl) {
      const boardUrl = getImageUrl(boardTextureUrl)
      console.log('🎨 Loading board texture:', boardUrl, 'from:', boardTextureUrl)
      const boardImg = new Image()
      boardImg.onload = () => {
        console.log('✅ Board texture loaded')
        textures.board = boardImg
        checkAndDraw()
      }
      boardImg.onerror = (err) => {
        console.error('❌ Failed to load board texture:', boardUrl, err)
        checkAndDraw()
      }
      boardImg.src = boardUrl || ''
    } else {
      console.warn('⚠️ No board texture URL in mySkins.board')
      checkAndDraw()
    }
    
    // 2. Загружаем текстуру КУБИКОВ из mySkins
    // БЕЗ ДЕФОЛТНЫХ ФАЙЛОВ - только если есть скин в БД
    const diceTextureUrl = mySkins?.dice?.diceTextureUrl
    if (diceTextureUrl) {
      const diceUrl = getImageUrl(diceTextureUrl)
      console.log('🎲 Loading dice texture:', diceUrl)
      const diceImg = new Image()
      diceImg.onload = () => {
        console.log('✅ Dice texture loaded')
        textures.dice = diceImg
        checkAndDraw()
      }
      diceImg.onerror = (err) => {
        console.error('❌ Failed to load dice texture:', diceUrl, err)
        checkAndDraw()
      }
      diceImg.src = diceUrl || ''
    } else {
      console.warn('⚠️ No dice texture URL in mySkins.dice')
      checkAndDraw()
    }
    
    // 3. Загружаем текстуру БЕЛЫХ шашек из player1Skins (player1 всегда играет белыми)
    // БЕЗ ДЕФОЛТНЫХ ФАЙЛОВ - только если есть скин в БД
    const whiteCheckersTextureUrl = player1Skins?.checkers?.whiteCheckersTextureUrl || player1Skins?.checkers?.checkersTextureUrl
    if (whiteCheckersTextureUrl) {
      const whiteCheckersUrl = getImageUrl(whiteCheckersTextureUrl)
      console.log('⚪ Loading white checkers texture:', whiteCheckersUrl, 'from player1Skins:', player1Skins?.checkers)
      const whiteCheckersImg = new Image()
      whiteCheckersImg.onload = () => {
        console.log('✅ White checkers texture loaded')
        textures.whiteCheckers = whiteCheckersImg
        checkAndDraw()
      }
      whiteCheckersImg.onerror = (err) => {
        console.error('❌ Failed to load white checkers texture:', whiteCheckersUrl, err)
        checkAndDraw()
      }
      whiteCheckersImg.src = whiteCheckersUrl || ''
    } else {
      console.warn('⚠️ No white checkers texture URL in player1Skins.checkers')
      checkAndDraw()
    }
    
    // 4. Загружаем текстуру ЧЕРНЫХ шашек из player2Skins (player2 всегда играет черными)
    // БЕЗ ДЕФОЛТНЫХ ФАЙЛОВ - только если есть скин в БД
    const blackCheckersTextureUrl = player2Skins?.checkers?.blackCheckersTextureUrl || player2Skins?.checkers?.checkersTextureUrl
    if (blackCheckersTextureUrl) {
      const blackCheckersUrl = getImageUrl(blackCheckersTextureUrl)
      console.log('⚫ Loading black checkers texture:', blackCheckersUrl, 'from player2Skins:', player2Skins?.checkers)
      const blackCheckersImg = new Image()
      blackCheckersImg.onload = () => {
        console.log('✅ Black checkers texture loaded')
        textures.blackCheckers = blackCheckersImg
        checkAndDraw()
      }
      blackCheckersImg.onerror = (err) => {
        console.error('❌ Failed to load black checkers texture:', blackCheckersUrl, err)
        checkAndDraw()
      }
      blackCheckersImg.src = blackCheckersUrl || ''
    } else {
      console.warn('⚠️ No black checkers texture URL in player2Skins.checkers')
      checkAndDraw()
    }
  }, [player1Skins, player2Skins, mySkins])

  // Определяем, кто я (player1 или player2) для отзеркаливания доски
  const isPlayer1 = myPlayerId === player1Id
  const myPlayerIndex = isPlayer1 ? 0 : 1
  const shouldMirror = !isPlayer1 // Если я player2, отзеркаливаем доску

  // Функции для преобразования индексов точек при отзеркаливании
  // Отзеркаливание: mirroredIndex = 23 - originalIndex
  const mirrorPointIndex = (index: number): number => {
    if (index < 0 || index >= 24) return index // Бар и другие специальные индексы не трогаем
    return 23 - index
  }

  const unmirrorPointIndex = (index: number): number => {
    if (index < 0 || index >= 24) return index
    return 23 - index
  }

  // gameState.points - это массив чисел, где положительное число = белые шашки (player1), отрицательное = черные (player2)
  const pointsRaw = gameState?.points || []
  let points: number[] = Array.isArray(pointsRaw)
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

  // Отзеркаливаем доску для player2, чтобы его шашки были внизу
  if (shouldMirror) {
    // Инвертируем массив точек и меняем знаки (белые становятся черными и наоборот)
    const mirroredPoints: number[] = new Array(24)
    for (let i = 0; i < 24; i++) {
      const mirroredIndex = mirrorPointIndex(i)
      mirroredPoints[i] = -points[mirroredIndex] // Меняем знак и берем из отзеркаленной позиции
    }
    points = mirroredPoints
  }
  
  // Отзеркаливаем bar и bearOff для player2
  let bar = gameState?.bar || (Array.isArray(gameState?.bar) ? { white: gameState.bar[0] || 0, black: gameState.bar[1] || 0 } : { white: 0, black: 0 })
  let bearOff = gameState?.borneOff || gameState?.bearOff || (Array.isArray(gameState?.borneOff) ? { white: gameState.borneOff[0] || 0, black: gameState.borneOff[1] || 0 } : { white: 0, black: 0 })
  
  if (shouldMirror) {
    // Меняем местами white и black для player2
    bar = { white: bar.black, black: bar.white }
    bearOff = { white: bearOff.black, black: bearOff.white }
  }

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
          const data = response.data || {}
          const allMoves = data.allMoves || []
          console.log('✅ Получены возможные ходы с бэкенда:', allMoves)
          
          // Извлекаем все возможные ходы из всех комбинаций
          const movesSet = new Set<string>()
          allMoves.forEach((moveSeq: any[]) => {
            moveSeq.forEach((move: any) => {
              movesSet.add(`${move.from}-${move.to}-${move.die}`)
            })
          })
          
          const uniqueMoves = Array.from(movesSet).map((key) => {
            let [from, to, die] = key.split('-').map(Number)
            // Преобразуем индексы для отображения, если доска отзеркалена
            if (shouldMirror) {
              from = from === -1 ? -1 : mirrorPointIndex(from) // Бар остается -1
              to = to === -1 ? -1 : mirrorPointIndex(to)
            }
            return { from, to, die }
          })
          
          console.log('📋 Уникальные ходы (после отзеркаливания):', uniqueMoves)
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

  // Загружаем возможные ходы с конкретной точки при выборе точки
  useEffect(() => {
    if (gameId && selectedPoint !== null && diceArray.length > 0 && isMyTurn && canMove) {
      console.log(`🔄 Загружаем возможные ходы с точки ${selectedPoint} для игры`, gameId)
      // Преобразуем индекс точки обратно для запроса к серверу
      const originalPointIndex = shouldMirror ? unmirrorPointIndex(selectedPoint) : selectedPoint
      
      // Сначала показываем подсветку из possibleMoves (быстро)
      const quickHighlights = new Set<number>()
      const filteredMoves = possibleMoves.filter((move) => {
        if (selectedPoint === -1) {
          return move.from === -1
        }
        return move.from === selectedPoint
      })
      filteredMoves.forEach((move) => {
        if (move.to >= 0 && move.to < 24) {
          quickHighlights.add(move.to)
        }
      })
      if (quickHighlights.size > 0) {
        console.log(`⚡ Быстрая подсветка из possibleMoves:`, Array.from(quickHighlights).map(idx => `${POINT_NUMBERS[idx]}`).join(', '))
        setHighlightedPoints(quickHighlights)
      }
      
      // Затем загружаем с сервера для точности
      apiClient
        .get(`/games/${gameId}/possible-moves/${originalPointIndex}`)
        .then((response: any) => {
          const data = response.data || {}
          const movesFromPoint = data.movesFromPoint || []
          console.log(`✅ Получены возможные ходы с точки ${originalPointIndex} (отображение: ${selectedPoint}):`, movesFromPoint)
          
          // Подсвечиваем точки, куда можно сделать ход (преобразуем индексы для отображения)
          const highlights = new Set<number>()
          movesFromPoint.forEach((move: any) => {
            if (move.to >= 0 && move.to < 24) {
              const displayIndex = shouldMirror ? mirrorPointIndex(move.to) : move.to
              highlights.add(displayIndex)
            }
          })
          console.log(`🎯 Обновляем подсветку с сервера:`, Array.from(highlights).map(idx => `${POINT_NUMBERS[idx]}`).join(', '))
          setHighlightedPoints(highlights)
        })
        .catch((error) => {
          console.error(`❌ Ошибка загрузки возможных ходов с точки ${selectedPoint}:`, error)
          // При ошибке оставляем подсветку из possibleMoves
        })
    } else if (selectedPoint === null) {
      setHighlightedPoints(new Set())
    }
  }, [gameId, selectedPoint, diceArray.join(','), isMyTurn, canMove, shouldMirror, possibleMoves])

  // Этот useEffect больше не нужен - подсветка теперь обрабатывается в основном useEffect выше

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Используем адаптивный размер canvas с сохранением пропорций
    const container = canvas.parentElement
    if (!container) return
    
    // Получаем размеры контейнера
    let containerWidth = container.clientWidth
    let containerHeight = container.clientHeight
    
    // Обеспечиваем горизонтальную ориентацию (ширина должна быть больше высоты)
    // Если высота больше ширины, ограничиваем высоту
    if (containerHeight > containerWidth * 0.5) {
      containerHeight = containerWidth * 0.5 // Соотношение 2:1
    }
    
    // Если контейнер слишком маленький, устанавливаем минимальные размеры
    if (containerWidth < 400) {
      containerWidth = 400
      containerHeight = 200
    }
    
    // Устанавливаем размер canvas с учетом devicePixelRatio для четкости
    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    
    // Масштабируем контекст для четкости
    ctx.scale(dpr, dpr)
    
    const width = containerWidth
    const height = containerHeight
    // Убираем padding для правильного центрирования
    const boardPadding = 0
    const boardWidth = width
    const boardHeight = height
    const pointWidth = boardWidth / 12
    const pointHeight = boardHeight / 2
    const barWidth = boardWidth * 0.12
    const barHeight = boardHeight * 0.3
    
    // Центральная линия (бар) - центрируем без padding
    const barX = (boardWidth - barWidth) / 2
    const barY = (boardHeight - barHeight) / 2

    // Очистка
    ctx.clearRect(0, 0, width, height)

    // Фон доски - ТОЛЬКО если есть текстура из скина
    // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
    if (loadedTextures.board) {
      // Рисуем текстуру доски - она должна содержать всю доску целиком
      ctx.drawImage(loadedTextures.board, 0, 0, width, height)
    } else {
      // Если нет текстуры - НЕ РИСУЕМ НИЧЕГО
      // Просто оставляем пустой canvas
      console.warn('⚠️ No board texture loaded - board will be empty')
    }
    
    // Номера точек и шашки рисуем ТОЛЬКО если есть текстура доски
    // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
    if (loadedTextures.board) {
      for (let i = 0; i < 24; i++) {
        const pointNum = POINT_NUMBERS[i]
        const isTop = i < 12
        
        // Позиция точки
        let x: number
        if (i < 12) {
          x = (11 - i) * pointWidth
        } else {
          x = (i - 12) * pointWidth
        }
        const y = isTop ? 0 : boardHeight

        // Номер точки - показываем только если есть текстура доски
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.strokeStyle = '#654321'
        ctx.lineWidth = 2
        const numY = isTop ? y + pointHeight - 5 : y - pointHeight + 15
        ctx.strokeText(pointNum.toString(), x + pointWidth / 2, numY)
        ctx.fillText(pointNum.toString(), x + pointWidth / 2, numY)

        // Фишки на точке - ТОЛЬКО если есть текстура шашек
        const pointValue = points[i] || 0
        const checkerCount = Math.abs(pointValue)
        if (checkerCount > 0) {
          const isPlayer1Checker = pointValue > 0
          // Простые цвета: белые для player1, черные для player2
          const checkerColor = isPlayer1Checker ? '#FFFFFF' : '#1a1a1a'
          const checkerRadius = 14
          const maxStack = 5
          const stackSpacing = 4

          // Рисуем фишки
          // Если идет перетаскивание с этой точки, не рисуем верхнюю шашку (она перетаскивается)
          const isDraggingFromThisPoint = dragging && dragFromPoint === i
          const checkersToDraw = isDraggingFromThisPoint ? Math.min(checkerCount - 1, maxStack) : Math.min(checkerCount, maxStack)
          
          for (let j = 0; j < checkersToDraw; j++) {
            let checkerY: number
            if (isTop) {
              // Верхние шашки должны быть в верхней части треугольника (начинаем сверху)
              checkerY = y + (j * stackSpacing) + checkerRadius
            } else {
              // Нижние шашки должны быть в нижней части треугольника (начинаем снизу)
              checkerY = y - (j * stackSpacing) - checkerRadius
            }

            const checkerX = x + pointWidth / 2

            // Анимация выбранной фишки (только если не идет перетаскивание)
            const isSelected = !isDraggingFromThisPoint && selectedPoint === i && j === checkersToDraw - 1
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

            // Круглая фишка - используем текстуру если есть
            // Player1 играет белыми, Player2 играет черными
            const checkerTexture = checkerColor === '#FFFFFF' 
              ? loadedTextures.whiteCheckers   // Белые шашки = player1
              : loadedTextures.blackCheckers   // Черные шашки = player2
            
            // Рисуем шашку ТОЛЬКО если есть текстура
            // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
            if (checkerTexture) {
              // Используем текстуру шашек
              ctx.beginPath()
              ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
              ctx.save()
              ctx.clip()
              ctx.drawImage(checkerTexture, -checkerRadius, -checkerRadius, checkerRadius * 2, checkerRadius * 2)
              ctx.restore()
              
              // Обводка фишки
              ctx.beginPath()
              ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
              ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
              ctx.lineWidth = 2
              ctx.stroke()
            } else {
              // Если нет текстуры - НЕ РИСУЕМ ШАШКУ
              // Просто пропускаем её
            }

            ctx.restore()
          }

          // Показываем количество если больше maxStack
          if (checkerCount > maxStack) {
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 12px Arial'
            ctx.textAlign = 'center'
            // Позиция текста количества фишек: для верхних - внизу стопки, для нижних - вверху стопки
            const countTextY = isTop 
              ? y + maxStack * stackSpacing + checkerRadius + 15
              : y - maxStack * stackSpacing - checkerRadius - 10
            ctx.fillText(
              checkerCount.toString(),
              x + pointWidth / 2,
              countTextY
            )
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
        
        // Подсветка выбранной точки синим
        ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'
        ctx.fill()
        
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)'
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // Подсветка возможных ходов (когда точка выбрана или перетаскивается) - рисуем поверх всего
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
        
        // Более яркая подсветка для лучшей видимости
        // Если это точка под курсором при перетаскивании, делаем еще ярче
        const isDragTarget = dragging && dragHoverPoint === i
        ctx.fillStyle = isDragTarget ? 'rgba(0, 255, 0, 0.8)' : 'rgba(0, 255, 0, 0.6)'
        ctx.fill()
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 1.0)'
        ctx.lineWidth = isDragTarget ? 5 : 4
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
        
        // Круглая шашка - белые шашки ТОЛЬКО если есть текстура
        // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
        const whiteCheckerTexture = loadedTextures.whiteCheckers
        if (whiteCheckerTexture) {
          ctx.beginPath()
          ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
          ctx.save()
          ctx.clip()
          ctx.drawImage(whiteCheckerTexture, checkerX - 12, checkerY - 12, 24, 24)
          ctx.restore()
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        // Если нет текстуры - НЕ РИСУЕМ ШАШКУ
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
        
        // Круглая шашка - черные шашки ТОЛЬКО если есть текстура
        // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
        const blackCheckerTexture = loadedTextures.blackCheckers
        if (blackCheckerTexture) {
          ctx.beginPath()
          ctx.arc(checkerX, checkerY, 12, 0, Math.PI * 2)
          ctx.save()
          ctx.clip()
          ctx.drawImage(blackCheckerTexture, checkerX - 12, checkerY - 12, 24, 24)
          ctx.restore()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        // Если нет текстуры - НЕ РИСУЕМ ШАШКУ
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
        drawDice(ctx, diceAreaX, diceAreaY, roll1, diceSize, true, false)
        drawDice(ctx, diceAreaX + diceSpacing, diceAreaY, roll2, diceSize, true, false)
      } else if (diceArray.length > 0) {
        // Отрисовка кубиков из массива
        diceArray.forEach((die, index) => {
          drawDice(ctx, diceAreaX + index * diceSpacing, diceAreaY, die, diceSize, false, false)
        })
      }
    }
    // Рисуем перетаскиваемую шашку (круглую)
    if (dragging && dragFromPoint !== null && dragPosition) {
      const pointValue = points[dragFromPoint] || 0
      const isPlayer1Checker = pointValue > 0
      const checkerColor = isPlayer1Checker ? '#FFFFFF' : '#1a1a1a'
      const checkerRadius = 14

      ctx.save()
      ctx.translate(dragPosition.x, dragPosition.y)
      
      // Тень
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
      ctx.shadowBlur = 12
      ctx.shadowOffsetX = 4
      ctx.shadowOffsetY = 4

      // Круглая фишка - используем текстуру если есть
      // Player1 играет белыми, Player2 играет черными
      const draggedCheckerTexture = checkerColor === '#FFFFFF'
        ? loadedTextures.whiteCheckers   // Белые шашки = player1
        : loadedTextures.blackCheckers   // Черные шашки = player2
      
      // Круглая фишка - используем текстуру ТОЛЬКО если есть
      // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
      if (draggedCheckerTexture) {
        ctx.beginPath()
        ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
        ctx.save()
        ctx.clip()
        ctx.drawImage(draggedCheckerTexture, -checkerRadius, -checkerRadius, checkerRadius * 2, checkerRadius * 2)
        ctx.restore()
        
        // Обводка фишки
        ctx.beginPath()
        ctx.arc(0, 0, checkerRadius, 0, Math.PI * 2)
        ctx.strokeStyle = checkerColor === '#FFFFFF' ? '#1a1a1a' : '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      // Если нет текстуры - НЕ РИСУЕМ ШАШКУ

      ctx.restore()
    }
  }, [points, bar, bearOff, selectedPoint, hoverPoint, highlightedPoints, dice, diceRolling, diceAnimating, isMyTurn, canMove, dragging, dragFromPoint, dragPosition, loadedTextures])

  const drawDice = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    value: number,
    size: number,
    rolling: boolean,
    dropping: boolean
  ) => {
    // Кубик - ТОЛЬКО если есть текстура
    // БЕЗ ДЕФОЛТНОГО ОТОБРАЖЕНИЯ
    if (!loadedTextures.dice) {
      // Если нет текстуры - НЕ РИСУЕМ КУБИК
      return
    }
    
    ctx.save()
    let drawX = x
    let drawY = y
    
    // Анимация прилета сверху
    if (dropping && diceAnimationStart) {
      const elapsed = Date.now() - diceAnimationStart
      const dropDuration = 500
      if (elapsed < dropDuration) {
        const progress = elapsed / dropDuration
        drawY = y - 100 * (1 - progress) * (1 - progress)
      }
    }
    
    // Анимация вращения при броске
    if (rolling) {
      const rotation = (Date.now() / 50) % 360
      ctx.translate(drawX + size / 2, drawY + size / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-size / 2, -size / 2)
      drawX = 0
      drawY = 0
    }
    
    // Тень кубика
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 3
    
    // Рисуем текстуру кубика
    ctx.drawImage(loadedTextures.dice, drawX, drawY, size, size)
    
    // Обводка кубика
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.strokeRect(drawX, drawY, size, size)
    
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      drawBoard() // drawBoard уже обрабатывает размер canvas с учетом devicePixelRatio
    }

    // Используем ResizeObserver для более точного отслеживания изменений размера
    const container = canvas.parentElement
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    
    resizeObserver.observe(container)
    
    // Также слушаем изменения окна для случаев, когда ResizeObserver не срабатывает
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('orientationchange', resizeCanvas)
    
    // Первоначальная отрисовка
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

    // Используем размеры canvas из стилей (CSS пиксели), а не canvas.width/height (физические пиксели)
    // Это важно, так как координаты кликов приходят в CSS пикселях
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    // Убираем padding для правильного центрирования
    const boardPadding = 0
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

      // Для нижних точек прижимаем к низу доски
      const pointY = isTop ? 0 : boardHeight

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Если идет перетаскивание, обновляем позицию и проверяем, над какой точкой мы находимся
    if (dragging && dragFromPoint !== null) {
      setDragPosition({ x, y })
      const hoveredPoint = getPointFromCoords(x, y)
      setDragHoverPoint(hoveredPoint)
      return
    }

    // Обычное наведение
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

    // Проверяем, есть ли на этой точке наша шашка
    const pointValue = points[clickedPoint] || 0
    const myPlayerIndexMirrored = shouldMirror ? (myPlayerIndex === 0 ? 1 : 0) : myPlayerIndex
    const checkerCount = myPlayerIndexMirrored === 0 ? (pointValue > 0 ? pointValue : 0) : (pointValue < 0 ? Math.abs(pointValue) : 0)
    const isMyChecker = myPlayerIndexMirrored === 0 ? pointValue > 0 : pointValue < 0

    if (isMyChecker && checkerCount > 0) {
      // Проверяем, есть ли возможные ходы с этой точки
      const hasPossibleMoves = possibleMoves.some(move => move.from === clickedPoint)
      if (hasPossibleMoves) {
        console.log(`🎯 Начинаем перетаскивание с точки ${POINT_NUMBERS[clickedPoint]} (индекс ${clickedPoint})`)
        setDragging(true)
        setDragFromPoint(clickedPoint)
        setDragPosition({ x, y })
        setSelectedPoint(clickedPoint) // Также выбираем точку для подсветки
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || dragFromPoint === null) {
      // Если не было перетаскивания, обрабатываем как обычный клик
      handleCanvasClick(e)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const dropPoint = getPointFromCoords(x, y)
    
    // Завершаем перетаскивание
    setDragging(false)
    const fromPoint = dragFromPoint
    setDragFromPoint(null)
    setDragPosition(null)
    setDragHoverPoint(null)

    // Если отпустили на валидной точке, делаем ход
    if (dropPoint !== null && dropPoint >= 0 && dropPoint < 24 && highlightedPoints.has(dropPoint)) {
      const validMove = possibleMoves.find(
        move => move.from === fromPoint && move.to === dropPoint
      )
      
      if (validMove) {
        console.log('✅ Ход валиден через drag and drop, отправляем на сервер')
        const originalFrom = shouldMirror ? unmirrorPointIndex(fromPoint) : fromPoint
        const originalTo = shouldMirror ? unmirrorPointIndex(dropPoint) : dropPoint
        onMove(originalFrom, originalTo, validMove.die)
        setSelectedPoint(null)
        setHighlightedPoints(new Set())
        return
      }
    }

    // Если не валидный ход, просто отменяем выбор
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
      // Выбираем точку или бар
      // После отзеркаливания: если я player2, мои шашки теперь положительные (были отрицательные)
      const myPlayerIndexMirrored = shouldMirror ? (myPlayerIndex === 0 ? 1 : 0) : myPlayerIndex
      const hasBarCheckers = (myPlayerIndexMirrored === 0 && bar.white > 0) || (myPlayerIndexMirrored === 1 && bar.black > 0)
      
      // Проверяем клик по бару (обрабатывается отдельно, но для простоты считаем что бар = -1)
      // Сначала пробуем выбрать точку с шашкой
      if (clickedPoint >= 0 && clickedPoint < 24) {
        const pointValue = points[clickedPoint] || 0
        if (pointValue !== 0) {
          // После отзеркаливания: если я player2, мои шашки стали положительными
          const checkerCount = myPlayerIndexMirrored === 0 ? (pointValue > 0 ? pointValue : 0) : (pointValue < 0 ? Math.abs(pointValue) : 0)
          const isMyChecker = myPlayerIndexMirrored === 0 ? pointValue > 0 : pointValue < 0
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
          // Преобразуем индексы обратно для отправки на сервер
          const originalFrom = shouldMirror ? unmirrorPointIndex(selectedPoint) : selectedPoint
          const originalTo = shouldMirror ? unmirrorPointIndex(clickedPoint) : clickedPoint
          console.log(`🔄 Преобразование индексов: ${selectedPoint}->${originalFrom}, ${clickedPoint}->${originalTo}`)
          onMove(originalFrom, originalTo, validMove.die)
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
      {/* Отображение никнеймов игроков */}
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
          {/* Верхний игрок (противник) */}
          <div style={{ fontWeight: 'bold', color: shouldMirror ? '#888' : '#fff' }}>
            {shouldMirror ? (player1Name || 'Игрок 1') : (player2Name || 'Игрок 2')}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              {shouldMirror ? '⬜' : '⬛'}
            </span>
          </div>
          {/* Нижний игрок (я) */}
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
          // Отменяем перетаскивание при выходе курсора за пределы canvas
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
      {selectedPoint !== null && (
        <div className="selected-point-indicator">
          Выбрана точка {POINT_NUMBERS[selectedPoint]}
        </div>
      )}
    </div>
  )
}
