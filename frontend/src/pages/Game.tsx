import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import BackgammonBoard from '../components/BackgammonBoard'
import SandboxControls from '../components/SandboxControls'
import Dice from '../components/Dice'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { getSocket, getMatchmakingSocket, connectWebSocket } from '../api/websocket'
import './Game.css'

interface GameState {
  points: any[]
  bar: { white: number; black: number }
  bearOff: { white: number; black: number }
  currentPlayer: number
  dice: { die1: number; die2: number } | number[] | null
  canMove: boolean
  verificationSalt?: string
  p1Rolls?: number[][]
  p2Rolls?: number[][]
}

export default function Game() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [historyGameState, setHistoryGameState] = useState<GameState | null>(null)
  const [gameInfo, setGameInfo] = useState<any>(null)
  const [opponent, setOpponent] = useState<any>(null)
  const [score, setScore] = useState({ player1: 0, player2: 0 })
  const [gameStatus, setGameStatus] = useState<string>('waiting')
  const [player1Timer, setPlayer1Timer] = useState<number>(15)
  const [player2Timer, setPlayer2Timer] = useState<number>(15)
  const [moveTimer, setMoveTimer] = useState<number>(15) // Таймер на ход (15 секунд)
  const [totalTimeRemaining, setTotalTimeRemaining] = useState<{ player1: number; player2: number }>({ player1: 60, player2: 60 }) // Общее время каждого игрока (60 секунд)
  const [isInOvertime, setIsInOvertime] = useState<boolean>(false) // Овертайм (прошло больше 15 секунд)
  const lastTimerUpdateRef = useRef<number>(Date.now()) // Время последнего обновления таймера с сервера
  const player1TimerRef = useRef<number>(15)
  const player2TimerRef = useRef<number>(15)
  const totalTimeRemainingRef = useRef<{ player1: number; player2: number }>({ player1: 60, player2: 60 })
  const [pipCounts, setPipCounts] = useState({ player1: 0, player2: 0 })
  const [pipDiff, setPipDiff] = useState<{ player1: number | null; player2: number | null }>({ player1: null, player2: null })
  const lastPipCounts = useRef({ player1: 0, player2: 0 })
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)
  const [preparationCountdown, setPreparationCountdown] = useState<number | null>(null) // Отсчет подготовки (10 секунд)
  const preparationCountdownRef = useRef<number | null>(null)

  // Отключаем вертикальный свайп в Telegram Web App при монтировании компонента игры
  useEffect(() => {
    // Дополнительная инициализация для игры - отключаем свайп еще раз на всякий случай
    const telegramWebApp = (window as any).Telegram?.WebApp
    if (telegramWebApp) {
      try {
        if (telegramWebApp.disableVerticalSwipes) {
          telegramWebApp.disableVerticalSwipes()
        } else if (telegramWebApp.setupSwipeBehavior) {
          telegramWebApp.setupSwipeBehavior({ allow_vertical_swipe: false })
        }
        if (telegramWebApp.isClosingConfirmationEnabled !== undefined) {
          telegramWebApp.isClosingConfirmationEnabled = true
        }
      } catch (error) {
        console.warn('Ошибка при отключении вертикального свайпа:', error)
      }
    }
  }, [])

  // Обновление ориентации
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Отсчет подготовки к игре (10 секунд после выбора смещения)
  const loadGameRef = useRef<(() => Promise<void>) | null>(null)
  
  useEffect(() => {
    // Сохраняем ссылку на функцию loadGame
    const loadGameFunc = async () => {
      if (!gameId) return
      try {
        const response = await apiClient.get(`/games/${gameId}`)
        const game = response.data
        setGameInfo(game)
        setOpponent(game.player1Id === user?.id ? game.player2 : game.player1)
        const winsScore = game.matchesToWin > 1 
          ? { player1: game.player1Wins || 0, player2: game.player2Wins || 0 }
          : { player1: game.player1Score || 0, player2: game.player2Score || 0 }
        setScore(winsScore)
        setGameStatus(game.status)
        
        const isP1 = game.player1Id === user?.id
        const myCurrentOffset = isP1 ? (game.p1Offset || 1) : (game.p2Offset || 1)
        const opponentCurrentOffset = isP1 ? (game.p2Offset || 1) : (game.p1Offset || 1)
        setMyOffset(myCurrentOffset)
        setOpponentOffset(opponentCurrentOffset)
        
        if (game.gameState) {
          const barRaw = game.gameState.bar || [0, 0]
          const bar = Array.isArray(barRaw) 
            ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
            : barRaw
            
          const bearOffRaw = game.gameState.bearOff || game.gameState.borneOff || [0, 0]
          const bearOff = Array.isArray(bearOffRaw)
            ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
            : bearOffRaw
          
          const points = Array.isArray(game.gameState.points) 
            ? [...game.gameState.points] 
            : []
          
          const formattedDice = game.gameState.dice 
            ? (Array.isArray(game.gameState.dice) ? game.gameState.dice : [game.gameState.dice.die1, game.gameState.dice.die2])
            : null as any
          
          const isP1Now = game.player1Id === user?.id
          const canMove = game.currentPlayer === (isP1Now ? 0 : 1)
          
          setGameState({
            points,
            bar,
            bearOff,
            currentPlayer: game.currentPlayer || 0,
            dice: formattedDice,
            canMove: canMove,
            verificationSalt: game.verificationSalt,
            p1Rolls: game.p1Rolls,
            p2Rolls: game.p2Rolls,
          })
        }
      } catch (error) {
        console.error('Failed to load game:', error)
      }
    }
    loadGameRef.current = loadGameFunc
  }, [gameId, user?.id])

  useEffect(() => {
    if (preparationCountdown !== null && preparationCountdown > 0) {
      const interval = setInterval(() => {
        setPreparationCountdown((prev) => {
          if (prev === null || prev <= 1) {
            preparationCountdownRef.current = null
            // После завершения отсчета загружаем игру
            if (loadGameRef.current) {
              loadGameRef.current()
            }
            return null
          }
          const newValue = prev - 1
          preparationCountdownRef.current = newValue
          return newValue
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [preparationCountdown])

  // Расчет Pip Count (очков до финиша)
  const calculatePipCount = useCallback((points: number[], bar: any, bearOff: any, player: number, mode: string) => {
    let count = 0
    const isLong = mode === 'LONG' || mode === 'long'
    
    points.forEach((val, idx) => {
      if (player === 0 && val > 0) {
        // Белые
        if (isLong) {
          // В длинных: 0 -> 23. Расстояние = 24 - idx
          count += val * (24 - idx)
        } else {
          // В коротких: 23 -> 0. Расстояние = idx + 1
          count += val * (idx + 1)
        }
      } else if (player === 1 && val < 0) {
        // Черные
        if (isLong) {
          // В длинных: 12 -> 11 (через 23). Расстояние = (11 - idx + 24) % 24 + 1
          const dist = (11 - idx + 24) % 24 + 1
          count += Math.abs(val) * dist
        } else {
          // В коротких: 0 -> 23. Расстояние = 24 - idx
          count += Math.abs(val) * (24 - idx)
        }
      }
    })
    
    // Добавляем шашки на баре (максимальное расстояние)
    if (player === 0 && bar.white > 0) count += bar.white * 24
    if (player === 1 && bar.black > 0) count += bar.black * 24
    
    return count
  }, [])

  // Обновление Pip Count при изменении состояния игры
  useEffect(() => {
    if (!gameState || !gameInfo) return
    
    const p1Count = calculatePipCount(gameState.points, gameState.bar, gameState.bearOff, 0, gameInfo.mode)
    const p2Count = calculatePipCount(gameState.points, gameState.bar, gameState.bearOff, 1, gameInfo.mode)
    
    setPipCounts({ player1: p1Count, player2: p2Count })
    
    // Считаем разницу, если это наш ход
    if (lastPipCounts.current.player1 !== 0) {
      setPipDiff({
        player1: p1Count - lastPipCounts.current.player1,
        player2: p2Count - lastPipCounts.current.player2
      })
    }
    
    lastPipCounts.current = { player1: p1Count, player2: p2Count }
  }, [gameState, gameInfo?.mode, calculatePipCount])

  const [showExitModal, setShowExitModal] = useState<boolean>(false) // Модальное окно выхода
  const [diceAnimating, setDiceAnimating] = useState<boolean>(false)
  const diceAnimatingRef = useRef<boolean>(false) // Ref для синхронной проверки состояния анимации
  const lastDiceRollRef = useRef<string>('') // Отслеживание последнего обработанного события dice_rolled
  const processedEventsRef = useRef<Set<string>>(new Set()) // Set для отслеживания обработанных eventId
  const [playerSkins, setPlayerSkins] = useState<{ player1: any; player2: any; mySkins: any }>({ player1: null, player2: null, mySkins: null })
  const [player1Ready, setPlayer1Ready] = useState<boolean>(false)
  const [player2Ready, setPlayer2Ready] = useState<boolean>(false)
  const [myReady, setMyReady] = useState<boolean>(false)
  const [myOffset, setMyOffset] = useState<number>(1)
  const [opponentOffset, setOpponentOffset] = useState<number>(1)
  const lastSentOffsetRef = useRef<number | null>(null) // Отслеживаем последний отправленный offset
  const [showOffsetModal, setShowOffsetModal] = useState<boolean>(false)
  const showOffsetModalRef = useRef<boolean>(false)
  const [offsetConfirmed, setOffsetConfirmed] = useState<boolean>(false)
  const offsetConfirmedRef = useRef<boolean>(false)
  const [serverMovesForBoard, setServerMovesForBoard] = useState<any[] | undefined>(undefined)
  const pendingGameStateRef = useRef<any>(null)
  const isServerAnimatingRef = useRef<boolean>(false)

  // Синхронизируем рефы с состоянием
  useEffect(() => {
    showOffsetModalRef.current = showOffsetModal
  }, [showOffsetModal])

  // Блокируем скролл body когда модальные окна открыты
  useEffect(() => {
    const isAnyModalOpen = showOffsetModal || showExitModal
    if (isAnyModalOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.height = '100%'
      
      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.height = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [showOffsetModal, showExitModal])

  useEffect(() => {
    offsetConfirmedRef.current = offsetConfirmed
  }, [offsetConfirmed])
  const [pendingMoves, setPendingMoves] = useState<Array<{ from: number; to: number; die: number; steps?: any[] }>>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const handleBoardUpdate = () => {
      loadGame()
    }
    window.addEventListener('sandbox-board-updated', handleBoardUpdate)
    return () => window.removeEventListener('sandbox-board-updated', handleBoardUpdate)
  }, [gameId])

  const mode = searchParams.get('mode')
  const isBotGame = mode === 'bot'
  const createdBotGameRef = useRef(false)

  useEffect(() => {
    if (gameId) {
      // ВАЖНО: Полный сброс всех состояний при переходе к новой игре
      // Это критично для серий матчей, чтобы не сохранялись данные из предыдущей игры
      setOffsetConfirmed(false)
      offsetConfirmedRef.current = false
      setShowOffsetModal(false)
      showOffsetModalRef.current = false
      setPendingMoves([])
      setServerMovesForBoard(undefined)
      pendingGameStateRef.current = null
      isServerAnimatingRef.current = false
      setIsProcessingConfirm(false)
      setGameState({
        points: [],
        bar: { white: 0, black: 0 },
        bearOff: { white: 0, black: 0 },
        currentPlayer: 0,
        dice: null,
        canMove: false,
      })
      setGameStatus('waiting')
      setScore({ player1: 0, player2: 0 })
      setPlayer1Timer(15)
      setPlayer2Timer(15)
      setTotalTimeRemaining({ player1: 60, player2: 60 })
      setIsInOvertime(false)
      setMoveTimer(15)
      setPreparationCountdown(null)
      preparationCountdownRef.current = null
      
      // Очищаем таймеры
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      loadGame()
      connectToGame()
      createdBotGameRef.current = false

      // Обрабатываем переподключение WebSocket после разрыва соединения
      const socket = getSocket()
      if (socket) {
        const handleReconnect = () => {
          console.log('🔄 WebSocket переподключен, переподключаемся к игре')
          if (gameId) {
            // ВАЖНО: При переподключении загружаем полное состояние с сервера
            // Это гарантирует, что сессия восстановится с сервера, а не с клиента
            loadGame()
            setupSocketHandlers(socket)
            socket.emit('join_game', { gameId })
          }
        }
        socket.on('connect', handleReconnect)

        return () => {
          socket.off('connect', handleReconnect)
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
          socket.off('game_state')
          socket.off('move_made')
          socket.off('dice_rolled')
          socket.off('game_finished')
          const matchmakingSocket = getMatchmakingSocket()
          if (matchmakingSocket) {
            matchmakingSocket.off('ready_status')
            matchmakingSocket.off('game_started')
            matchmakingSocket.off('opponent_joined')
          }
        }
      } else {
        return () => {
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
        }
      }
    } else if (isBotGame && !createdBotGameRef.current) {
      createdBotGameRef.current = true
      createBotGame()
    } else if (!isBotGame && !gameId) {
      navigate('/game/modes')
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [gameId, isBotGame])
  
  // Перезагружаем скины при изменении gameInfo (когда присоединяется соперник)
  useEffect(() => {
    if (gameInfo?.player1Id && gameInfo?.player2Id) {
      console.log('🔄 gameInfo updated, reloading skins...', { player1Id: gameInfo.player1Id, player2Id: gameInfo.player2Id })
      loadPlayerSkins(gameInfo.player1Id, gameInfo.player2Id)
    }
  }, [gameInfo?.player1Id, gameInfo?.player2Id])

  // Синхронизируем ref с state
  useEffect(() => {
    player1TimerRef.current = player1Timer
  }, [player1Timer])
  
  useEffect(() => {
    player2TimerRef.current = player2Timer
  }, [player2Timer])
  
  useEffect(() => {
    totalTimeRemainingRef.current = totalTimeRemaining
  }, [totalTimeRemaining])

  const isPlayer1 = gameInfo?.player1Id === user?.id
  const isSandbox = gameInfo?.type === 'sandbox'
  const [sandboxMode, setSandboxMode] = useState<'setup' | 'play'>('setup')
  const isMyTurn = (gameState?.canMove || isSandbox) && (gameStatus === 'in_progress' || isSandbox)
  const myPlayer = isPlayer1 ? gameInfo?.player1 : gameInfo?.player2
  const opponentPlayer = isPlayer1 ? gameInfo?.player2 : gameInfo?.player1

  // Функция автолуза
  const handleAutoMove = useCallback(async () => {
    if (!gameId) return

    console.log('⏱️ Таймер истек! Оформляем техническое поражение...')
    try {
      await apiClient.post(`/games/${gameId}/resign`)
      setGameStatus('finished')
    } catch (error) {
      console.error('❌ Ошибка при автоматической сдаче:', error)
    }
  }, [gameId])

  // Локальный таймер для плавного обновления UI
  useEffect(() => {
    if (gameStatus !== 'in_progress' || isSandbox) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    timerIntervalRef.current = window.setInterval(() => {
      const now = Date.now()
      const deltaSeconds = (now - lastTimerUpdateRef.current) / 1000
      lastTimerUpdateRef.current = now

      if (gameState?.currentPlayer === 0) {
        // Ход игрока 1
        if (player1TimerRef.current > 0) {
          const oldValue = player1TimerRef.current
          const newValue = Math.max(0, oldValue - deltaSeconds)
          setPlayer1Timer(newValue)
          player1TimerRef.current = newValue // Обновляем ref для следующей итерации
          if (newValue === 0 && oldValue > 0) {
            setIsInOvertime(true)
          }
        } else {
          // Овертайм - уменьшаем общее время
          const newTotal = Math.max(0, totalTimeRemainingRef.current.player1 - deltaSeconds)
          setTotalTimeRemaining(prev => ({ ...prev, player1: newTotal }))
          totalTimeRemainingRef.current.player1 = newTotal // Обновляем ref
          
          // Если мое время закончилось - оформляем поражение локально для скорости реакции
          if (newTotal === 0 && isPlayer1 && gameStatus === 'in_progress') {
            handleAutoMove()
          }
        }
      } else if (gameState?.currentPlayer === 1) {
        // Ход игрока 2
        if (player2TimerRef.current > 0) {
          const oldValue = player2TimerRef.current
          const newValue = Math.max(0, oldValue - deltaSeconds)
          setPlayer2Timer(newValue)
          player2TimerRef.current = newValue // Обновляем ref для следующей итерации
          if (newValue === 0 && oldValue > 0) {
            setIsInOvertime(true)
          }
        } else {
          // Овертайм - уменьшаем общее время
          const newTotal = Math.max(0, totalTimeRemainingRef.current.player2 - deltaSeconds)
          setTotalTimeRemaining(prev => ({ ...prev, player2: newTotal }))
          totalTimeRemainingRef.current.player2 = newTotal // Обновляем ref
          
          // Если мое время закончилось - оформляем поражение локально для скорости реакции
          if (newTotal === 0 && !isPlayer1 && gameStatus === 'in_progress') {
            handleAutoMove()
          }
        }
      }
    }, 100) // Обновляем каждые 100мс для плавности

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [gameStatus, gameState?.currentPlayer, isPlayer1, isSandbox, handleAutoMove])
  
  const loadGame = async () => {
    try {
      const response = await apiClient.get(`/games/${gameId}`)
      const game = response.data
      setGameInfo(game)
      const diceData = game.gameState?.dice
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2
        ? { die1: diceData[0], die2: diceData[1] }
        : diceData || null
      
      const barRaw = game.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = game.gameState?.bearOff || game.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      setGameState({
        points: game.gameState?.points || [],
        bar,
        bearOff,
        currentPlayer: game.currentPlayer || 0,
        dice: formattedDice,
        canMove: game.player1Id === user?.id ? game.currentPlayer === 0 : game.currentPlayer === 1,
        verificationSalt: game.verificationSalt,
        p1Rolls: game.p1Rolls,
        p2Rolls: game.p2Rolls,
      })
      setOpponent(game.player1Id === user?.id ? game.player2 : game.player1)
      // Используем счет побед из серии матчей (player1Wins/player2Wins), если есть серия
      const winsScore = game.matchesToWin > 1 
        ? { player1: game.player1Wins || 0, player2: game.player2Wins || 0 }
        : { player1: game.player1Score || 0, player2: game.player2Score || 0 }
      setScore(winsScore)
      setGameStatus(game.status)
      
      // Загружаем смещения игроков
      const isP1 = game.player1Id === user?.id
      const myCurrentOffset = isP1 ? (game.p1Offset || 1) : (game.p2Offset || 1)
      const opponentCurrentOffset = isP1 ? (game.p2Offset || 1) : (game.p1Offset || 1)
      
      setMyOffset(myCurrentOffset)
      setOpponentOffset(opponentCurrentOffset)
      
      // Показываем модальное окно выбора смещения ТОЛЬКО если смещение еще не было выбрано
      // Проверяем p1OffsetChosenAt и p2OffsetChosenAt - если они null, значит смещение еще не выбрано
      if (game.type !== 'sandbox') {
        const myCurrentOffsetValue = isP1 ? game.p1Offset : game.p2Offset
        const myOffsetChosenAt = isP1 ? game.p1OffsetChosenAt : game.p2OffsetChosenAt
        
        // ВАЖНО: Показываем модальное окно ТОЛЬКО если:
        // 1. Смещение еще не было выбрано (myOffsetChosenAt === null)
        // 2. Смещение равно значению по умолчанию (1)
        // 3. Модальное окно еще не было подтверждено локально
        // 4. Модальное окно еще не открыто
        const shouldShowModal = myOffsetChosenAt === null && 
                                myCurrentOffsetValue === 1 && 
                                !offsetConfirmedRef.current && 
                                !showOffsetModalRef.current
        
        if (shouldShowModal) {
          console.log('✅ [loadGame] Показываем модальное окно выбора смещения (смещение еще не выбрано)')
          requestAnimationFrame(() => {
            setShowOffsetModal(true)
            console.log('✅ [loadGame] showOffsetModal установлен в true')
          })
        } else if (myOffsetChosenAt !== null) {
          // Если смещение уже выбрано - помечаем как подтвержденное локально
          if (!offsetConfirmedRef.current) {
            setOffsetConfirmed(true)
            console.log('✅ [loadGame] Смещение уже выбрано на сервере, помечаем как подтвержденное')
          }
        }
      }
      
      if (game.status === 'in_progress') {
        const timeLimitSeconds = game.moveTimeLimit ? Math.floor(game.moveTimeLimit / 1000) : 15
        
        // Запрашиваем актуальное состояние таймеров с сервера через WebSocket
        // Если WebSocket подключен, таймеры придут в событии timer_update
        // Иначе устанавливаем начальные значения
        const socket = getSocket()
        if (socket && socket.connected) {
          // Таймеры обновятся через событие timer_update от сервера
          // Устанавливаем временные значения для отображения
          setPlayer1Timer(timeLimitSeconds)
          setPlayer2Timer(timeLimitSeconds)
          setTotalTimeRemaining({ 
            player1: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
            player2: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60
          })
          totalTimeRemainingRef.current = {
            player1: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
            player2: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60
          }
        } else {
          // Если WebSocket не подключен, используем значения из БД если есть
          setPlayer1Timer(timeLimitSeconds)
          setPlayer2Timer(timeLimitSeconds)
          setTotalTimeRemaining({ 
            player1: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
            player2: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60
          })
          totalTimeRemainingRef.current = {
            player1: game.player1TimeRemaining ? game.player1TimeRemaining / 1000 : 60,
            player2: game.player2TimeRemaining ? game.player2TimeRemaining / 1000 : 60
          }
        }
        
        // Если игра началась и это наш ход, но кубиков нет - бросаем их
        // НО ТОЛЬКО если оба игрока выбрали смещение
        // НО НЕ для sandbox игр - там пользователь сам управляет всем
        const bothOffsetsChosen = game.p1OffsetChosenAt && game.p2OffsetChosenAt
        const canMoveNow = game.player1Id === user?.id ? game.currentPlayer === 0 : game.currentPlayer === 1
        if (canMoveNow && !formattedDice && !isBotGame && game.type !== 'sandbox' && bothOffsetsChosen) {
          setTimeout(() => {
            const socket = getSocket()
            if (socket && socket.connected) {
              socket.emit('roll_dice', { gameId })
            }
          }, 500)
        }
      } else {
        setPlayer1Timer(0)
        setPlayer2Timer(0)
      }
      
      if (game.status === 'waiting' && game.type === 'vs_player' && !isBotGame) {
        setPlayer1Ready(false)
        setPlayer2Ready(false)
        setMyReady(false)
      }
      
      await loadPlayerSkins(game.player1Id, game.player2Id)
    } catch (error) {
      // Игнорируем ошибки загрузки
    }
  }

  const loadPlayerSkins = async (player1Id: string, player2Id: string) => {
    try {
      const currentUser = useAuthStore.getState().user
      const myId = currentUser?.id
      
      const loadDefaultSkins = async () => {
        try {
          const allSkinsRes = await apiClient.get('/skins').catch(() => ({ data: [] }))
          const allSkins = allSkinsRes.data || []
          const defaultBoard = allSkins.find((s: any) => s.type === 'board' && s.isDefault)
          const defaultDice = allSkins.find((s: any) => s.type === 'dice' && s.isDefault)
          const defaultCheckers = allSkins.find((s: any) => s.type === 'checkers' && s.isDefault)
          return {
            board: defaultBoard || null,
            dice: defaultDice || null,
            checkers: defaultCheckers || null,
          }
        } catch (error) {
          console.error('Failed to load default skins:', error)
          return { board: null, dice: null, checkers: null }
        }
      }
      
      const isBotPlayer2 = !player2Id || isBotGame || gameInfo?.type === 'vs_bot'
      
      const loadPlayerSkinsWithFallback = async (userId: string, isMyId: boolean) => {
        try {
          const explicitRes = await apiClient.get('/skins/selected/explicit').catch(() => ({ data: {} }))
          const explicitSkins = explicitRes.data || {}
          
          if (explicitSkins.board || explicitSkins.dice || explicitSkins.checkers) {
            return explicitSkins
          }
          
          const selectedRes = await apiClient.get(isMyId ? '/skins/selected' : `/skins/user/${userId}/selected`).catch(() => ({ data: {} }))
          const selectedSkins = selectedRes.data || {}
          return selectedSkins
        } catch (error) {
          console.error(`Failed to load skins for user ${userId}:`, error)
          return {}
        }
      }
      
      const promises = [
        myId === player1Id 
          ? loadPlayerSkinsWithFallback(player1Id, true)
          : loadPlayerSkinsWithFallback(player1Id, false),
        isBotPlayer2
          ? loadDefaultSkins().then(defaultSkins => defaultSkins)
          : (player2Id
              ? loadPlayerSkinsWithFallback(player2Id, myId === player2Id)
              : Promise.resolve({})),
        myId ? loadPlayerSkinsWithFallback(myId, true) : Promise.resolve({}),
      ]
      
      const [player1Skins, player2Skins, mySkins] = await Promise.all(promises)
      
      setPlayerSkins({
        player1: player1Skins,
        player2: player2Skins,
        mySkins: mySkins,
      })
    } catch (error) {
      console.error('Failed to load player skins:', error)
      setPlayerSkins({
        player1: {},
        player2: {},
        mySkins: {},
      })
    }
  }

  const createBotGame = async (gameMode: 'short' | 'long' = 'long') => {
    try {
      console.log('🤖 Создание игры с ботом, сбрасываем флаги смещения')
      const response = await apiClient.post('/games/create-bot', { mode: gameMode })
      // Сбрасываем флаг подтверждения смещения для новой игры
      setOffsetConfirmed(false)
      setShowOffsetModal(false)
      navigate(`/game/${response.data.id}`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка'
      alert(`Не удалось создать игру с ботом: ${errorMessage}`)
    }
  }

  const connectToGame = () => {
    if (!gameId) return

    const socket = getSocket()
    if (!socket) {
      const { token } = useAuthStore.getState()
      if (token) {
        connectWebSocket(token)
      }
      // Подключение будет обработано через useEffect, который следит за gameId
      return
    }

    // Если сокет подключен, сразу подключаемся к игре
    if (socket.connected) {
      setupSocketHandlers(socket)
      socket.emit('join_game', { gameId })
    }
    // Если не подключен, подождем события connect в useEffect
  }

  const setupSocketHandlers = (socket: any) => {
    if (!gameId) return

    // Обработчик dice_rolled - объявляем ДО регистрации, чтобы можно было удалить
    const handleDiceRolled = (data: any) => {
      if (!data.dice) {
        console.log('⚠️ dice_rolled event without dice data, skipping');
        return;
      }
      
      // Используем eventId для дедупликации, если он есть, иначе используем diceKey + timestamp
      const eventId = data.eventId || `${JSON.stringify(data.dice)}_${Date.now()}`;
      const diceKey = JSON.stringify(data.dice);
      
      console.log('🎲 dice_rolled received:', data, 'eventId:', eventId.substring(0, 80), 'diceAnimatingRef:', diceAnimatingRef.current);
      
      // СТРОГАЯ защита от дублирования: проверяем через Set обработанных событий
      if (processedEventsRef.current.has(eventId)) {
        console.log('⚠️ Duplicate dice_rolled event detected (eventId in Set), skipping');
        return;
      }
      
      // Также проверяем по diceKey, если eventId нет
      if (!data.eventId && lastDiceRollRef.current === diceKey) {
        console.log('⚠️ Duplicate dice_rolled event detected (same dice key), skipping');
        return;
      }
      
      // Защита от дублирования: не запускаем анимацию, если она уже идет
      if ((window as any).diceAnimationTimeout) {
        console.log('⚠️ Dice animation timeout already exists, skipping duplicate');
        return;
      }
      
      // Дополнительная защита: проверяем через ref (синхронно)
      if (diceAnimatingRef.current) {
        console.log('⚠️ Dice animation already active (ref), skipping duplicate');
        return;
      }
      
      // Добавляем eventId в Set обработанных событий СРАЗУ
      processedEventsRef.current.add(eventId);
      lastDiceRollRef.current = diceKey;
      
      console.log('✅ Processing dice_rolled event, eventId:', eventId.substring(0, 80));
      
      // Обновляем состояние кубиков
      if (data.dice) {
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            dice: data.dice
          };
        });
      }
      
      // Запускаем анимацию ОДИН раз - устанавливаем ref СРАЗУ
      diceAnimatingRef.current = true;
      setDiceAnimating(true);
      
      // Запускаем таймаут для остановки анимации через 1.8 секунды
      (window as any).diceAnimationTimeout = setTimeout(() => {
        diceAnimatingRef.current = false; // Сбрасываем ref
        setDiceAnimating(false);
        delete (window as any).diceAnimationTimeout;
        // Очищаем ключ и eventId после завершения анимации (с небольшой задержкой для безопасности)
        setTimeout(() => {
          lastDiceRollRef.current = '';
          processedEventsRef.current.delete(eventId);
          // Очищаем старые события из Set (оставляем только последние 10)
          if (processedEventsRef.current.size > 10) {
            const eventsArray = Array.from(processedEventsRef.current);
            processedEventsRef.current.clear();
            eventsArray.slice(-10).forEach(id => processedEventsRef.current.add(id));
          }
        }, 200); // Уменьшили задержку очистки
      }, 1800);
    };

    // ВАЖНО: Отключаем все предыдущие обработчики перед добавлением новых
    // Это предотвращает множественные подписки на одно событие
    socket.off('game_state')
    socket.off('move_made')
    socket.off('dice_rolled', handleDiceRolled) // Отключаем конкретную функцию
    socket.off('game_finished')
    socket.off('offset_updated')
    socket.off('timer_update')

    // Регистрируем обработчики событий
    socket.on('next_game_created', (data: any) => {
      // Автоматически переходим к следующей игре в серии
      if (data.gameId && data.matchSeriesId) {
        console.log(`🎮 Следующая игра в серии создана: ${data.gameId}, счет: ${data.player1Wins}:${data.player2Wins} (до ${data.matchesToWin})`)
        
        // ВАЖНО: Полный сброс всех состояний перед переходом к новой игре
        // Это предотвращает сохранение данных из предыдущей игры
        setPendingMoves([])
        setServerMovesForBoard(undefined)
        pendingGameStateRef.current = null
        isServerAnimatingRef.current = false
        setOffsetConfirmed(false)
        offsetConfirmedRef.current = false
        setShowOffsetModal(false)
        showOffsetModalRef.current = false
        setIsProcessingConfirm(false)
        setGameState({
          points: [],
          bar: { white: 0, black: 0 },
          bearOff: { white: 0, black: 0 },
          currentPlayer: 0,
          dice: null,
          canMove: false,
        })
        setGameStatus('waiting')
        setScore({ player1: 0, player2: 0 })
        setPlayer1Timer(15)
        setPlayer2Timer(15)
        setTotalTimeRemaining({ player1: 60, player2: 60 })
        setIsInOvertime(false)
        setMoveTimer(15)
        setPreparationCountdown(null)
        preparationCountdownRef.current = null
        
        // Очищаем таймеры
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        
        // Небольшая задержка перед переходом, чтобы пользователь видел результат
        setTimeout(() => {
          navigate(`/game/${data.gameId}`, { replace: true })
        }, 2000)
      }
    })

    socket.on('game_state', (data: any) => {
      // Если идет анимация серверных ходов, игнорируем входящее состояние,
      // чтобы избежать дублирования шашек. Состояние применится в onServerMovesFinished.
      if (isServerAnimatingRef.current) {
        console.log('🤖 Ignoring game_state update during server animation')
        return
      }

      const diceData = data.gameState?.dice
      // ВАЖНО: Правильно форматируем кубики для отображения
      // Если это массив из 4 элементов (дубль) - сохраняем как массив
      // Если это массив из 2 элементов - преобразуем в { die1, die2 }
      // Если пустой массив или null - null
      let formattedDice: { die1: number; die2: number } | number[] | null = null
      if (Array.isArray(diceData)) {
        if (diceData.length === 4) {
          // Дубль - сохраняем как массив из 4 элементов
          formattedDice = diceData
        } else if (diceData.length === 2) {
          // Обычный бросок - преобразуем в объект
          formattedDice = { die1: diceData[0], die2: diceData[1] }
        } else if (diceData.length === 0) {
          formattedDice = null
        }
      } else if (diceData) {
        // Если это не массив, но есть данные - используем как есть
        formattedDice = diceData
      }
      
      console.log('📊 game_state received:', { diceData, formattedDice, currentPlayer: data.currentPlayer })
      
      // Проверяем, изменились ли кубики (для запуска анимации)
      // НЕ запускаем анимацию здесь, т.к. она уже запускается в dice_rolled событии
      // Это предотвращает дублирование анимации
      
      const isSandbox = data.type === 'sandbox'
      const canMove = isSandbox ? true : data.currentPlayer === (data.player1Id === user?.id ? 0 : 1)
      const isMyTurnNow = canMove
      const wasMyTurn = gameState?.canMove || false
      
      const barRaw = data.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      // Создаем новый массив points для гарантированного обновления React
      const points = Array.isArray(data.gameState?.points) 
        ? [...data.gameState.points] 
        : []
      
      // ВАЖНО: Обновляем состояние игры, включая кубики
      // Если кубики есть в game_state - обновляем их (даже если dice_rolled еще не пришло)
      setGameState((prev) => {
        const newState = {
          points,
          bar,
          bearOff,
          currentPlayer: data.currentPlayer || 0,
          dice: formattedDice, // ВАЖНО: Всегда обновляем кубики из game_state
          canMove: canMove,
          verificationSalt: data.verificationSalt,
          p1Rolls: data.p1Rolls,
          p2Rolls: data.p2Rolls,
        }
        console.log('📊 Updating gameState:', { 
          dice: formattedDice, 
          previousDice: prev?.dice,
          currentPlayer: data.currentPlayer,
          canMove 
        })
        return newState
      })
      const newStatus = data.status || 'waiting'
      
      // Показываем модальное окно выбора смещения ТОЛЬКО если смещение еще не было выбрано
      // Проверяем p1OffsetChosenAt и p2OffsetChosenAt - если они null, значит смещение еще не выбрано
      if (data.type !== 'sandbox') {
        const isP1 = data.player1Id === user?.id
        const myCurrentOffset = isP1 ? data.p1Offset : data.p2Offset
        const myOffsetChosenAt = isP1 ? data.p1OffsetChosenAt : data.p2OffsetChosenAt
        
        // ВАЖНО: Показываем модальное окно ТОЛЬКО если:
        // 1. Смещение еще не было выбрано (myOffsetChosenAt === null)
        // 2. Смещение равно значению по умолчанию (1)
        // 3. Модальное окно еще не было подтверждено локально
        // 4. Модальное окно еще не открыто
        const shouldShowModal = myOffsetChosenAt === null && 
                                myCurrentOffset === 1 && 
                                !offsetConfirmedRef.current && 
                                !showOffsetModalRef.current
        
        if (shouldShowModal) {
          console.log('✅ [WebSocket] Показываем модальное окно выбора смещения (смещение еще не выбрано)')
          requestAnimationFrame(() => {
            setShowOffsetModal(true)
            console.log('✅ [WebSocket] showOffsetModal установлен в true')
          })
        } else if (myOffsetChosenAt !== null) {
          // Если смещение уже выбрано - помечаем как подтвержденное локально
          if (!offsetConfirmedRef.current) {
            setOffsetConfirmed(true)
            console.log('✅ [WebSocket] Смещение уже выбрано на сервере, помечаем как подтвержденное')
          }
        }
      }
      
      setGameStatus(newStatus)
      // Используем счет побед из серии матчей, если есть серия
      const winsScore = data.matchesToWin > 1
        ? { player1: data.player1Wins || 0, player2: data.player2Wins || 0 }
        : { player1: data.player1Score || 0, player2: data.player2Score || 0 }
      setScore(winsScore)
      
      // Обновляем таймеры из данных сервера, если они есть
      if (data.player1Timer !== undefined) {
        setPlayer1Timer(data.player1Timer)
      }
      if (data.player2Timer !== undefined) {
        setPlayer2Timer(data.player2Timer)
      }
      
      // Проверяем, выбрали ли оба игрока смещение (для всех типов игр, включая ботов)
      const bothOffsetsChosen = data.p1OffsetChosenAt && data.p2OffsetChosenAt

      // Если оба игрока выбрали смещение, но игра еще в WAITING - запускаем отсчет подготовки
      // Это работает для ВСЕХ типов игр: vs_player, vs_bot, tournament
      // Проверяем также, что игра еще не началась (нет кубиков)
      const hasNoDice = !data.gameState?.dice || (Array.isArray(data.gameState.dice) && data.gameState.dice.length === 0)
      if (bothOffsetsChosen && (newStatus === 'waiting' || (newStatus === 'in_progress' && hasNoDice)) && preparationCountdown === null) {
        console.log('⏱️ Запускаем отсчет подготовки к игре (10 секунд) для типа:', data.type)
        setPreparationCountdown(10)
        preparationCountdownRef.current = 10
      }

      // Таймер и броски кубиков запускаются ТОЛЬКО после выбора смещения обоими игроками
      if (isMyTurnNow && !wasMyTurn && bothOffsetsChosen) {
        setMoveTimer(15)
      }

      // Если это начало нашего хода и кубиков нет - бросаем их автоматически
      // НО ТОЛЬКО если оба игрока выбрали смещение
      // НО НЕ для sandbox игр - там пользователь сам управляет всем
      if (newStatus === 'in_progress' && isMyTurnNow && !wasMyTurn && !formattedDice && gameInfo?.type !== 'sandbox' && bothOffsetsChosen) {
        setTimeout(() => {
          const socket = getSocket()
          if (socket) {
            socket.emit('roll_dice', { gameId })
          }
        }, 500)
      }
    })

    socket.on('move_made', (data: any) => {
      setIsProcessingConfirm(false)
      const diceData = data.gameState?.dice
      const isP1 = data.player1Id === user?.id
      
      // ВАЖНО: Если пришли серверные ходы, передаем их доске для анимации
      // Но только если это НЕ наш ход (наши ходы анимируются локально)
      if (data.serverMoves && data.currentPlayer !== (isP1 ? 0 : 1)) {
        console.log('🤖 Setting server moves for board animation:', data.serverMoves)
        setServerMovesForBoard(data.serverMoves)
        
        // Сбрасываем их через небольшую задержку, чтобы prop change сработал
        setTimeout(() => setServerMovesForBoard(undefined), 100)
      }
      
      // Для дублей может быть массив из 4 элементов, для обычных - из 2
      // Сохраняем весь массив, если он есть
      const formattedDice = Array.isArray(diceData) && diceData.length > 0
        ? diceData.length === 2
          ? { die1: diceData[0], die2: diceData[1] }
          : diceData // Для дублей (4 элемента) или других случаев сохраняем массив
        : null
      
      // ВАЖНО: Правильно вычисляем canMove с учетом оставшихся кубиков
      // Если остались кубики и это еще наш ход - canMove должен быть true
      const remainingDice = Array.isArray(diceData) ? diceData : []
      const isMyTurn = data.currentPlayer === (isP1 ? 0 : 1)
      const hasRemainingDice = remainingDice.length > 0
      // canMove = это наш ход И есть кубики для хода
      const canMove = isMyTurn && hasRemainingDice
      
      console.log('🎯 [move_made] canMove calculation:', {
        isMyTurn,
        hasRemainingDice,
        remainingDice,
        canMove,
        currentPlayer: data.currentPlayer,
        isP1,
        diceData
      })
      
      // ВАЖНО: Очищаем pendingMoves только если ход был успешно применен
      // Проверяем, был ли это наш ход (мы отправили ходы)
      const wasMyMove = data.playerId === user?.id
      
      // Если это был ход противника (бота или другого игрока) - всегда очищаем
      if (!wasMyMove) {
        setPendingMoves([])
      } else {
        // Если это был наш ход - проверяем, остались ли кубики для продолжения
        const isDoubles = remainingDice.length === 4 && remainingDice.every((d: number) => d === remainingDice[0])
        
        // Если это дубль, остались кубики, и это еще наш ход - НЕ очищаем pendingMoves
        // Это позволяет сделать все 4 хода подряд без промежуточных подтверждений
        if (isDoubles && hasRemainingDice && isMyTurn) {
          // Для дублей оставляем pendingMoves, чтобы можно было продолжить
          console.log('🎲 Doubles: keeping pendingMoves for remaining dice:', remainingDice, 'pendingMoves:', pendingMoves.length, 'canMove:', canMove)
        } else {
          // Для обычных ходов или если все кубики использованы - очищаем
          setPendingMoves([])
        }
      }

      // Уведомляем SandboxControls об обновлении истории
      if (data.type === 'sandbox' || gameInfo?.type === 'sandbox') {
        window.dispatchEvent(new CustomEvent('sandbox-history-updated'))
      }
      
      // НЕ запускаем анимацию здесь, т.к. она уже запускается в dice_rolled событии
      // Это предотвращает дублирование анимации
      
      const isMyTurnNow = canMove
      const wasMyTurn = gameState?.canMove || false
      
      const timeLimitSeconds = gameInfo?.moveTimeLimit ? Math.floor(gameInfo.moveTimeLimit / 1000) : 60
      if (data.currentPlayer === 0) {
        setPlayer1Timer(timeLimitSeconds)
        setPlayer2Timer(timeLimitSeconds)
      } else {
        setPlayer2Timer(timeLimitSeconds)
        setPlayer1Timer(timeLimitSeconds)
      }
      
      const barRaw = data.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      // Создаем новый массив points для гарантированного обновления React
      const points = Array.isArray(data.gameState?.points) 
        ? [...data.gameState.points] 
        : []
      
      const nextGameState = {
        points,
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
        verificationSalt: data.verificationSalt,
        p1Rolls: data.p1Rolls,
        p2Rolls: data.p2Rolls,
      };

      // Если есть серверные ходы (ход бота или другого игрока), 
      // откладываем обновление gameState до завершения анимации
      if (data.serverMoves && data.serverMoves.length > 0) {
        console.log('🤖 Saving pending gameState and starting animation:', data.serverMoves);
        isServerAnimatingRef.current = true;
        pendingGameStateRef.current = nextGameState;
        setServerMovesForBoard(data.serverMoves);
      } else {
        setGameState(nextGameState);
        
        // ВАЖНО: После завершения хода обоих игроков нужно бросить кубики для следующего игрока
        // Проверяем, что кубики пустые и ход переключился на другого игрока
        const bothOffsetsChosen = data.p1OffsetChosenAt && data.p2OffsetChosenAt;
        const hasNoDice = !formattedDice || (Array.isArray(formattedDice) && formattedDice.length === 0);
        const turnChanged = !wasMyTurn && isMyTurnNow;
        
        if (hasNoDice && turnChanged && bothOffsetsChosen && data.status === 'in_progress' && data.type !== 'sandbox') {
          console.log('🎲 Auto-rolling dice after turn change in move_made:', { wasMyTurn, isMyTurnNow, hasNoDice, bothOffsetsChosen });
          setTimeout(() => {
            const socket = getSocket();
            if (socket && gameId) {
              socket.emit('roll_dice', { gameId });
            }
          }, 500);
        }
      }

      setGameStatus(data.status || 'in_progress')
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      
      // Сбрасываем таймер при смене хода
      if (!isMyTurnNow && wasMyTurn) {
        setMoveTimer(15)
        setIsInOvertime(false)
      }
      
      // Проверяем, выбрали ли оба игрока смещение
      const bothOffsetsChosen = data.p1OffsetChosenAt && data.p2OffsetChosenAt

      // Если это начало нашего хода - запускаем таймер и бросаем кубики если их нет
      // НО ТОЛЬКО если оба игрока выбрали смещение
      // НО НЕ для sandbox игр - там пользователь сам управляет всем
      // ВАЖНО: Если есть серверные анимации, авто-бросок произойдет в onServerMovesFinished
      if (isMyTurnNow && !wasMyTurn && bothOffsetsChosen) {
        setMoveTimer(15)
        
        const hasServerMoves = data.serverMoves && data.serverMoves.length > 0;
        if (!formattedDice && data.status === 'in_progress' && data.type !== 'sandbox' && !hasServerMoves) {
          // Автоматически бросаем кубики для следующего игрока (как в боте)
          setTimeout(() => {
            const socket = getSocket()
            if (socket) {
              socket.emit('roll_dice', { gameId })
            }
          }, 500)
        }
      }
    })

    socket.on('dice_rolled', handleDiceRolled);

    socket.on('offset_updated', (data: any) => {
      // Важно: gameInfo должен быть загружен, иначе не можем определить, кто мы
      if (!gameInfo || !user?.id) return
      
      const isP1 = gameInfo.player1Id === user.id
      const isP2 = gameInfo.player2Id === user.id
      
      // Если мы не участники игры (наблюдатели), ничего не делаем
      if (!isP1 && !isP2) return
      
      // Обновляем ТОЛЬКО смещение соперника из события
      // Свое смещение НЕ трогаем, так как оно уже установлено локально при движении ползунка
      if (isP1) {
        // Мы player1, обновляем ТОЛЬКО смещение player2 (соперника)
        // Игнорируем data.player1Offset полностью, т.к. это наш собственный offset
        if (data.player2Offset !== undefined) {
          // Проверяем, что это не наш только что отправленный offset (на случай, если событие пришло от нас самих)
          if (data.player2Offset !== lastSentOffsetRef.current) {
            setOpponentOffset(data.player2Offset || 1)
          }
        }
      } else if (isP2) {
        // Мы player2, обновляем ТОЛЬКО смещение player1 (соперника)
        // Игнорируем data.player2Offset полностью, т.к. это наш собственный offset
        if (data.player1Offset !== undefined) {
          // Проверяем, что это не наш только что отправленный offset (на случай, если событие пришло от нас самих)
          if (data.player1Offset !== lastSentOffsetRef.current) {
            setOpponentOffset(data.player1Offset || 1)
          }
        }
      }
      
      // Сбрасываем отслеживание после обработки события
      if (lastSentOffsetRef.current !== null) {
        lastSentOffsetRef.current = null
      }
    })

    socket.on('timer_update', (data: any) => {
      if (data.gameId === gameId) {
        // Используем данные из сервера
        const moveTimeRemaining = data.moveTimeRemaining !== undefined ? data.moveTimeRemaining : 15
        const totalTime1 = data.player1TimeRemaining !== undefined ? data.player1TimeRemaining : 60
        const totalTime2 = data.player2TimeRemaining !== undefined ? data.player2TimeRemaining : 60
        let isOvertime = data.isOvertime || false
        
        // Если таймер на ход близок к 15 (начало хода), сбрасываем овертайм
        // Это предотвращает отображение овертайма при первом броске кубиков
        if (moveTimeRemaining >= 14.5) {
          isOvertime = false
        }
        
        lastTimerUpdateRef.current = Date.now() // Обновляем время последнего синхронизации
        
        // Обновляем общее время игроков
        const newTotalTime = { player1: totalTime1, player2: totalTime2 }
        setTotalTimeRemaining(newTotalTime)
        totalTimeRemainingRef.current = newTotalTime
        setIsInOvertime(isOvertime)
        
        if (data.currentPlayer === 0) {
          // Ход игрока 1
          setPlayer1Timer(moveTimeRemaining)
          player1TimerRef.current = moveTimeRemaining
          setPlayer2Timer(15) // Соперник имеет полное время на ход
          player2TimerRef.current = 15
        } else {
          // Ход игрока 2
          setPlayer2Timer(moveTimeRemaining)
          player2TimerRef.current = moveTimeRemaining
          setPlayer1Timer(15) // Соперник имеет полное время на ход
          player1TimerRef.current = 15
        }
      }
    })

    socket.on('game_finished', (data: any) => {
      // Если пришли серверные ходы (последний ход игры), анимируем их
      if (data.serverMoves && data.serverMoves.length > 0) {
        console.log('🤖 Game finished with moves, starting animation');
        isServerAnimatingRef.current = true;
        setServerMovesForBoard(data.serverMoves);
        // Запоминаем финальное состояние для применения после анимации
        pendingGameStateRef.current = {
          ...(data.gameState || {}),
          status: 'finished',
          currentPlayer: data.winnerId === (data.player1Id || gameInfo?.player1Id) ? 0 : 1,
          canMove: false,
          player1Score: data.player1Score,
          player2Score: data.player2Score
        };
        // Устанавливаем счет сразу, чтобы он обновился в UI
        // Используем счет побед из серии матчей, если есть серия
        const winsScore = data.game?.matchesToWin > 1
          ? { player1: data.game?.player1Wins || 0, player2: data.game?.player2Wins || 0 }
          : { player1: data.player1Score || 0, player2: data.player2Score || 0 }
        setScore(winsScore);
      } else {
        setGameStatus('finished')
        setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      }
    })

    socket.on('sandbox_board_updated', (data: any) => {
      console.log('🏗️ Sandbox board updated:', data)
      if (data.gameState) {
        const barRaw = data.gameState.bar || [0, 0]
        const bar = Array.isArray(barRaw) 
          ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
          : barRaw
          
        const bearOffRaw = data.gameState.bearOff || data.gameState.borneOff || [0, 0]
        const bearOff = Array.isArray(bearOffRaw)
          ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
          : bearOffRaw
        
        const points = Array.isArray(data.gameState.points) 
          ? [...data.gameState.points] 
          : []
        
        setGameState(prev => ({
          ...prev,
          ...data.gameState,
          points,
          bar,
          bearOff,
          currentPlayer: data.currentPlayer !== undefined ? data.currentPlayer : prev?.currentPlayer,
          canMove: true
        }))
      }
    })

    socket.on('sandbox_dice_updated', (data: any) => {
      console.log('🎲 Sandbox dice updated:', data)
      setGameState(prev => ({
        ...prev,
        dice: data.dice,
        currentPlayer: data.currentPlayer !== undefined ? data.currentPlayer : prev?.currentPlayer,
        canMove: true
      }))
      
      // Запускаем анимацию кубиков
      setDiceAnimating(true)
      setTimeout(() => setDiceAnimating(false), 1500)
    })

    const matchmakingSocket = getMatchmakingSocket()
    if (matchmakingSocket && gameId && !isBotGame) {
      matchmakingSocket.on('ready_status', (data: any) => {
        if (data.gameId === gameId) {
          setPlayer1Ready(data.player1Ready || false)
          setPlayer2Ready(data.player2Ready || false)
          const isP1 = gameInfo?.player1Id === user?.id
          setMyReady(isP1 ? (data.player1Ready || false) : (data.player2Ready || false))
          // Обновляем информацию об игре для актуального состояния
          loadGame()
        }
      })

      matchmakingSocket.on('game_started', (data: any) => {
        if (data.gameId === gameId) {
          setGameStatus('in_progress')
          setPlayer1Ready(true)
          setPlayer2Ready(true)
          setMyReady(true)
          if (data.game) {
            setGameInfo(data.game)
            // Автоматически загружаем игру и бросаем кубики
            // НО НЕ для sandbox игр - там пользователь сам управляет всем
            loadGame().then(() => {
              // Небольшая задержка для обновления состояния
              setTimeout(() => {
                const socket = getSocket()
                if (socket && data.game.currentPlayer === (data.game.player1Id === user?.id ? 0 : 1) && data.game.type !== 'sandbox') {
                  // Если это наш ход, бросаем кубики (но не для sandbox)
                  socket.emit('roll_dice', { gameId })
                }
              }, 300)
            })
          } else {
            loadGame()
          }
        }
      })

      matchmakingSocket.on('opponent_joined', (data: any) => {
        if (data.gameId === gameId) {
          if (data.game) {
            setGameInfo(data.game)
            setOpponent(data.game.player1Id === user?.id ? data.game.player2 : data.game.player1)
            setGameStatus(data.game.status || 'waiting')
            setPlayer1Ready(false)
            setPlayer2Ready(false)
            setMyReady(false)
            if (data.game.player1Id && data.game.player2Id) {
              loadPlayerSkins(data.game.player1Id, data.game.player2Id)
            }
          }
          loadGame()
        }
      })

      matchmakingSocket.on('player_timeout', (data: any) => {
        if (data.gameId === gameId && data.timeoutPlayerId !== user?.id) {
          alert('Соперник не подтвердил готовность в течение минуты и был исключен. Ожидание нового соперника...')
          setPlayer1Ready(false)
          setPlayer2Ready(false)
          setMyReady(false)
          loadGame()
        }
      })
    }
  }

  const handleMove = async (from: number, to: number, die: number, steps?: any[]) => {
    if (!gameId || !gameState?.canMove) return

    // Проверка на бар для коротких нард: если есть шашки на баре, нельзя ходить с доски
    if (gameInfo?.mode === 'short') {
      const bar = gameState.bar || { white: 0, black: 0 }
      const isPlayer1 = gameInfo.player1Id === user?.id
      const hasBarCheckers = isPlayer1 ? bar.white > 0 : bar.black > 0
      const isBarMove = from === 24 || from === 25
      
      if (hasBarCheckers && !isBarMove) {
        // Есть шашки на баре, но пытаются ходить с доски
        alert('Сначала выведите шашки с бара')
        return
      }
    }

    const diceArray = (() => {
      const d = gameState.dice;
      if (!d) return [];
      if (Array.isArray(d)) return d;
      return [d.die1, d.die2];
    })();
    
    // Если кубиков нет, ничего не делаем (возможно, ход уже завершен или обрабатывается)
    if (diceArray.length === 0) {
      console.warn('⚠️ handleMove вызван, но кубики отсутствуют в gameState');
      return;
    }
    
    // Проверяем, является ли это дублем (4 одинаковых кубика)
    // При дубле разрешаем все 4 хода сразу без принудительного подтверждения между ними
    const isDoubles = diceArray.length === 4 && diceArray.every(d => d === diceArray[0])
    
    // Для дублей разрешаем все 4 хода сразу без ограничения на подтверждение
    // Пользователь может сделать все 4 хода и отменить любое количество (до 4х отмен)
    if (isDoubles && pendingMoves.length >= 4) {
      return // Максимум 4 хода для дубля
    }
    
    // Если есть steps, значит это комбинированный ход
    if (steps && steps.length > 0) {
      // Для дублей разрешаем использовать все 4 кубика, поэтому пропускаем проверку
      if (!isDoubles) {
        // Проверяем доступность всех кубиков в комбинации (только для не-дублей)
        const currentDiceUsage = new Map<number, number>();
        pendingMoves.forEach(m => {
          if (m.steps) {
            m.steps.forEach((s: any) => currentDiceUsage.set(s.die, (currentDiceUsage.get(s.die) || 0) + 1));
          } else {
            currentDiceUsage.set(m.die, (currentDiceUsage.get(m.die) || 0) + 1);
          }
        });

        for (const step of steps) {
          const used = (currentDiceUsage.get(step.die) || 0) + steps.filter((s, idx) => s.die === step.die && steps.indexOf(s) < steps.indexOf(step)).length;
          const avail = diceArray.filter(d => d === step.die).length;
          if (used >= avail) {
            console.warn(`⚠️ Кубик ${step.die} из комбинации уже использован. Доступно: ${avail}, Использовано: ${used}`);
            return;
          }
        }
      }
      setPendingMoves(prev => [...prev, { from, to, die, steps }])
      return
    }

    // ПЕРЕПИСАННАЯ ЛОГИКА ДЛЯ ДУБЛЕЙ
    // При дубле разрешаем ходы с die равным: doublesValue, doublesValue*2, doublesValue*3, doublesValue*4
    if (isDoubles) {
      const doublesValue = diceArray[0];
      const allowedValues = [doublesValue, doublesValue * 2, doublesValue * 3, doublesValue * 4];
      
      // Проверяем, что die является допустимым значением для дубля
      if (!allowedValues.includes(die)) {
        console.warn(`⚠️ При дубле ${doublesValue}/${doublesValue} можно использовать только ходы на ${allowedValues.join(', ')}. Получен: ${die}`);
        return;
      }
      
      // Подсчитываем общее количество использованных кубиков
      let totalUsed = 0;
      for (const move of pendingMoves) {
        if (move.die && isDoubles) {
          const moveDoublesValue = diceArray[0];
          if (move.die % moveDoublesValue === 0) {
            totalUsed += move.die / moveDoublesValue;
          } else {
            totalUsed += 1; // Если не кратно, считаем как 1 кубик
          }
        } else {
          totalUsed += 1;
        }
      }
      
      // Проверяем, сколько кубиков потребуется для нового хода
      const diceNeededForMove = die / doublesValue;
      
      if (totalUsed + diceNeededForMove > 4) {
        console.warn(`⚠️ При дубле нельзя использовать более 4 кубиков. Уже использовано: ${totalUsed}, требуется: ${diceNeededForMove}`);
        return;
      }
      
      // Для дублей добавляем ход без дополнительных проверок
    } else {
      // Обычная логика для не-дублей
      if (die <= 6 && (!steps || steps.length === 0)) {
        const currentDiceUsage = new Map<number, number>();
        pendingMoves.forEach(m => {
          if (m.steps) {
            m.steps.forEach((s: any) => currentDiceUsage.set(s.die, (currentDiceUsage.get(s.die) || 0) + 1));
          } else {
            currentDiceUsage.set(m.die, (currentDiceUsage.get(m.die) || 0) + 1);
          }
        });

        const usedCount = currentDiceUsage.get(die) || 0;
        const availableCount = diceArray.filter(d => d === die).length
        
        if (usedCount >= availableCount) {
          console.warn(`⚠️ Кубик ${die} уже использован максимальное количество раз. Доступно: ${availableCount}, Использовано: ${usedCount}`);
          return
        }
      } else if (die > 6) {
        // Для хода > 6 (комбинированный) должен быть steps
        if (!steps || steps.length === 0) {
          console.warn(`Move with die=${die} but no steps provided`);
          return; // Не добавляем такой ход
        }
      }
    }

    setPendingMoves(prev => [...prev, { from, to, die, steps }])
  }

  const handleUndo = () => {
    if (pendingMoves.length > 0) {
      setPendingMoves(prev => prev.slice(0, -1))
      // После отмены хода нужно перезагрузить возможные ходы
      // Это произойдет автоматически через useEffect в BackgammonBoard при изменении pendingMoves
    }
  }

  const handleSwapDice = () => {
    if (!gameState?.dice) return
    const diceArray = (() => {
      const d = gameState.dice;
      if (!d) return [];
      if (Array.isArray(d)) return d;
      return [d.die1, d.die2];
    })();
    
    if (diceArray.length < 2) return
    const newDice = [...diceArray].reverse()
    setGameState(prev => prev ? { ...prev, dice: newDice } : null)
  }

  const handleRollDice = async () => {
    if (!gameId) return
    const socket = getSocket()
    if (!socket) return
    socket.emit('roll_dice', { gameId })
  }

  const handleReadyToStart = async () => {
    if (!gameId) return
    const ms = getMatchmakingSocket()
    if (!ms) {
      alert('WebSocket не подключен. Перезагрузите страницу.')
      return
    }
    ms.emit('ready_to_start', { gameId })
    setMyReady(true)
  }

  const handleOffsetChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (isNaN(val) || val < 1 || val > 5) return
    // Обновляем локально только свой offset
    setMyOffset(val)
    // Сохраняем отправленное значение, чтобы игнорировать его в offset_updated
    lastSentOffsetRef.current = val
    try {
      await apiClient.post(`/games/${gameId}/offset`, { offset: val })
      // После успешной отправки НЕ обновляем локальное состояние,
      // т.к. оно уже обновлено выше. Событие offset_updated придет от сервера,
      // но мы его проигнорируем для своего offset.
    } catch (error) {
      // Если ошибка, сбрасываем отслеживание
      lastSentOffsetRef.current = null
    }
  }

  const handleConfirmOffset = async () => {
    if (!gameId) return
    try {
      // Отправляем текущее значение смещения на сервер
      await apiClient.post(`/games/${gameId}/offset`, { offset: myOffset })
      setOffsetConfirmed(true)
      setShowOffsetModal(false)
      
      // ВАЖНО: Перезагружаем игру после выбора смещения, чтобы получить обновленное состояние
      // Это нужно для загрузки доски после выбора смещения обоими игроками
      setTimeout(() => {
        loadGame()
      }, 500)
      
      // Для игр с ботом автоматически начинаем игру после выбора смещения
      if (isBotGame || gameInfo?.type === 'vs_bot') {
        // Игра с ботом начнется автоматически
      } else if (gameInfo?.type === 'vs_player' || gameInfo?.type === 'tournament') {
        // Для игр с игроком или турниров - ждем готовности обоих игроков
        // Кнопка "Готов" уже есть в интерфейсе
      }
    } catch (error) {
      console.error('Ошибка при сохранении смещения:', error)
      alert('Не удалось сохранить смещение. Попробуйте еще раз.')
    }
  }

  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false)

  const handleConfirm = async () => {
    if (!gameId || isProcessingConfirm) return

    if (gameStatus === 'waiting' && !isBotGame && gameInfo?.type === 'vs_player') return

    if (gameStatus === 'waiting' && isBotGame) {
      try {
        let socket = getSocket()
        if (!socket || !socket.connected) {
          const { token } = useAuthStore.getState()
          if (token) {
            connectWebSocket(token)
            await new Promise(resolve => setTimeout(resolve, 500))
            socket = getSocket()
          }
          if (!socket || !socket.connected) {
            alert('Ошибка подключения. Попробуйте обновить страницу.')
            return
          }
        }
        socket.emit('roll_dice', { gameId })
        setTimeout(() => loadGame(), 2000)
      } catch (error) {
        alert('Ошибка начала игры: ' + (error as Error).message)
      }
      return
    }

    if (gameStatus === 'in_progress' && gameState?.canMove && pendingMoves.length > 0) {
      // Проверка на бар для коротких нард перед отправкой ходов
      if (gameInfo?.mode === 'short') {
        const bar = gameState.bar || { white: 0, black: 0 }
        const isPlayer1 = gameInfo.player1Id === user?.id
        const hasBarCheckers = isPlayer1 ? bar.white > 0 : bar.black > 0
        
        if (hasBarCheckers) {
          // Проверяем, есть ли хотя бы один ход не с бара
          const hasNonBarMove = pendingMoves.some(move => {
            const from = move.from === 24 || move.from === 25 ? -1 : move.from
            return from !== -1
          })
          
          if (hasNonBarMove) {
            alert('Сначала выведите шашки с бара')
            setPendingMoves([])
            return
          }
        }
      }
      
      const socket = getSocket()
      if (!socket) {
        alert('Ошибка подключения. Перезагрузите страницу.')
        return
      }
      setIsProcessingConfirm(true)
      try {
        setMoveTimer(15)
        
        const onMoveError = (err: any) => {
          console.error('❌ Move rejected:', err)
          console.error('❌ Pending moves that were rejected:', pendingMoves)
          // Просто откатываем ходы без показа ошибки
          setPendingMoves([])
          setIsProcessingConfirm(false)
          socket.off('error', onMoveError)
        }
        socket.on('error', onMoveError)
        setTimeout(() => {
          socket.off('error', onMoveError)
          setIsProcessingConfirm(false)
        }, 3000)
        
        console.log('📤 Sending moves to server:', pendingMoves)
        socket.emit('make_move', { gameId, moves: pendingMoves })
        // pendingMoves будут очищены в обработчике move_made, чтобы избежать двойного применения в virtualGameState
      } catch (error) {
        // Просто откатываем ходы без показа ошибки
        setPendingMoves([])
        setIsProcessingConfirm(false)
        console.error('Ошибка отправки ходов:', error)
      }
    }
  }

  if (!gameState || !gameInfo) {
    return (
      <div className="app-container">
        <PageHeader title="Игра" />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div className="loading-spinner" />
          <p>Загрузка игры...</p>
        </div>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getGameModeName = (mode: string) => {
    const modeUpper = (mode || '').toUpperCase()
    return modeUpper === 'LONG' ? 'Длинные' : 'Короткие'
  }

  const tableNumber = gameId?.slice(-2) || '0'
  const gameMode = gameInfo.mode || 'LONG'
  const stake = Number(gameInfo.stake || 0)

  const handleBack = async () => {
    if (isBotGame && gameInfo?.type === 'vs_bot') {
      navigate('/game/modes')
      return
    }
    // В sandbox режиме просто выходим без модального окна
    if (gameInfo?.type === 'sandbox') {
      navigate('/')
      return
    }
    if (gameStatus === 'in_progress' && gameId && gameInfo?.type !== 'vs_bot') {
      setShowExitModal(true)
      return
    }
    if (gameStatus !== 'finished' && gameId && gameInfo?.type !== 'vs_bot') {
      try {
        await apiClient.post(`/games/${gameId}/resign`)
      } catch (error) {}
    }
    navigate('/')
  }

  const handleConfirmExit = async () => {
    setShowExitModal(false)
    if (gameId) {
      try {
        await apiClient.post(`/games/${gameId}/resign`)
      } catch (error) {}
    }
    navigate('/')
  }

  return (
    <div className={`app-container game-container page-transition ${isLandscape ? 'landscape-mode' : ''}`}>
      <PageHeader 
        title={`Table ${tableNumber} - ${getGameModeName(gameMode)}${stake > 0 ? ` - ${stake} NAR` : ''}`}
        onBack={handleBack}
      />
      
      <div className="game-main-layout">
        {/* Левая панель (ландшафт) */}
        {isLandscape && (
          <div className="game-side-panel left">
              <div className={`game-player ${!isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">
                  {opponentPlayer?.nickname || opponentPlayer?.username || 'Соперник'}
                  <div className="pip-count-display">
                    {pipCounts.player2}
                    {pipDiff.player2 !== null && pipDiff.player2 !== 0 && (
                      <span className={`pip-diff ${pipDiff.player2 < 0 ? 'good' : 'bad'}`}>
                        ({pipDiff.player2 > 0 ? '+' : ''}{pipDiff.player2})
                      </span>
                    )}
                  </div>
                </div>
                <div className="game-player-avatar">
                  {opponentPlayer?.avatarUrl ? <img src={opponentPlayer.avatarUrl} alt={opponentPlayer.username} /> : <Icon name="user" size={48} />}
                  {gameStatus === 'in_progress' && (() => {
                    // Таймер противника (всегда слева)
                    // Если я player1, то противник = player2
                    // Если я player2, то противник = player1
                    const opponentTimer = isPlayer1 ? player2Timer : player1Timer
                    const opponentTotalTime = isPlayer1 ? totalTimeRemaining.player2 : totalTimeRemaining.player1
                    const isOvertime = opponentTimer <= 0 || isInOvertime
                    const progress = isOvertime 
                      ? Math.max(0, Math.min(1, opponentTotalTime / 60))
                      : Math.max(0, Math.min(1, opponentTimer / 15))
                    return (
                      <svg className="game-player-timer-ring" viewBox="0 0 100 100">
                        <circle
                          className="game-player-timer-ring-bg"
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth="6"
                        />
                        <circle
                          className={`game-player-timer-ring-progress ${isOvertime ? 'overtime' : 'normal'}`}
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke={isOvertime ? '#FF9800' : '#4caf50'}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 45}
                          strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    )
                  })()}
                </div>
              </div>
            
            <div className="game-score-side">
              <div className="game-score-label">до {gameInfo?.matchesToWin || 1}</div>
              <div className="game-score">{score.player1}:{score.player2}</div>
            </div>
          </div>
        )}

        <div className="game-center-content">
          {!isLandscape && (
            <div className="game-players-section">
              {/* Кнопки подтверждения и отмены в портретном режиме */}
              {gameStatus === 'in_progress' && isMyTurn && gameState?.dice && pendingMoves.length > 0 && (
                <>
                  <button 
                    className="game-action-btn-header game-action-btn-cancel"
                    onClick={handleUndo}
                    title="Отменить ход"
                  >
                    ✕
                  </button>
                  <button 
                    className="game-action-btn-header game-action-btn-confirm"
                    onClick={handleConfirm}
                    title={`Подтвердить (${pendingMoves.length})`}
                  >
                    ✓
                  </button>
                </>
              )}
              {/* Противник слева */}
              <div className={`game-player ${!isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">{opponentPlayer?.nickname || opponentPlayer?.username || 'Соперник'}</div>
                <div className="game-player-avatar">
                  {opponentPlayer?.avatarUrl ? <img src={opponentPlayer.avatarUrl} alt={opponentPlayer.username} /> : <Icon name="user" size={48} />}
                  {gameStatus === 'in_progress' && (() => {
                    // Таймер противника (всегда слева)
                    // Если я player1, то противник = player2
                    // Если я player2, то противник = player1
                    const opponentTimer = isPlayer1 ? player2Timer : player1Timer
                    const opponentTotalTime = isPlayer1 ? totalTimeRemaining.player2 : totalTimeRemaining.player1
                    const isOvertime = opponentTimer <= 0 || isInOvertime
                    const progress = isOvertime 
                      ? Math.max(0, Math.min(1, opponentTotalTime / 60))
                      : Math.max(0, Math.min(1, opponentTimer / 15))
                    return (
                      <svg className="game-player-timer-ring" viewBox="0 0 100 100">
                        <circle
                          className="game-player-timer-ring-bg"
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth="6"
                        />
                        <circle
                          className={`game-player-timer-ring-progress ${isOvertime ? 'overtime' : 'normal'}`}
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke={isOvertime ? '#FF9800' : '#4caf50'}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 45}
                          strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    )
                  })()}
                </div>
              </div>
              {/* Счет в центре */}
              <div className="game-score-section">
                <div className="game-score-label">до {gameInfo?.matchesToWin || 1}</div>
                <div className="game-score">{score.player1}:{score.player2}</div>
              </div>
              {/* Я справа */}
              <div className={`game-player ${isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">{myPlayer?.nickname || myPlayer?.username || 'Вы'}</div>
                <div className="game-player-avatar">
                  {myPlayer?.avatarUrl ? <img src={myPlayer.avatarUrl} alt={myPlayer.username} /> : <Icon name="user" size={48} />}
                  {gameStatus === 'in_progress' && (() => {
                    // Мой таймер (всегда справа)
                    // Если я player1, то мой таймер = player1Timer
                    // Если я player2, то мой таймер = player2Timer
                    const myTimer = isPlayer1 ? player1Timer : player2Timer
                    const myTotalTime = isPlayer1 ? totalTimeRemaining.player1 : totalTimeRemaining.player2
                    const isOvertime = myTimer <= 0 || isInOvertime
                    const progress = isOvertime 
                      ? Math.max(0, Math.min(1, myTotalTime / 60))
                      : Math.max(0, Math.min(1, myTimer / 15))
                    return (
                      <svg className="game-player-timer-ring" viewBox="0 0 100 100">
                        <circle
                          className="game-player-timer-ring-bg"
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth="6"
                        />
                        <circle
                          className={`game-player-timer-ring-progress ${isOvertime ? 'overtime' : 'normal'}`}
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke={isOvertime ? '#FF9800' : '#4caf50'}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 45}
                          strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Состояние ожидания (только в портрете или если не в процессе) */}
          {gameStatus === 'waiting' && !isBotGame && gameInfo?.type === 'vs_player' && (
            <div className="game-waiting-section">
              {!gameInfo?.player2Id ? (
                <div>⏳ Ожидание соперника...</div>
              ) : (
                <div className="fair-play-setup">
                  <h3>Контроль честности</h3>
                  <div className="hash-display">
                    <div>Хеш последовательности (SHA-256):</div>
                    <code>
                      {(() => {
                        try {
                          if (typeof gameInfo.rngHash === 'string') {
                            // Пытаемся распарсить как JSON
                            const parsed = JSON.parse(gameInfo.rngHash)
                            if (parsed && parsed.p1Hash) {
                              return parsed.p1Hash.substring(0, 16) + '...'
                            }
                          }
                          // Если это не JSON или не объект с p1Hash, показываем первые 16 символов строки
                          return gameInfo.rngHash ? gameInfo.rngHash.substring(0, 16) + '...' : '---'
                        } catch (e) {
                          // Если не удалось распарсить, показываем первые 16 символов
                          return typeof gameInfo.rngHash === 'string' 
                            ? gameInfo.rngHash.substring(0, 16) + '...'
                            : '---'
                        }
                      })()}
                    </code>
                  </div>
                  
                  <div className="offset-selector">
                    <label>Ваше смещение (1-5):</label>
                    <p className="offset-hint">Каждый игрок выбирает свое смещение независимо</p>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      value={myOffset} 
                      onChange={handleOffsetChange}
                      disabled={myReady}
                    />
                    <div className="offset-values">
                      <span>Вы: <strong>{myOffset}</strong></span>
                      <span>Соперник: <strong>{opponentOffset}</strong></span>
                    </div>
                  </div>

                  {!myReady ? (
                    <Button variant="primary" onClick={handleReadyToStart} className="ready-btn">Готов</Button>
                  ) : (
                    <div className="ready-status">✅ Готов. Ожидание соперника...</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Экран подготовки к игре (отсчет 10 секунд после выбора смещения) */}
          {preparationCountdown !== null && preparationCountdown > 0 && gameStatus === 'waiting' && (
            <div className="game-preparation-screen">
              <div className="preparation-content">
                <div className="preparation-title">Подготовка к игре</div>
                <div className="preparation-countdown">{preparationCountdown}</div>
                <div className="preparation-message">Генерация ходов...</div>
              </div>
            </div>
          )}

          {/* Доска */}
          {(gameStatus === 'in_progress' || gameStatus === 'finished' || isSandbox) && (
            <div className="board-wrapper">
              {/* Кнопки подтверждения и отмены в нижней части бара (ландшафт) */}
              {isLandscape && gameStatus === 'in_progress' && isMyTurn && gameState?.dice && pendingMoves.length > 0 && (
                <>
                  <button 
                    className="game-bar-btn game-bar-btn-cancel"
                    onClick={handleUndo}
                    title="Отменить ход"
                  >
                    ✕
                  </button>
                  <button 
                    className="game-bar-btn game-bar-btn-confirm"
                    onClick={handleConfirm}
                    title={`Подтвердить (${pendingMoves.length})`}
                  >
                    ✓
                  </button>
                </>
              )}
              <BackgammonBoard
                key={`board-${gameId}`}
                player1Skins={playerSkins.player1}
                player2Skins={playerSkins.player2}
                mySkins={playerSkins.mySkins}
                gameState={historyGameState || gameState}
                currentPlayer={(historyGameState || gameState)?.currentPlayer || 0}
                dice={(() => {
                  const d = (historyGameState || gameState)?.dice;
                  if (!d) return null;
                  if (Array.isArray(d)) return d;
                  return [d.die1, d.die2];
                })()}
                onMove={handleMove}
                onRollDice={handleRollDice}
                canMove={historyGameState ? false : (gameState?.canMove || false)}
                isMyTurn={historyGameState ? false : isMyTurn}
                gameId={gameId}
                gameMode={gameInfo?.mode || 'long'}
                pendingMoves={historyGameState ? [] : pendingMoves}
                diceAnimating={diceAnimating}
                myPlayerId={user?.id}
                player1Id={gameInfo?.player1Id}
                player2Id={gameInfo?.player2Id}
                player1Name={gameInfo?.player1?.nickname || gameInfo?.player1?.username}
                player2Name={gameInfo?.player2?.nickname || gameInfo?.player2?.username || 'Бот'}
                isSandbox={isSandbox}
                sandboxMode={sandboxMode}
                serverMoves={serverMovesForBoard}
                onServerMovesFinished={() => {
                  isServerAnimatingRef.current = false;
                  if (pendingGameStateRef.current) {
                    console.log('🤖 Applying pending gameState after animation');
                    const pending = pendingGameStateRef.current;
                    
                    // Если это было финальное состояние игры (есть статус finished)
                    if (pending.status === 'finished' || gameStatus === 'finished') {
                      setGameStatus('finished');
                    }
                    
                    const wasMyTurnBefore = gameState?.canMove || false;
                    const wasMyTurnBeforeByPlayer = gameState?.currentPlayer === (gameInfo?.player1Id === user?.id ? 0 : 1);
                    
                    setGameState(pending);
                    pendingGameStateRef.current = null;
                    setServerMovesForBoard(undefined);

                    // ВАЖНО: После завершения анимации хода противника (бота или другого игрока)
                    // проверяем, нужно ли бросить кубики для следующего игрока
                    // НЕ используем pending.canMove, т.к. он может быть false если кубики пустые
                    // Вместо этого проверяем currentPlayer напрямую
                    const isMyTurnNowByPlayer = pending.currentPlayer === (gameInfo?.player1Id === user?.id ? 0 : 1);
                    const hasNoDice = !pending.dice || (Array.isArray(pending.dice) && pending.dice.length === 0);
                    const turnChanged = !wasMyTurnBeforeByPlayer && isMyTurnNowByPlayer;
                    const bothOffsetsChosen = gameInfo?.p1OffsetChosenAt && gameInfo?.p2OffsetChosenAt;
                    
                    console.log('🎲 [onServerMovesFinished] Checking dice roll:', {
                      wasMyTurnBeforeByPlayer,
                      isMyTurnNowByPlayer,
                      hasNoDice,
                      turnChanged,
                      bothOffsetsChosen,
                      gameStatus,
                      currentPlayer: pending.currentPlayer,
                      dice: pending.dice
                    });
                    
                    // Бросаем кубики если:
                    // 1. Это наш ход (isMyTurnNowByPlayer)
                    // 2. Кубики пустые (hasNoDice)
                    // 3. Оба игрока выбрали смещение (bothOffsetsChosen)
                    // 4. Игра в процессе (in_progress)
                    // 5. Не sandbox игра
                    if (isMyTurnNowByPlayer && hasNoDice && bothOffsetsChosen && gameStatus === 'in_progress' && gameInfo?.type !== 'sandbox') {
                      console.log('🎲 Auto-rolling dice after server animation finished');
                      setTimeout(() => {
                        const socket = getSocket();
                        if (socket && gameId) {
                          socket.emit('roll_dice', { gameId });
                        }
                      }, 500);
                    }
                  }
                }}
                onSandboxCheckerDrop={isSandbox ? async (pointIndex: number, checkerColor: 'white' | 'black') => {
                  if (!gameId) return
                  try {
                    const currentPoints = [...(gameState.points || Array(24).fill(0))]
                    const currentValue = currentPoints[pointIndex] || 0
                    const currentBearOff = { ...(gameState.bearOff || { white: 0, black: 0 }) }
                    
                    // Проверяем, есть ли шашки в bearOff
                    if (checkerColor === 'white' && currentBearOff.white <= 0) {
                      alert('Нет белых шашек в лоте')
                      return
                    }
                    if (checkerColor === 'black' && currentBearOff.black <= 0) {
                      alert('Нет черных шашек в лоте')
                      return
                    }
                    
                    // Уменьшаем bearOff и добавляем шашку на точку
                    if (checkerColor === 'white') {
                      currentBearOff.white = currentBearOff.white - 1
                      currentPoints[pointIndex] = currentValue + 1
                    } else {
                      currentBearOff.black = currentBearOff.black - 1
                      currentPoints[pointIndex] = currentValue - 1
                    }
                    
                    await apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
                      points: currentPoints,
                      bar: gameState.bar || { white: 0, black: 0 },
                      bearOff: currentBearOff,
                    })
                    
                    // Обновляем состояние
                    if (gameId) {
                      const response = await apiClient.get(`/games/${gameId}`)
                      const data = response.data
                      const barRaw = data.gameState?.bar || [0, 0]
                      const bar = Array.isArray(barRaw) 
                        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
                        : barRaw
                      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
                      const bearOff = Array.isArray(bearOffRaw)
                        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
                        : bearOffRaw
                      const points = Array.isArray(data.gameState?.points) 
                        ? [...data.gameState.points] 
                        : []
                      setGameState({
                        points,
                        bar,
                        bearOff,
                        currentPlayer: data.currentPlayer || 0,
                        dice: gameState.dice,
                        canMove: true,
                        verificationSalt: data.verificationSalt,
                        p1Rolls: data.p1Rolls,
                        p2Rolls: data.p2Rolls,
                      })
                    }
                  } catch (error: any) {
                    alert(error.response?.data?.message || 'Ошибка обновления доски')
                  }
                } : undefined}
                onSandboxCheckerRemove={isSandbox ? async (pointIndex: number) => {
                  if (!gameId) return
                  try {
                    const currentPoints = [...(gameState.points || Array(24).fill(0))]
                    const currentValue = currentPoints[pointIndex] || 0
                    
                    if (currentValue > 0) {
                      currentPoints[pointIndex] = currentValue - 1
                    } else if (currentValue < 0) {
                      currentPoints[pointIndex] = currentValue + 1
                    }
                    
                    await apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
                      points: currentPoints,
                      bar: gameState.bar || { white: 0, black: 0 },
                      bearOff: gameState.bearOff || { white: 0, black: 0 },
                    })
                    
                    // Обновляем состояние
                    if (gameId) {
                      const response = await apiClient.get(`/games/${gameId}`)
                      const data = response.data
                      const barRaw = data.gameState?.bar || [0, 0]
                      const bar = Array.isArray(barRaw) 
                        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
                        : barRaw
                      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
                      const bearOff = Array.isArray(bearOffRaw)
                        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
                        : bearOffRaw
                      const points = Array.isArray(data.gameState?.points) 
                        ? [...data.gameState.points] 
                        : []
                      setGameState({
                        points,
                        bar,
                        bearOff,
                        currentPlayer: data.currentPlayer || 0,
                        dice: gameState.dice,
                        canMove: true,
                        verificationSalt: data.verificationSalt,
                        p1Rolls: data.p1Rolls,
                        p2Rolls: data.p2Rolls,
                      })
                    }
                  } catch (error: any) {
                    alert(error.response?.data?.message || 'Ошибка обновления доски')
                  }
                } : undefined}
              />
              {isSandbox && (
                <>
                  <SandboxControls
                    gameId={gameId || ''}
                    gameState={gameState}
                    currentPlayer={gameState?.currentPlayer || 0}
                    onModeChange={(mode) => setSandboxMode(mode)}
                    onBoardUpdate={() => {
                      // Перезагружаем состояние игры
                      if (gameId) {
                        apiClient.get(`/games/${gameId}`).then((response) => {
                          const data = response.data
                          const diceData = data.gameState?.dice
                          const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
                            ? { die1: diceData[0], die2: diceData[1] } 
                            : null
                          const barRaw = data.gameState?.bar || [0, 0]
                          const bar = Array.isArray(barRaw) 
                            ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
                            : barRaw
                          const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
                          const bearOff = Array.isArray(bearOffRaw)
                            ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
                            : bearOffRaw
                          const points = Array.isArray(data.gameState?.points) 
                            ? [...data.gameState.points] 
                            : []
                          setGameState({
                            points,
                            bar,
                            bearOff,
                            currentPlayer: data.currentPlayer || 0,
                            dice: formattedDice,
                            canMove: true,
                          })
                        }).catch(console.error)
                      }
                    }}
                    onHistoryPreview={(previewState) => {
                      if (previewState) {
                        // Форматируем кубики для previewState если нужно
                        const diceData = previewState.dice
                        const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
                          ? { die1: diceData[0], die2: diceData[1] } 
                          : null
                        
                        setHistoryGameState({
                          ...previewState,
                          dice: formattedDice,
                          canMove: false
                        })
                      } else {
                        setHistoryGameState(null)
                      }
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Правая панель (ландшафт) */}
        {isLandscape && (
          <div className="game-side-panel right">
            
            <div className={`game-player ${isPlayer1 ? 'game-player-me' : ''}`}>
              <div className="game-player-name">
                {myPlayer?.nickname || myPlayer?.username || 'Вы'}
                <div className="pip-count-display">
                  {pipCounts.player1}
                  {pipDiff.player1 !== null && pipDiff.player1 !== 0 && (
                    <span className={`pip-diff ${pipDiff.player1 < 0 ? 'good' : 'bad'}`}>
                      ({pipDiff.player1 > 0 ? '+' : ''}{pipDiff.player1})
                    </span>
                  )}
                </div>
              </div>
              <div className="game-player-avatar">
                {myPlayer?.avatarUrl ? <img src={myPlayer.avatarUrl} alt={myPlayer.username} /> : <Icon name="user" size={48} />}
                {gameStatus === 'in_progress' && (() => {
                  // Мой таймер (всегда справа)
                  // Если я player1, то мой таймер = player1Timer
                  // Если я player2, то мой таймер = player2Timer
                  const myTimer = isPlayer1 ? player1Timer : player2Timer
                  const myTotalTime = isPlayer1 ? totalTimeRemaining.player1 : totalTimeRemaining.player2
                  const isOvertime = myTimer <= 0 || isInOvertime
                  const progress = isOvertime 
                    ? Math.max(0, Math.min(1, myTotalTime / 60))
                    : Math.max(0, Math.min(1, myTimer / 20))
                  return (
                    <svg className="game-player-timer-ring" viewBox="0 0 100 100">
                      <circle
                        className="game-player-timer-ring-bg"
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="6"
                      />
                      <circle
                        className={`game-player-timer-ring-progress ${isOvertime ? 'overtime' : 'normal'}`}
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={isOvertime ? '#FF9800' : '#4caf50'}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 45}
                        strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                  )
                })()}
              </div>
            </div>

          </div>
        )}
      </div>


      {/* Модальные окна рендерятся через Portal вне контейнера игры */}
      {showExitModal && createPortal(
        <div 
          className="offset-modal-overlay modal-visible"
          onClick={() => setShowExitModal(false)}
          style={{
            position: 'fixed', top: '0px', left: '0px', right: '0px', bottom: '0px',
            width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh',
            background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2147483647, padding: '12px', margin: '0',
            border: 'none', outline: 'none', touchAction: 'none', overflow: 'hidden',
            overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            className="offset-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              padding: '20px', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
              width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
            }}
          >
            <h2>Выход из игры</h2>
            <p className="offset-modal-description">Вы уверены? Вам засчитается поражение!</p>
            <div className="offset-modal-actions">
              <Button variant="primary" onClick={handleConfirmExit} style={{ flex: 1 }}>Да, сдаться</Button>
              <Button variant="secondary" onClick={() => setShowExitModal(false)} style={{ flex: 1 }}>Нет</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {(showOffsetModal && gameInfo?.type !== 'sandbox') && createPortal(
        <div 
          className="offset-modal-overlay modal-visible"
          onClick={() => setShowOffsetModal(false)}
          style={{
            position: 'fixed', top: '0px', left: '0px', right: '0px', bottom: '0px',
            width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh',
            background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2147483647, padding: '12px', margin: '0',
            border: 'none', outline: 'none', touchAction: 'none', overflow: 'hidden',
            overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            className="offset-modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              padding: '20px', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
              width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
            }}
          >
            <h2>Выбор смещения</h2>
            <p className="offset-modal-description">
              Выберите смещение для контроля честности игры. Каждый игрок выбирает свое смещение независимо (от 1 до 5).
            </p>
            
            <div className="offset-selector">
              <label>Ваше смещение (1-5):</label>
              <p className="offset-hint">
                Смещение влияет на выбор начальной позиции в последовательности бросков кубиков
              </p>
              <input 
                type="range" 
                min="1" 
                max="5" 
                value={myOffset} 
                onChange={(e) => setMyOffset(parseInt(e.target.value))}
              />
              <div className="offset-values">
                <span>Вы: <strong>{myOffset}</strong></span>
                {opponentOffset > 0 && (
                  <span>Соперник: <strong>{opponentOffset}</strong></span>
                )}
              </div>
            </div>

            {gameInfo?.rngHash && (
              <div className="hash-display">
                <div>Хеш последовательности (SHA-256):</div>
                <code>
                  {(() => {
                    try {
                      if (typeof gameInfo.rngHash === 'string') {
                        const parsed = JSON.parse(gameInfo.rngHash)
                        if (parsed && parsed.p1Hash) {
                          return parsed.p1Hash.substring(0, 16) + '...'
                        }
                      }
                      return gameInfo.rngHash.substring(0, 16) + '...'
                    } catch (e) {
                      return typeof gameInfo.rngHash === 'string' 
                        ? gameInfo.rngHash.substring(0, 16) + '...'
                        : '---'
                    }
                  })()}
                </code>
              </div>
            )}

            <div className="offset-modal-actions">
              <Button 
                variant="primary" 
                onClick={handleConfirmOffset} 
                style={{ flex: 1 }}
              >
                Подтвердить
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {gameStatus === 'finished' && createPortal(
        <div 
          className="game-overlay" 
          style={{
            position: 'fixed', top: '0px', left: '0px', right: '0px', bottom: '0px',
            width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh',
            background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2147483647, padding: '12px', margin: '0',
            border: 'none', outline: 'none', touchAction: 'none', overflow: 'hidden',
            overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            className="game-result" 
            style={{
              position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              padding: '24px', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
              width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
            }}
          >
            <h2>Игра завершена!</h2>
            <p>Победитель: {score.player1 > score.player2 ? (isPlayer1 ? 'Вы' : myPlayer?.username) : (isPlayer1 ? opponentPlayer?.username : 'Вы')}</p>
            
            <div className="fair-play-verification">
              <h4>Контроль честности</h4>
              <div className="verification-item">
                <span>Ваше смещение:</span>
                <strong>{myOffset}</strong>
              </div>
              <div className="verification-item">
                <span>Смещение соперника:</span>
                <strong>{opponentOffset}</strong>
              </div>
              {gameState?.verificationSalt && (
                <div className="verification-details">
                  <div className="salt-display">
                    Соль: <code>{gameState.verificationSalt}</code>
                  </div>
                  <button 
                    className="verify-btn"
                    onClick={() => {
                      if (!gameState?.p1Rolls || !gameState?.p2Rolls || !gameState?.verificationSalt || !gameInfo?.rngHash) {
                        alert('Недостаточно данных для проверки. Игра должна быть завершена.')
                        return
                      }
                      navigate(`/game/${gameId}/verification`)
                    }}
                  >
                    Проверить честность
                  </button>
                </div>
              )}
            </div>

            <button className="result-close-btn" onClick={() => navigate('/game/result/' + gameId)}>К результатам</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}