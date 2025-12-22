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
  const [player1Timer, setPlayer1Timer] = useState<number>(0)
  const [player2Timer, setPlayer2Timer] = useState<number>(0)
  const [diceAnimating, setDiceAnimating] = useState<boolean>(false)
  const [playerSkins, setPlayerSkins] = useState<{ player1: any; player2: any; mySkins: any }>({ player1: null, player2: null, mySkins: null })
  const [player1Ready, setPlayer1Ready] = useState<boolean>(false)
  const [player2Ready, setPlayer2Ready] = useState<boolean>(false)
  const [myReady, setMyReady] = useState<boolean>(false)
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
      
      setGameState({
        points: game.gameState?.points || [],
        bar: game.gameState?.bar || { white: 0, black: 0 },
        bearOff: game.gameState?.bearOff || { white: 0, black: 0 },
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
      // Загружаем выбранные скины для player1
      let player1Skins = {}
      if (user?.id === player1Id) {
        try {
          const player1SkinsRes = await apiClient.get('/skins/selected')
          player1Skins = player1SkinsRes.data || {}
        } catch (err) {
          try {
            const fallbackRes = await apiClient.get(`/skins/user/${player1Id}/selected`)
            player1Skins = fallbackRes.data || {}
          } catch {
            player1Skins = {}
          }
        }
      } else {
        try {
          const player1SkinsRes = await apiClient.get(`/skins/user/${player1Id}/selected`)
          player1Skins = player1SkinsRes.data || {}
        } catch {
          player1Skins = {}
        }
      }
      
      // Загружаем выбранные скины для player2 (если есть)
      let player2Skins = {}
      if (player2Id) {
        if (user?.id === player2Id) {
          try {
            const player2SkinsRes = await apiClient.get('/skins/selected')
            player2Skins = player2SkinsRes.data || {}
          } catch (err) {
            try {
              const fallbackRes = await apiClient.get(`/skins/user/${player2Id}/selected`)
              player2Skins = fallbackRes.data || {}
            } catch {
              player2Skins = {}
            }
          }
        } else {
          try {
            const player2SkinsRes = await apiClient.get(`/skins/user/${player2Id}/selected`)
            player2Skins = player2SkinsRes.data || {}
          } catch {
            player2Skins = {}
          }
        }
      }
      
      // Определяем скины текущего пользователя (для доски и кубиков)
      const isPlayer1 = user?.id === player1Id
      const mySkins = isPlayer1 ? player1Skins : player2Skins
      
      console.log('🎮 Game - Loaded player skins:', {
        player1Skins,
        player2Skins,
        mySkins,
        isPlayer1,
        player1Id,
        player2Id,
        userId: user?.id,
      })
      
      setPlayerSkins({
        player1: player1Skins || {},
        player2: player2Skins || {},
        mySkins: mySkins || {},
      })
    } catch (error) {
      setPlayerSkins({
        player1: {},
        player2: {},
        mySkins: {},
      })
    }
  }

  const createBotGame = async () => {
    try {
      const response = await apiClient.post('/games/create-bot')
      navigate(`/game/${response.data.id}`)
    } catch (error) {
      console.error('Failed to create bot game:', error)
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
      
      setGameState({
        points: data.gameState?.points || [],
        bar: data.gameState?.bar || { white: 0, black: 0 },
        bearOff: data.gameState?.bearOff || data.gameState?.borneOff || { white: 0, black: 0 },
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
      })
      const newStatus = data.status || 'waiting'
      setGameStatus(newStatus)
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      
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
      
      setGameState({
        points: data.gameState?.points || [],
        bar: data.gameState?.bar || { white: 0, black: 0 },
        bearOff: data.gameState?.bearOff || data.gameState?.borneOff || { white: 0, black: 0 },
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
      })
      setGameStatus(data.status || 'in_progress')
      console.log('🔄 Обновляем состояние игры после хода')
      
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
      }, 1000) // Анимация длится 1 секунду
      // Обновляем кубики, но также перезагружаем игру чтобы получить актуальное состояние
      // Это важно, так как после хода бота может измениться currentPlayer
      loadGame()
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

    const socket = getSocket()
    if (!socket) {
      console.error('❌ WebSocket не подключен')
      return
    }

    try {
      // Собираем все ходы в массив (пока один ход)
      const moves = [{ from, to, die }]
      console.log('📤 Отправляем ход на сервер:', { gameId, moves })
      socket.emit('make_move', {
        gameId,
        moves,
      })
      console.log('✅ Ход отправлен на сервер')
    } catch (error) {
      console.error('❌ Ошибка отправки хода:', error)
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
    // Правильно проверяем наличие кубиков: массив должен быть непустым
    const hasDice = gameState?.dice && (
      (Array.isArray(gameState.dice) && gameState.dice.length >= 2) ||
      (typeof gameState.dice === 'object' && gameState.dice.die1 && gameState.dice.die2)
    )
    console.log('🔘 handleConfirm вызван', { gameId, gameStatus, isMyTurn, hasDice, dice: gameState?.dice })
    
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
    // Эта проверка больше не нужна, но оставляем для совместимости
    if (gameStatus === 'waiting' && isBotGame) {
      console.log('🎲 Начинаем игру - бросаем кубики')
      try {
        let socket = getSocket()
        
        // Если WebSocket не подключен, пытаемся переподключиться
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
        // Бросаем кубики через WebSocket
        socket.emit('roll_dice', { gameId })
        
        // Обновляем состояние через небольшую задержку
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

    // Если игра в процессе и есть кубики и это мой ход - ничего не делаем
    // Ход уже сделан через клик по доске, подтверждение не требуется
    if (gameStatus === 'in_progress' && hasDice && isMyTurn) {
      console.log('ℹ️ Ход уже сделан, подтверждение не требуется')
      return
    }
    
    // Кубики теперь бросаются только по кнопке, не автоматически
    console.log('ℹ️ Для броска кубиков используйте кнопку "Бросить кубики"')
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

      {/* Кнопка подтверждения хода (кубики бросаются автоматически) */}
      {(gameStatus === 'in_progress' && isMyTurn && gameState.dice && (
        (Array.isArray(gameState.dice) && gameState.dice.length >= 2) ||
        (typeof gameState.dice === 'object' && gameState.dice.die1 && gameState.dice.die2)
      )) && (
        <div className="game-confirm-section">
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleConfirm}
            className="game-confirm-btn"
          >
            Подтвердить ход
          </Button>
        </div>
      )}

      {/* Доска - показываем только когда игра в процессе или завершена */}
      {gameStatus === 'in_progress' || gameStatus === 'finished' ? (
        <div className="board-wrapper">
          <BackgammonBoard
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
