import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import BackgammonBoard from '../components/BackgammonBoard'
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
  dice: { die1: number; die2: number } | null
  canMove: boolean
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
  const [player1Timer, setPlayer1Timer] = useState<number>(30)
  const [player2Timer, setPlayer2Timer] = useState<number>(30)
  const [moveTimer, setMoveTimer] = useState<number>(30) // Таймер на ход (30 секунд)
  const [overtimeTimer, setOvertimeTimer] = useState<number>(60) // Овертайм (1 минута)
  const [isInOvertime, setIsInOvertime] = useState<boolean>(false) // Флаг овертайма
  const [showExitModal, setShowExitModal] = useState<boolean>(false) // Модальное окно выхода
  const [diceAnimating, setDiceAnimating] = useState<boolean>(false)
  const [playerSkins, setPlayerSkins] = useState<{ player1: any; player2: any; mySkins: any }>({ player1: null, player2: null, mySkins: null })
  const [player1Ready, setPlayer1Ready] = useState<boolean>(false)
  const [player2Ready, setPlayer2Ready] = useState<boolean>(false)
  const [myReady, setMyReady] = useState<boolean>(false)
  const [pendingMoves, setPendingMoves] = useState<Array<{ from: number; to: number; die: number }>>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overtimeRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current)
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

  // Таймер на ход: 30 секунд, затем 1 минута овертайм
  useEffect(() => {
    // Очищаем предыдущие таймеры
    if (moveTimerRef.current) {
      clearInterval(moveTimerRef.current)
      moveTimerRef.current = null
    }
    if (overtimeRef.current) {
      clearInterval(overtimeRef.current)
      overtimeRef.current = null
    }

    // Если это мой ход и игра идет, запускаем таймер
    if (gameState?.canMove && gameStatus === 'in_progress' && gameState?.dice && !isBotGame) {
      // Если мы только что начали ход (таймер был сброшен в 30 в else или вручную), 
      // или если мы перешли в состояние canMove
      
      moveTimerRef.current = setInterval(() => {
        setMoveTimer((prev) => {
          if (prev <= 1) {
            // Основной таймер закончился - переходим в овертайм
            setIsInOvertime(true)
            if (!overtimeRef.current) {
              overtimeRef.current = setInterval(() => {
                setOvertimeTimer((prevOvertime) => {
                  if (prevOvertime <= 1) {
                    // Овертайм закончился - техническое поражение
                    handleAutoMove()
                    if (overtimeRef.current) {
                      clearInterval(overtimeRef.current)
                      overtimeRef.current = null
                    }
                    return 0
                  }
                  return prevOvertime - 1
                })
              }, 1000)
            }
            if (moveTimerRef.current) {
              clearInterval(moveTimerRef.current)
              moveTimerRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // Не мой ход или игра не идет - сбрасываем таймеры
      setIsInOvertime(false)
      setMoveTimer(30)
      setOvertimeTimer(60)
    }

    return () => {
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current)
        moveTimerRef.current = null
      }
      if (overtimeRef.current) {
        clearInterval(overtimeRef.current)
        overtimeRef.current = null
      }
    }
  }, [gameState?.canMove, gameStatus, !!gameState?.dice, isBotGame])

  // Функция автолуза
  const handleAutoMove = async () => {
    if (!gameId) return

    console.log('⏱️ Таймер истек! Оформляем техническое поражение...')
    try {
      await apiClient.post(`/games/${gameId}/resign`)
      setGameStatus('finished')
      // После resignGame сервер пришлет событие game_finished через сокет
    } catch (error) {
      console.error('❌ Ошибка при автоматической сдаче:', error)
    }
  }
  
  // playerSkins обновлены

  const loadGame = async () => {
    try {
      const response = await apiClient.get(`/games/${gameId}`)
      const game = response.data
      setGameInfo(game)
      const diceData = game.gameState?.dice
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2
        ? { die1: diceData[0], die2: diceData[1] }
        : diceData || null
      
      // Преобразуем bar и bearOff из массива в объект если нужно
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
      })
      setOpponent(game.player1Id === user?.id ? game.player2 : game.player1)
      setScore({ player1: game.player1Score || 0, player2: game.player2Score || 0 })
      setGameStatus(game.status)
      
      // Инициализируем таймер при загрузке игры
      if (game.status === 'in_progress') {
        // Используем moveTimeLimit из игры (в миллисекундах, конвертируем в секунды)
        const timeLimitSeconds = game.moveTimeLimit ? Math.floor(game.moveTimeLimit / 1000) : 60
        // Точное значение придет через WebSocket событие timer_update
        setPlayer1Timer(timeLimitSeconds)
        setPlayer2Timer(timeLimitSeconds)
      } else {
        // Если игра не началась, таймеры на 0
        setPlayer1Timer(0)
        setPlayer2Timer(0)
      }
      
      // Для игр с игроками в статусе waiting, сбрасываем готовность
      if (game.status === 'waiting' && game.type === 'vs_player' && !isBotGame) {
        setPlayer1Ready(false)
        setPlayer2Ready(false)
        setMyReady(false)
      }
      
      // Загружаем скины игроков
      await loadPlayerSkins(game.player1Id, game.player2Id)
    } catch (error) {
      // Игнорируем ошибки загрузки
    }
  }

  const loadPlayerSkins = async (player1Id: string, player2Id: string) => {
    try {
      const currentUser = useAuthStore.getState().user
      const myId = currentUser?.id
      
      // Загружаем дефолтные классические скины ТОЛЬКО для бота
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
      
      // Определяем, является ли player2 ботом (нет player2Id или это бот-игра)
      const isBotPlayer2 = !player2Id || isBotGame || gameInfo?.type === 'vs_bot'
      
      // Загружаем скины: используем /skins/selected/explicit для явно выбранных скинов
      // Если явно выбранных нет - используем дефолтные через /skins/selected (с fallback)
      // Для бота - всегда дефолтные классические скины
      const loadPlayerSkinsWithFallback = async (userId: string, isMyId: boolean) => {
        try {
          // Сначала пытаемся загрузить явно выбранные скины
          const explicitRes = await apiClient.get('/skins/selected/explicit').catch(() => ({ data: {} }))
          const explicitSkins = explicitRes.data || {}
          
          // Если есть явно выбранные скины - используем их
          if (explicitSkins.board || explicitSkins.dice || explicitSkins.checkers) {
            console.log(`✅ Found explicitly selected skins for user ${userId}:`, explicitSkins)
            return explicitSkins
          }
          
          // Если явно выбранных нет - используем /skins/selected (с fallback на дефолтные)
          const selectedRes = await apiClient.get(isMyId ? '/skins/selected' : `/skins/user/${userId}/selected`).catch(() => ({ data: {} }))
          const selectedSkins = selectedRes.data || {}
          console.log(`⚠️ No explicit selection for user ${userId}, using selected with fallback:`, selectedSkins)
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
        // Мои скины - загружаем с fallback
        myId ? loadPlayerSkinsWithFallback(myId, true) : Promise.resolve({}),
      ]
      
      const [player1Skins, player2Skins, mySkins] = await Promise.all(promises)
      
      console.log('🎮 Game - Loaded player skins (NO FALLBACK):', {
        player1Id,
        player2Id,
        myId,
        isBotGame,
        isBotPlayer2,
        isPlayer1: myId === player1Id,
        player1Skins,
        player2Skins,
        mySkins,
        player1Board: player1Skins.board,
        player1BoardId: player1Skins.board?.id,
        player1BoardName: player1Skins.board?.name,
        player1BoardTexture: player1Skins.board?.boardTextureUrl,
        player2Board: player2Skins.board,
        player2BoardId: player2Skins.board?.id,
        player2BoardName: player2Skins.board?.name,
        player2BoardTexture: player2Skins.board?.boardTextureUrl,
        myBoard: mySkins.board,
        myBoardId: mySkins.board?.id,
        myBoardName: mySkins.board?.name,
        myBoardTexture: mySkins.board?.boardTextureUrl,
      })
      
      // Устанавливаем скины каждого игрока отдельно
      setPlayerSkins({
        player1: player1Skins,
        player2: player2Skins,
        mySkins: mySkins, // Мои скины для использования в доске
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

  const createBotGame = async () => {
    try {
      console.log('🎮 Создание игры с ботом...')
      const { token, user } = useAuthStore.getState()
      console.log('🔑 Токен:', token ? `${token.substring(0, 20)}...` : 'отсутствует')
      console.log('👤 Пользователь:', user ? { id: user.id, username: user.username, isGuest: user.isGuest } : 'отсутствует')
      
      const response = await apiClient.post('/games/create-bot')
      console.log('✅ Игра с ботом создана:', response.data)
      navigate(`/game/${response.data.id}`)
    } catch (error: any) {
      console.error('❌ Ошибка при создании игры с ботом:', error)
      console.error('❌ Статус ответа:', error.response?.status)
      console.error('❌ Данные ответа:', error.response?.data)
      console.error('❌ Заголовки запроса:', error.config?.headers)
      
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка'
      alert(`Не удалось создать игру с ботом: ${errorMessage}`)
    }
  }

  const connectToGame = () => {
    const socket = getSocket()
    if (!socket || !gameId) {
      console.error('❌ WebSocket не подключен или нет gameId', { socket: !!socket, gameId })
      // Попробуем переподключиться
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

    console.log('🔌 Подключаемся к игре через WebSocket:', gameId, 'Socket connected:', socket.connected)

    // Подключаемся к игре через WebSocket (правильное имя события)
    socket.emit('join_game', { gameId })

    socket.on('game_state', (data: any) => {
      console.log('📊 Получено game_state:', data)
      console.log('📊 Детали game_state:', {
        currentPlayer: data.currentPlayer,
        player1Id: data.player1Id,
        myId: user?.id,
        dice: data.gameState?.dice,
        status: data.status
      })
      const diceData = data.gameState?.dice
      // Если dice пустой массив или null/undefined, formattedDice должен быть null
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
        ? { die1: diceData[0], die2: diceData[1] } 
        : (Array.isArray(diceData) && diceData.length === 0) || !diceData
        ? null
        : diceData
      
      const canMove = data.currentPlayer === (data.player1Id === user?.id ? 0 : 1)
      const isMyTurnNow = canMove
      const wasMyTurn = gameState?.canMove || false
      
      console.log('📊 Вычислено canMove:', canMove, 'currentPlayer:', data.currentPlayer, 'player1Id === myId:', data.player1Id === user?.id)
      
      // Преобразуем bar и bearOff из массива в объект если нужно
      const barRaw = data.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      setGameState({
        points: data.gameState?.points || [],
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
      })
      const newStatus = data.status || 'waiting'
      setGameStatus(newStatus)
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      
      // Сбрасываем таймер при смене хода
      if (isMyTurnNow && !wasMyTurn) {
        setMoveTimer(30)
      }

      // Автоматически бросаем кубики когда начинается ход игрока и нет кубиков
      if (newStatus === 'in_progress' && isMyTurnNow && !wasMyTurn && !formattedDice && !isBotGame) {
        console.log('🎲 Автоматически бросаем кубики - начался мой ход')
        setTimeout(() => {
          const socket = getSocket()
          if (socket) {
            socket.emit('roll_dice', { gameId })
          }
        }, 500)
      }
      
      // Если статус изменился на in_progress, обновляем игру
      if (newStatus === 'in_progress') {
        console.log('✅ Статус игры изменился на in_progress, обновляем игру')
        loadGame()
      }
    })

      socket.on('move_made', (data: any) => {
      console.log('🎯 Получено move_made:', data)
      console.log('🎯 Детали move_made:', {
        currentPlayer: data.currentPlayer,
        player1Id: data.player1Id,
        myId: user?.id,
        dice: data.gameState?.dice,
        status: data.status
      })
      
      // Очищаем очередь ходов после успешного хода
      setPendingMoves([])
      
      // Сбрасываем выбранную точку на доске
      // Это делается через обновление компонента BackgammonBoard
      
      const diceData = data.gameState?.dice
      // Если dice пустой массив или null/undefined, formattedDice должен быть null
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
        ? { die1: diceData[0], die2: diceData[1] } 
        : (Array.isArray(diceData) && diceData.length === 0) || !diceData
        ? null
        : diceData
      
      const canMove = data.currentPlayer === (data.player1Id === user?.id ? 0 : 1)
      const isMyTurnNow = canMove
      const wasMyTurn = gameState?.canMove || false
      
      // Сбрасываем таймер при смене хода
      // Используем moveTimeLimit из gameInfo, если доступен, иначе 60 секунд
      const timeLimitSeconds = gameInfo?.moveTimeLimit ? Math.floor(gameInfo.moveTimeLimit / 1000) : 60
      if (data.currentPlayer === 0) {
        setPlayer1Timer(timeLimitSeconds)
        setPlayer2Timer(timeLimitSeconds)
      } else {
        setPlayer2Timer(timeLimitSeconds)
        setPlayer1Timer(timeLimitSeconds)
      }
      
      console.log('🎯 Вычислено canMove:', canMove, 'currentPlayer:', data.currentPlayer, 'player1Id === myId:', data.player1Id === user?.id)
      
      // Преобразуем bar и bearOff из массива в объект если нужно
      const barRaw = data.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      setGameState({
        points: data.gameState?.points || [],
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
      })
      setGameStatus(data.status || 'in_progress')
      console.log('🔄 Обновляем состояние игры после хода')
      
      // Сбрасываем таймер при смене хода
      if (isMyTurnNow && !wasMyTurn) {
        setMoveTimer(30)
      }

      // Автоматически бросаем кубики когда начинается ход игрока и нет кубиков
      if (data.status === 'in_progress' && isMyTurnNow && !wasMyTurn && !formattedDice && !isBotGame) {
        console.log('🎲 Автоматически бросаем кубики - начался мой ход после хода соперника')
        setTimeout(() => {
          const socket = getSocket()
          if (socket) {
            socket.emit('roll_dice', { gameId })
          }
        }, 500)
      }
    })

    socket.on('dice_rolled', (data: any) => {
      console.log('🎲 Получено dice_rolled:', data)
      // Запускаем анимацию кубиков
      setDiceAnimating(true)
      setTimeout(() => {
        setDiceAnimating(false)
        // Обновляем кубики после анимации
        if (data.dice && Array.isArray(data.dice) && data.dice.length >= 2) {
          const formattedDice = { die1: data.dice[0], die2: data.dice[1] }
          setGameState(prev => ({
            ...prev,
            dice: formattedDice
          }))
        }
        // Перезагружаем игру чтобы получить актуальное состояние
        loadGame()
      }, 1000) // Анимация длится 1 секунду
    })

    // Слушаем обновления таймера с бэкенда
    socket.on('timer_update', (data: any) => {
      if (data.gameId === gameId) {
        // Используем timeRemaining (оставшееся время) вместо timeElapsed
        const timeRemaining = data.timeRemaining !== undefined ? data.timeRemaining : Math.max(0, 60 - (data.timeElapsed || 0))
        
        // Используем moveTimeLimit из gameInfo, если доступен, иначе 60 секунд
        const timeLimitSeconds = gameInfo?.moveTimeLimit ? Math.floor(gameInfo.moveTimeLimit / 1000) : 60
        
        if (data.currentPlayer === 0) {
          setPlayer1Timer(timeRemaining)
          // Сбрасываем таймер второго игрока, когда ход переходит к первому
          setPlayer2Timer(timeLimitSeconds)
        } else {
          setPlayer2Timer(timeRemaining)
          // Сбрасываем таймер первого игрока, когда ход переходит ко второму
          setPlayer1Timer(timeLimitSeconds)
        }
      }
    })

    socket.on('game_finished', (data: any) => {
      console.log('🏁 Игра завершена:', data)
      setGameStatus('finished')
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
    })

    socket.on('error', (error: any) => {
      console.error('❌ WebSocket error:', error)
    })

    // Подключаемся к matchmaking socket для событий готовности и присоединения
    const matchmakingSocket = getMatchmakingSocket()
    if (matchmakingSocket && gameId && !isBotGame) {
      // Слушаем статус готовности игроков
      matchmakingSocket.on('ready_status', (data: any) => {
        console.log('✅ Получено ready_status:', data)
        if (data.gameId === gameId) {
          setPlayer1Ready(data.player1Ready || false)
          setPlayer2Ready(data.player2Ready || false)
          // Определяем, готов ли текущий игрок
          const isPlayer1 = gameInfo?.player1Id === user?.id
          setMyReady(isPlayer1 ? (data.player1Ready || false) : (data.player2Ready || false))
        }
      })

      // Слушаем начало игры
      matchmakingSocket.on('game_started', (data: any) => {
        console.log('🎮 Игра началась:', data)
        if (data.gameId === gameId) {
          setGameStatus('in_progress')
          setPlayer1Ready(true)
          setPlayer2Ready(true)
          setMyReady(true)
          // Обновляем информацию об игре
          if (data.game) {
            setGameInfo(data.game)
          }
          loadGame()
        }
      })

      // Слушаем присоединение соперника (в реальном времени)
      matchmakingSocket.on('opponent_joined', (data: any) => {
        console.log('👤 Соперник присоединился:', data)
        if (data.gameId === gameId) {
          // Обновляем информацию об игре в реальном времени
          if (data.game) {
            setGameInfo(data.game)
            setOpponent(data.game.player1Id === user?.id ? data.game.player2 : data.game.player1)
            setGameStatus(data.game.status || 'waiting')
            // Сбрасываем готовность при присоединении нового игрока
            setPlayer1Ready(false)
            setPlayer2Ready(false)
            setMyReady(false)
            // Перезагружаем скины при присоединении соперника
            if (data.game.player1Id && data.game.player2Id) {
              console.log('🔄 Opponent joined, reloading skins...')
              loadPlayerSkins(data.game.player1Id, data.game.player2Id)
            }
          }
          loadGame()
        }
      })

      // Слушаем таймауты игроков
      matchmakingSocket.on('player_timeout', (data: any) => {
        console.log('⏱️ Игрок не подтвердил готовность:', data)
        if (data.gameId === gameId) {
          if (data.timeoutPlayerId !== user?.id) {
            // Это не наш таймаут, значит выкинули соперника
            alert('Соперник не подтвердил готовность в течение минуты и был исключен. Ожидание нового соперника...')
            // Сбрасываем состояние готовности
            setPlayer1Ready(false)
            setPlayer2Ready(false)
            setMyReady(false)
            loadGame()
          }
        }
      })
    }
  }

  const handleMove = async (from: number, to: number, die: number) => {
    if (!gameId || !gameState?.canMove) {
      console.error('❌ Не могу сделать ход:', { gameId, canMove: gameState?.canMove })
      return
    }

    // Проверяем что кубик еще доступен
    const diceArray = gameState.dice 
      ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2])
      : []
    
    // Подсчитываем сколько раз уже использован этот кубик
    const usedCount = pendingMoves.filter(m => m.die === die).length
    const availableCount = diceArray.filter(d => d === die).length
    
    if (usedCount >= availableCount) {
      console.warn(`⚠️ Кубик ${die} уже использован максимальное количество раз (${availableCount})`)
      alert(`Кубик ${die} уже использован максимальное количество раз`)
      return
    }

    // Добавляем ход в очередь ожидающих ходов
    setPendingMoves(prev => {
      const newMoves = [...prev, { from, to, die }]
      console.log('📝 Ход добавлен в очередь:', { from, to, die }, 'Всего ходов:', newMoves.length)
      return newMoves
    })
  }

  const handleUndo = () => {
    if (pendingMoves.length > 0) {
      setPendingMoves(prev => {
        const newMoves = prev.slice(0, -1)
        console.log('🔄 Ход отменен. Осталось в очереди:', newMoves.length)
        return newMoves
      })
    }
  }

  const handleRollDice = async () => {
    if (!gameId) return

    const socket = getSocket()
    if (!socket) return

    try {
      socket.emit('roll_dice', { gameId })
    } catch (error) {
      console.error('Failed to roll dice:', error)
    }
  }

  const handleReadyToStart = async () => {
    if (!gameId) return
    
    const matchmakingSocket = getMatchmakingSocket()
    if (!matchmakingSocket) {
      alert('WebSocket не подключен. Перезагрузите страницу.')
      return
    }

    try {
      matchmakingSocket.emit('ready_to_start', { gameId })
      setMyReady(true)
    } catch (error) {
      console.error('Ошибка при отправке готовности:', error)
    }
  }

  const handleConfirm = async () => {
    console.log('🔘 handleConfirm вызван', { gameId, gameStatus, isMyTurn, pendingMoves: pendingMoves.length })
    
    if (!gameId) {
      console.error('❌ Нет gameId')
      alert('Ошибка: нет ID игры')
      return
    }

    // Если игра в статусе waiting и это игра с игроком - обрабатываем готовность отдельно
    if (gameStatus === 'waiting' && !isBotGame && gameInfo?.type === 'vs_player') {
      // Не обрабатываем здесь - обрабатывается через handleReadyToStart
      return
    }

    // Игры с ИИ теперь сразу создаются со статусом in_progress, этап waiting пропускается
    if (gameStatus === 'waiting' && isBotGame) {
      console.log('🎲 Начинаем игру - бросаем кубики')
      try {
        let socket = getSocket()
        
        if (!socket || !socket.connected) {
          console.warn('⚠️ WebSocket не подключен, пытаемся переподключиться...')
          const { token } = useAuthStore.getState()
          if (token) {
            connectWebSocket(token)
            await new Promise(resolve => setTimeout(resolve, 500))
            socket = getSocket()
          }
          
          if (!socket || !socket.connected) {
            console.error('❌ WebSocket не удалось подключить')
            alert('Ошибка подключения. Попробуйте обновить страницу.')
            return
          }
        }
        
        console.log('✅ WebSocket подключен, отправляем roll_dice для gameId:', gameId)
        socket.emit('roll_dice', { gameId })
        
        setTimeout(() => {
          console.log('🔄 Обновляем состояние игры после броска кубиков')
          loadGame()
        }, 2000)
      } catch (error) {
        console.error('❌ Failed to start game:', error)
        alert('Ошибка начала игры: ' + (error as Error).message)
      }
      return
    }

    // Если игра в процессе и это мой ход - отправляем накопленные ходы
    if (gameStatus === 'in_progress' && isMyTurn && pendingMoves.length > 0) {
      const socket = getSocket()
      if (!socket) {
        console.error('❌ WebSocket не подключен')
        alert('Ошибка подключения. Перезагрузите страницу.')
        return
      }

      try {
        // Сбрасываем таймер при отправке ходов
        setMoveTimer(30)
        
        console.log('📤 Отправляем ходы на сервер:', { gameId, moves: pendingMoves })
        socket.emit('make_move', {
          gameId,
          moves: pendingMoves,
        })
        console.log('✅ Ходы отправлены на сервер')
        
        // Очищаем очередь ходов
        setPendingMoves([])
      } catch (error) {
        console.error('❌ Ошибка отправки ходов:', error)
        alert('Ошибка отправки ходов: ' + (error as Error).message)
      }
      return
    }
    
    // Если нет ходов для отправки
    if (pendingMoves.length === 0 && gameStatus === 'in_progress' && isMyTurn) {
      console.log('ℹ️ Нет ходов для подтверждения')
    }
  }

  // Таймер теперь управляется бэкендом через WebSocket событие timer_update
  // Локальный таймер больше не нужен

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

  const isMyTurn = gameState.canMove
  const isPlayer1 = gameInfo.player1Id === user?.id
  const myPlayer = isPlayer1 ? gameInfo.player1 : gameInfo.player2
  const opponentPlayer = isPlayer1 ? gameInfo.player2 : gameInfo.player1

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getGameModeName = (mode: string) => {
    return mode === 'LONG' ? 'Длинные' : 'Короткие'
  }

  const tableNumber = gameId?.slice(-2) || '0'
  const gameMode = gameInfo.mode || 'LONG'
  const stake = Number(gameInfo.stake || 0)

  const handleBack = async () => {
    // Для бот-игр просто выходим без сдачи
    if (isBotGame && gameInfo?.type === 'vs_bot') {
      navigate('/game/modes')
      return
    }

    // Если игра активна (в процессе) - показываем модальное окно
    if (gameStatus === 'in_progress' && gameId && gameInfo?.type !== 'vs_bot') {
      setShowExitModal(true)
      return
    }

    // Если игра не завершена и не бот-игра, сдаем игру
    if (gameStatus !== 'finished' && gameId && gameInfo?.type !== 'vs_bot') {
      try {
        await apiClient.post(`/games/${gameId}/resign`)
      } catch (error) {
        console.error('Failed to resign game:', error)
      }
    }
    
    // Редирект на главную после сдачи или если игра уже завершена
    navigate('/')
  }

  const handleConfirmExit = async () => {
    setShowExitModal(false)
    if (gameId) {
      try {
        await apiClient.post(`/games/${gameId}/resign`)
      } catch (error) {
        console.error('Failed to resign game:', error)
      }
    }
    navigate('/')
  }

  const handleCancelExit = () => {
    setShowExitModal(false)
  }

  return (
    <div className="app-container game-container page-transition">
      <PageHeader 
        title={`Table ${tableNumber} - ${getGameModeName(gameMode)}${stake > 0 ? ` - ${stake} NAR` : ''}`}
        onBack={handleBack}
      />
      
      <div className="game-players-section">
        {/* Левый игрок */}
        <div className={`game-player ${isPlayer1 ? 'game-player-me' : ''}`}>
          <div className="game-player-name">{myPlayer?.nickname || myPlayer?.username || 'Вы'}</div>
          <div className={`game-player-avatar ${isMyTurn && isPlayer1 ? 'game-player-active' : ''}`}>
            {myPlayer?.avatarUrl ? (
              <img src={myPlayer.avatarUrl} alt={myPlayer.username} />
            ) : (
              <Icon name="user" size={48} />
            )}
          </div>
          <div className={`game-player-timer ${isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
            {formatTime(player1Timer)}
          </div>
          {myPlayer?.country && (
            <Icon name={`flag-${myPlayer.country.toLowerCase()}`} size={16} />
          )}
        </div>

        {/* Счет */}
        <div className="game-score-section">
          <div className="game-score-label">до 3</div>
          <div className="game-score">
            {score.player1}:{score.player2}
          </div>
        </div>

        {/* Правый игрок */}
        <div className={`game-player ${!isPlayer1 ? 'game-player-me' : ''}`}>
          <div className="game-player-name">{opponentPlayer?.nickname || opponentPlayer?.username || 'Соперник'}</div>
          <div className={`game-player-avatar ${!isPlayer1 && isMyTurn ? 'game-player-active' : ''}`}>
            {opponentPlayer?.avatarUrl ? (
              <img src={opponentPlayer.avatarUrl} alt={opponentPlayer.username} />
            ) : (
              <Icon name="user" size={48} />
            )}
            <div className={`game-player-timer ${!isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
              {formatTime(player2Timer)}
            </div>
          </div>
          {opponentPlayer?.country && (
            <Icon name={`flag-${opponentPlayer.country.toLowerCase()}`} size={16} />
          )}
        </div>
      </div>

      {/* Состояние ожидания соперника или готовности к старту */}
      {gameStatus === 'waiting' && !isBotGame && gameInfo?.type === 'vs_player' && (
        <div className="game-waiting-section" style={{ padding: '20px', textAlign: 'center' }}>
          {!gameInfo?.player2Id ? (
            <div>
              <div style={{ marginBottom: '16px', fontSize: '18px', color: '#aaaaaa' }}>
                ⏳ Ожидание соперника...
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                Ждем пока другой игрок присоединится к столу
              </div>
            </div>
          ) : (
            <div>
              {!myReady ? (
                <div>
                  <div style={{ marginBottom: '16px', fontSize: '18px', color: '#aaaaaa' }}>
                    ✅ Соперник присоединился
                  </div>
                  <Button 
                    variant="primary" 
                    fullWidth 
                    onClick={handleReadyToStart}
                    className="game-confirm-btn"
                  >
                    Начать игру
                  </Button>
                  <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                    {player1Ready && player2Ready 
                      ? 'Оба игрока готовы, игра скоро начнется...'
                      : (player1Ready || player2Ready)
                      ? 'Ожидание готовности соперника...'
                      : 'Нажмите кнопку когда будете готовы начать'}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '16px', fontSize: '18px', color: '#aaaaaa' }}>
                    ⏳ Ожидание готовности соперника...
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Вы готовы. Ждем пока соперник нажмет "Начать игру"
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Таймер на ход и кнопка подтверждения */}
      {(gameStatus === 'in_progress' && isMyTurn && gameState.dice && (
        (Array.isArray(gameState.dice) && gameState.dice.length >= 2) ||
        (typeof gameState.dice === 'object' && gameState.dice.die1 && gameState.dice.die2)
      )) && (
        <div className="game-confirm-section">
          {!isInOvertime && moveTimer > 0 && (
            <div className="game-move-timer" style={{ 
              textAlign: 'center', 
              marginBottom: '12px', 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: moveTimer <= 5 ? '#ff3333' : '#ffffff'
            }}>
              ⏱️ Время на ход: {moveTimer}с
            </div>
          )}
          {isInOvertime && (
            <div className="game-overtime-timer" style={{ 
              textAlign: 'center', 
              marginBottom: '12px', 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: overtimeTimer <= 10 ? '#ff3333' : '#ffaa00'
            }}>
              ⚠️ Овертайм: {overtimeTimer}с
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            {pendingMoves.length > 0 && (
              <Button 
                variant="secondary" 
                onClick={handleUndo}
                style={{ flex: 1 }}
              >
                Отменить
              </Button>
            )}
            <Button 
              variant="primary" 
              onClick={handleConfirm}
              className="game-confirm-btn"
              disabled={pendingMoves.length === 0}
              style={{ flex: 2 }}
            >
              {pendingMoves.length > 0 ? `Подтвердить (${pendingMoves.length})` : 'Подтвердить ход'}
            </Button>
          </div>
        </div>
      )}

      {/* Модальное окно выхода */}
      {showExitModal && (
        <div className="modal-overlay" onClick={handleCancelExit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Выход из игры</h2>
            <p>Вы уверены? Вам засчитается поражение!</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <Button 
                variant="primary" 
                onClick={handleConfirmExit}
                style={{ flex: 1 }}
              >
                Да, сдаться
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleCancelExit}
                style={{ flex: 1 }}
              >
                Нет, продолжить
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Доска - показываем только когда игра в процессе или завершена */}
      {gameStatus === 'in_progress' || gameStatus === 'finished' ? (
        <div className="board-wrapper">
          <BackgammonBoard
            key={`board-${gameState?.points?.join(',')}-${gameState?.currentPlayer}-${pendingMoves.length}`}
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
        </div>
      ) : null}

      {gameStatus === 'finished' && (
        <div className="game-overlay">
          <div className="game-result">
            <h2>Игра завершена!</h2>
            <p>Победитель: {score.player1 > score.player2 ? (isPlayer1 ? 'Вы' : myPlayer?.username) : (isPlayer1 ? opponentPlayer?.username : 'Вы')}</p>
            <button onClick={() => navigate('/game/result/' + gameId)}>Посмотреть результат</button>
          </div>
        </div>
      )}
    </div>
  )
}
