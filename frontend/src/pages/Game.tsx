import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [gameInfo, setGameInfo] = useState<any>(null)
  const [opponent, setOpponent] = useState<any>(null)
  const [score, setScore] = useState({ player1: 0, player2: 0 })
  const [gameStatus, setGameStatus] = useState<string>('waiting')
  const [player1Timer, setPlayer1Timer] = useState<number>(20)
  const [player2Timer, setPlayer2Timer] = useState<number>(20)
  const [moveTimer, setMoveTimer] = useState<number>(20) // Таймер на ход (20 секунд)
  const [totalTimeRemaining, setTotalTimeRemaining] = useState<{ player1: number; player2: number }>({ player1: 60, player2: 60 }) // Общее время каждого игрока (60 секунд)
  const [isInOvertime, setIsInOvertime] = useState<boolean>(false) // Овертайм (прошло больше 20 секунд)
  const lastTimerUpdateRef = useRef<number>(Date.now()) // Время последнего обновления таймера с сервера
  const player1TimerRef = useRef<number>(20)
  const player2TimerRef = useRef<number>(20)
  const totalTimeRemainingRef = useRef<{ player1: number; player2: number }>({ player1: 60, player2: 60 })
  const [pipCounts, setPipCounts] = useState({ player1: 0, player2: 0 })
  const [pipDiff, setPipDiff] = useState<{ player1: number | null; player2: number | null }>({ player1: null, player2: null })
  const lastPipCounts = useRef({ player1: 0, player2: 0 })
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)

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
  const lastDiceRollRef = useRef<string>('') // Отслеживание последнего обработанного события dice_rolled
  const [playerSkins, setPlayerSkins] = useState<{ player1: any; player2: any; mySkins: any }>({ player1: null, player2: null, mySkins: null })
  const [player1Ready, setPlayer1Ready] = useState<boolean>(false)
  const [player2Ready, setPlayer2Ready] = useState<boolean>(false)
  const [myReady, setMyReady] = useState<boolean>(false)
  const [myOffset, setMyOffset] = useState<number>(1)
  const [opponentOffset, setOpponentOffset] = useState<number>(1)
  const lastSentOffsetRef = useRef<number | null>(null) // Отслеживаем последний отправленный offset
  const [pendingMoves, setPendingMoves] = useState<Array<{ from: number; to: number; die: number; steps?: any[] }>>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const mode = searchParams.get('mode')
  const isBotGame = mode === 'bot'
  const createdBotGameRef = useRef(false)

  useEffect(() => {
    if (gameId) {
      loadGame()
      connectToGame()
      createdBotGameRef.current = false
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
      const socket = getSocket()
      if (socket) {
        socket.off('game_state')
        socket.off('move_made')
        socket.off('dice_rolled')
        socket.off('game_finished')
      }
      const matchmakingSocket = getMatchmakingSocket()
      if (matchmakingSocket) {
        matchmakingSocket.off('ready_status')
        matchmakingSocket.off('game_started')
        matchmakingSocket.off('opponent_joined')
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

  // Локальный таймер для плавного обновления UI
  useEffect(() => {
    if (gameStatus !== 'in_progress') {
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
        }
      }
    }, 100) // Обновляем каждые 100мс для плавности

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [gameStatus, gameState?.currentPlayer])

  // Функция автолуза
  const handleAutoMove = async () => {
    if (!gameId) return

    console.log('⏱️ Таймер истек! Оформляем техническое поражение...')
    try {
      await apiClient.post(`/games/${gameId}/resign`)
      setGameStatus('finished')
    } catch (error) {
      console.error('❌ Ошибка при автоматической сдаче:', error)
    }
  }
  
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
      setScore({ player1: game.player1Score || 0, player2: game.player2Score || 0 })
      setGameStatus(game.status)
      
      // Загружаем смещения игроков
      const isP1 = game.player1Id === user?.id
      if (isP1) {
        setMyOffset(game.p1Offset || 1)
        setOpponentOffset(game.p2Offset || 1)
      } else {
        setMyOffset(game.p2Offset || 1)
        setOpponentOffset(game.p1Offset || 1)
      }
      
      if (game.status === 'in_progress') {
        const timeLimitSeconds = game.moveTimeLimit ? Math.floor(game.moveTimeLimit / 1000) : 60
        setPlayer1Timer(timeLimitSeconds)
        setPlayer2Timer(timeLimitSeconds)
        
        // Если игра началась и это наш ход, но кубиков нет - бросаем их
        const canMoveNow = game.player1Id === user?.id ? game.currentPlayer === 0 : game.currentPlayer === 1
        if (canMoveNow && !formattedDice && !isBotGame) {
          setTimeout(() => {
            const socket = getSocket()
            if (socket) {
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
      const response = await apiClient.post('/games/create-bot', { mode: gameMode })
      navigate(`/game/${response.data.id}`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка'
      alert(`Не удалось создать игру с ботом: ${errorMessage}`)
    }
  }

  const connectToGame = () => {
    const socket = getSocket()
    if (!socket || !gameId) {
      const { token } = useAuthStore.getState()
      if (token) {
        connectWebSocket(token)
        setTimeout(() => {
          const newSocket = getSocket()
          if (newSocket && gameId) {
            newSocket.emit('join_game', { gameId })
          }
        }, 1000)
      }
      return
    }

    // ВАЖНО: Отключаем все предыдущие обработчики перед добавлением новых
    // Это предотвращает множественные подписки на одно событие
    socket.off('game_state')
    socket.off('move_made')
    socket.off('dice_rolled')
    socket.off('game_finished')
    socket.off('offset_updated')
    socket.off('timer_update')

    // ВАЖНО: Отключаем все предыдущие обработчики перед добавлением новых
    // Это предотвращает множественные подписки на одно событие
    socket.off('game_state')
    socket.off('move_made')
    socket.off('dice_rolled')
    socket.off('game_finished')
    socket.off('offset_updated')
    socket.off('timer_update')

    socket.emit('join_game', { gameId })

    socket.on('game_state', (data: any) => {
      const diceData = data.gameState?.dice
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
        ? { die1: diceData[0], die2: diceData[1] } 
        : (Array.isArray(diceData) && diceData.length === 0) || !diceData
        ? null
        : diceData
      
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
      
      setGameState({
        points,
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
        verificationSalt: data.verificationSalt,
        p1Rolls: data.p1Rolls,
        p2Rolls: data.p2Rolls,
      })
      const newStatus = data.status || 'waiting'
      setGameStatus(newStatus)
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      
      // Обновляем таймеры из данных сервера, если они есть
      if (data.player1Timer !== undefined) {
        setPlayer1Timer(data.player1Timer)
      }
      if (data.player2Timer !== undefined) {
        setPlayer2Timer(data.player2Timer)
      }
      
      if (isMyTurnNow && !wasMyTurn) {
        setMoveTimer(20)
      }

      // Если это начало нашего хода и кубиков нет - бросаем их автоматически
      if (newStatus === 'in_progress' && isMyTurnNow && !wasMyTurn && !formattedDice) {
        setTimeout(() => {
          const socket = getSocket()
          if (socket) {
            socket.emit('roll_dice', { gameId })
          }
        }, 500)
      }
    })

    socket.on('move_made', (data: any) => {
      const diceData = data.gameState?.dice
      const canMove = data.currentPlayer === (data.player1Id === user?.id ? 0 : 1)
      
      // ВАЖНО: Всегда очищаем pendingMoves при получении move_made,
      // т.к. ходы уже применены на сервере и приходят в обновленном gameState
      // Если остались кубики и это еще мой ход, можно продолжить ходить, но с новыми pendingMoves
      setPendingMoves([])
      
      // Для дублей может быть массив из 4 элементов, для обычных - из 2
      // Сохраняем весь массив, если он есть
      const formattedDice = Array.isArray(diceData) && diceData.length > 0
        ? diceData.length === 2
          ? { die1: diceData[0], die2: diceData[1] }
          : diceData // Для дублей (4 элемента) или других случаев сохраняем массив
        : null
      
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
      
      setGameState({
        points,
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
        verificationSalt: data.verificationSalt,
        p1Rolls: data.p1Rolls,
        p2Rolls: data.p2Rolls,
      })
      setGameStatus(data.status || 'in_progress')
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      
      // Сбрасываем таймер при смене хода
      if (!isMyTurnNow && wasMyTurn) {
        setMoveTimer(20)
        setIsInOvertime(false)
      }
      
      // Если это начало нашего хода - запускаем таймер и бросаем кубики если их нет
      if (isMyTurnNow && !wasMyTurn) {
        setMoveTimer(20)
        
        if (!formattedDice && data.status === 'in_progress') {
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

    // Обработчик dice_rolled - используем именованную функцию для возможности удаления
    // Используем Set для хранения обработанных eventId
    const processedEventsRef = useRef<Set<string>>(new Set());
    
    const handleDiceRolled = (data: any) => {
      if (!data.dice) {
        console.log('⚠️ dice_rolled event without dice data, skipping');
        return;
      }
      
      // Используем eventId для дедупликации, если он есть, иначе используем diceKey + timestamp
      const eventId = data.eventId || `${JSON.stringify(data.dice)}_${Date.now()}`;
      const diceKey = JSON.stringify(data.dice);
      
      console.log('🎲 dice_rolled received:', data, 'eventId:', eventId.substring(0, 80));
      
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
      
      // Запускаем анимацию
      setDiceAnimating(true);
      
      // Запускаем таймаут для остановки анимации через 4 секунды
      (window as any).diceAnimationTimeout = setTimeout(() => {
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
        }, 500);
      }, 4000);
    };
    
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
        const moveTimeRemaining = data.moveTimeRemaining !== undefined ? data.moveTimeRemaining : 20
        const totalTime1 = data.player1TimeRemaining !== undefined ? data.player1TimeRemaining : 60
        const totalTime2 = data.player2TimeRemaining !== undefined ? data.player2TimeRemaining : 60
        const isOvertime = data.isOvertime || false
        
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
          setPlayer2Timer(20) // Соперник имеет полное время на ход
          player2TimerRef.current = 20
        } else {
          // Ход игрока 2
          setPlayer2Timer(moveTimeRemaining)
          player2TimerRef.current = moveTimeRemaining
          setPlayer1Timer(20) // Соперник имеет полное время на ход
          player1TimerRef.current = 20
        }
      }
    })

    socket.on('game_finished', (data: any) => {
      setGameStatus('finished')
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
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
            loadGame().then(() => {
              // Небольшая задержка для обновления состояния
              setTimeout(() => {
                const socket = getSocket()
                if (socket && data.game.currentPlayer === (data.game.player1Id === user?.id ? 0 : 1)) {
                  // Если это наш ход, бросаем кубики
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

    const diceArray = gameState.dice 
      ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2])
      : []
    
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
      // Проверяем доступность всех кубиков в комбинации
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
          alert(`Кубик ${step.die} из комбинации уже использован`);
          return;
        }
      }
      setPendingMoves(prev => [...prev, { from, to, die, steps }])
      return
    }

    // Для обычного хода (die <= 6 и нет steps)
    if (die <= 6 && (!steps || steps.length === 0)) {
      // Для дублей не проверяем максимальное использование кубика
      if (!isDoubles) {
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
          alert(`Кубик ${die} уже использован максимальное количество раз`)
          return
        }
      }
    } else if (die > 6) {
      // Для хода > 6 (комбинированный) должен быть steps
      if (!steps || steps.length === 0) {
        console.warn(`Move with die=${die} but no steps provided`);
        return; // Не добавляем такой ход
      }
      // Проверка комбинированных ходов уже выполнена выше (строки 806-826)
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
    const diceArray = Array.isArray(gameState.dice) 
      ? gameState.dice 
      : [gameState.dice.die1, gameState.dice.die2]
    
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
    if (isNaN(val) || val < 1 || val > 100) return
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

  const handleConfirm = async () => {
    if (!gameId) return

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
      try {
        setMoveTimer(30)
        
        const onMoveError = (err: any) => {
          console.error('Move rejected:', err)
          // Просто откатываем ходы без показа ошибки
          setPendingMoves([])
          socket.off('error', onMoveError)
        }
        socket.on('error', onMoveError)
        setTimeout(() => socket.off('error', onMoveError), 3000)
        
        socket.emit('make_move', { gameId, moves: pendingMoves })
        // Не очищаем pendingMoves здесь - дождемся события move_made, которое обновит gameState
        // pendingMoves будут очищены в обработчике move_made, чтобы избежать двойного применения в virtualGameState
      } catch (error) {
        // Просто откатываем ходы без показа ошибки
        setPendingMoves([])
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

  const isPlayer1 = gameInfo.player1Id === user?.id
  const isSandbox = gameInfo?.type === 'sandbox'
  const isMyTurn = (gameState?.canMove || isSandbox) && gameStatus === 'in_progress'
  const myPlayer = isPlayer1 ? gameInfo.player1 : gameInfo.player2
  const opponentPlayer = isPlayer1 ? gameInfo.player2 : gameInfo.player1

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
                {!isPlayer1 && gameState?.currentPlayer === 1 && gameStatus === 'in_progress' && (() => {
                  // Время на ход ВСЕГДА 20 секунд
                  // Если player2Timer > 0, значит еще не начался овертайм (зеленая)
                  // Если player2Timer <= 0, значит овертайм - показываем общее время (желтая)
                  const isOvertime = player2Timer <= 0 || isInOvertime
                  const progress = isOvertime 
                    ? Math.max(0, Math.min(1, totalTimeRemaining.player2 / 60))
                    : Math.max(0, Math.min(1, player2Timer / 20))
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
              <div className="game-score-label">до 3</div>
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
              <div className={`game-player ${!isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">{opponentPlayer?.nickname || opponentPlayer?.username || 'Соперник'}</div>
                <div className="game-player-avatar">
                  {opponentPlayer?.avatarUrl ? <img src={opponentPlayer.avatarUrl} alt={opponentPlayer.username} /> : <Icon name="user" size={48} />}
                  {!isPlayer1 && gameState?.currentPlayer === 1 && gameStatus === 'in_progress' && (() => {
                    const isOvertime = player2Timer <= 0 || isInOvertime
                    const progress = isOvertime 
                      ? Math.max(0, Math.min(1, totalTimeRemaining.player2 / 60))
                      : Math.max(0, Math.min(1, player2Timer / 20))
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
              <div className="game-score-section">
                <div className="game-score-label">до 3</div>
                <div className="game-score">{score.player1}:{score.player2}</div>
              </div>
              <div className={`game-player ${isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">{myPlayer?.nickname || myPlayer?.username || 'Вы'}</div>
                <div className="game-player-avatar">
                  {myPlayer?.avatarUrl ? <img src={myPlayer.avatarUrl} alt={myPlayer.username} /> : <Icon name="user" size={48} />}
                  {isPlayer1 && gameState?.currentPlayer === 0 && gameStatus === 'in_progress' && (() => {
                    // Время на ход ВСЕГДА 20 секунд
                    // Если player1Timer > 0, значит еще не начался овертайм (зеленая)
                    // Если player1Timer <= 0, значит овертайм - показываем общее время (желтая)
                    const isOvertime = player1Timer <= 0 || isInOvertime
                    const progress = isOvertime 
                      ? Math.max(0, Math.min(1, totalTimeRemaining.player1 / 60))
                      : Math.max(0, Math.min(1, player1Timer / 20))
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
                    <code>{gameInfo.rngHash ? (JSON.parse(gameInfo.rngHash).p1Hash.substring(0, 16) + '...') : '---'}</code>
                  </div>
                  
                  <div className="offset-selector">
                    <label>Ваше смещение (1-100):</label>
                    <p className="offset-hint">Каждый игрок выбирает свое смещение независимо</p>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
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

          {/* Доска */}
          {(gameStatus === 'in_progress' || gameStatus === 'finished') && (
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
                gameState={gameState}
                currentPlayer={gameState.currentPlayer}
                dice={gameState.dice ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2]) : null}
                onMove={handleMove}
                onRollDice={handleRollDice}
                canMove={gameState.canMove}
                isMyTurn={isMyTurn}
                gameId={gameId}
                gameMode={gameInfo?.mode || 'long'}
                pendingMoves={pendingMoves}
                diceAnimating={diceAnimating}
                myPlayerId={user?.id}
                player1Id={gameInfo?.player1Id}
                player2Id={gameInfo?.player2Id}
                player1Name={gameInfo?.player1?.nickname || gameInfo?.player1?.username}
                player2Name={gameInfo?.player2?.nickname || gameInfo?.player2?.username || 'Бот'}
              />
              {isSandbox && (
                <SandboxControls
                  gameId={gameId || ''}
                  gameState={gameState}
                  currentPlayer={gameState?.currentPlayer || 0}
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
                />
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
                {isPlayer1 && gameState?.currentPlayer === 0 && gameStatus === 'in_progress' && (() => {
                  // Время на ход ВСЕГДА 20 секунд
                  // Если player1Timer > 0, значит еще не начался овертайм (зеленая)
                  // Если player1Timer <= 0, значит овертайм - показываем общее время (желтая)
                  const isOvertime = player1Timer <= 0 || isInOvertime
                  const progress = isOvertime 
                    ? Math.max(0, Math.min(1, totalTimeRemaining.player1 / 60))
                    : Math.max(0, Math.min(1, player1Timer / 20))
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


      {showExitModal && (
        <div className="modal-overlay" onClick={() => setShowExitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Выход из игры</h2>
            <p>Вы уверены? Вам засчитается поражение!</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <Button variant="primary" onClick={handleConfirmExit} style={{ flex: 1 }}>Да, сдаться</Button>
              <Button variant="secondary" onClick={() => setShowExitModal(false)} style={{ flex: 1 }}>Нет</Button>
            </div>
          </div>
        </div>
      )}

      {gameStatus === 'finished' && (
        <div className="game-overlay">
          <div className="game-result">
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
              <div className="verification-item">
                <span>Итоговый индекс:</span>
                <strong>{((myOffset - 1) * 2 + opponentOffset)}</strong>
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
        </div>
      )}
    </div>
  )
}