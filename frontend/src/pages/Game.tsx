import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import BackgammonBoard from '../components/BackgammonBoard'
import Dice from '../components/Dice'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { getSocket, connectWebSocket } from '../api/websocket'
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
  const [playerSkins, setPlayerSkins] = useState<{ player1: any; player2: any }>({ player1: null, player2: null })
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
    }
  }, [gameId, isBotGame])

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
      
      // Загружаем скины игроков
      await loadPlayerSkins(game.player1Id, game.player2Id)
    } catch (error) {
      console.error('Failed to load game:', error)
    }
  }

  const loadPlayerSkins = async (player1Id: string, player2Id: string) => {
    try {
      const [player1SkinsRes, player2SkinsRes] = await Promise.all([
        apiClient.get(`/skins/user/${player1Id}`).catch(() => ({ data: [] })),
        player2Id ? apiClient.get(`/skins/user/${player2Id}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ])
      
      // Выбираем скины с наибольшим весом/рарностью для каждого типа
      const getBestSkin = (skins: any[], type: string) => {
        const typeSkins = skins.filter(s => s.type === type)
        if (typeSkins.length === 0) return null
        
        // Сортируем по рарности (legendary > epic > rare > common) и весу
        const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }
        return typeSkins.sort((a, b) => {
          const rarityDiff = (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0)
          if (rarityDiff !== 0) return rarityDiff
          return (b.weight || 0) - (a.weight || 0)
        })[0]
      }
      
      const player1Skins = player1SkinsRes.data || []
      const player2Skins = player2SkinsRes.data || []
      
      setPlayerSkins({
        player1: {
          board: getBestSkin(player1Skins, 'board'),
          dice: getBestSkin(player1Skins, 'dice'),
          checkers: getBestSkin(player1Skins, 'checkers'),
        },
        player2: {
          board: getBestSkin(player2Skins, 'board'),
          dice: getBestSkin(player2Skins, 'dice'),
          checkers: getBestSkin(player2Skins, 'checkers'),
        },
      })
    } catch (error) {
      console.error('Failed to load player skins:', error)
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
      
      // Если это мой ход и нет кубиков - автоматически бросаем кубики
      if (canMove && !formattedDice && data.status === 'in_progress') {
        console.log('🎲 Автоматически бросаем кубики после хода бота')
        setTimeout(() => {
          const socket = getSocket()
          if (socket && socket.connected) {
            socket.emit('roll_dice', { gameId: data.id })
          }
        }, 500)
      }
    })

    socket.on('dice_rolled', (data: any) => {
      console.log('🎲 Получено dice_rolled:', data)
      // Обновляем кубики, но также перезагружаем игру чтобы получить актуальное состояние
      // Это важно, так как после хода бота может измениться currentPlayer
      loadGame()
    })

    socket.on('game_finished', (data: any) => {
      console.log('🏁 Игра завершена:', data)
      setGameStatus('finished')
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
    })

    socket.on('error', (error: any) => {
      console.error('❌ WebSocket error:', error)
    })
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

    // Если игра в статусе waiting - начинаем игру (бросаем кубики)
    if (gameStatus === 'waiting') {
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
    
    // Если игра в процессе и нет кубиков и это мой ход - бросаем кубики
    if (gameStatus === 'in_progress' && !hasDice && isMyTurn) {
      console.log('🎲 Бросаем кубики для нового хода')
      try {
        const socket = getSocket()
        if (socket && socket.connected) {
          socket.emit('roll_dice', { gameId })
        } else {
          console.error('❌ WebSocket не подключен')
        }
      } catch (error) {
        console.error('❌ Failed to roll dice:', error)
      }
      return
    }
    
    console.log('⚠️ Условия не выполнены:', { gameStatus, hasDice, isMyTurn, dice: gameState?.dice })
  }

  const startTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      if (gameState?.currentPlayer === 0) {
        setPlayer1Timer((prev) => prev + 1)
      } else {
        setPlayer2Timer((prev) => prev + 1)
      }
    }, 1000)
  }

  useEffect(() => {
    if (gameStatus === 'in_progress' && gameState) {
      startTimers()
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [gameState?.currentPlayer, gameStatus])

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
        title={`Стол ${tableNumber} • ${getGameModeName(gameMode)}${stake > 0 ? ` - ${stake} NAR` : ''}`}
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
          </div>
          <div className={`game-player-timer ${!isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
            {formatTime(player2Timer)}
          </div>
          {opponentPlayer?.country && (
            <Icon name={`flag-${opponentPlayer.country.toLowerCase()}`} size={16} />
          )}
        </div>
      </div>

      {/* Кнопка подтверждения / броска кубиков */}
      {(gameStatus === 'waiting' || (gameStatus === 'in_progress' && isMyTurn)) && (
        <div className="game-confirm-section">
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleConfirm}
            className="game-confirm-btn"
          >
            {gameStatus === 'waiting' 
              ? 'Начать игру' 
              : (gameState.dice && (
                  (Array.isArray(gameState.dice) && gameState.dice.length >= 2) ||
                  (typeof gameState.dice === 'object' && gameState.dice.die1 && gameState.dice.die2)
                ))
              ? 'Подтвердить ход'
              : 'Бросить кубики'}
          </Button>
        </div>
      )}

      {/* Доска */}
      <div className="board-wrapper">
        <BackgammonBoard
          playerSkins={isPlayer1 ? playerSkins.player1 : playerSkins.player2}
          opponentSkins={isPlayer1 ? playerSkins.player2 : playerSkins.player1}
          gameState={gameState}
          currentPlayer={gameState.currentPlayer}
          dice={gameState.dice ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2]) : null}
          onMove={handleMove}
          onRollDice={handleRollDice}
          canMove={gameState.canMove}
          isMyTurn={isMyTurn}
          gameId={gameId}
          gameMode={gameInfo?.mode || 'long'}
        />
      </div>

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
