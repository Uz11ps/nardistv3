import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import BackgammonBoard from '../components/BackgammonBoard'
import Dice from '../components/Dice'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { getSocket } from '../api/websocket'
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
      setGameState({
        points: game.gameState?.points || [],
        bar: game.gameState?.bar || { white: 0, black: 0 },
        bearOff: game.gameState?.bearOff || { white: 0, black: 0 },
        currentPlayer: game.currentPlayer || 0,
        dice: game.gameState?.dice || null,
        canMove: game.player1Id === user?.id ? game.currentPlayer === 0 : game.currentPlayer === 1,
      })
      setOpponent(game.player1Id === user?.id ? game.player2 : game.player1)
      setScore({ player1: game.player1Score || 0, player2: game.player2Score || 0 })
      setGameStatus(game.status)
    } catch (error) {
      console.error('Failed to load game:', error)
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
    if (!socket) return

    socket.emit('game:join', { gameId })

    socket.on('game:update', (data: any) => {
      setGameState((prev) => ({
        ...prev!,
        ...data.gameState,
        currentPlayer: data.currentPlayer,
        canMove: data.currentPlayer === (data.player1Id === user?.id ? 0 : 1),
      }))
      setGameStatus(data.status)
      loadGame()
    })

    socket.on('game:move', (data: any) => {
      loadGame()
    })

    socket.on('game:dice', (data: any) => {
      setGameState((prev) => ({
        ...prev!,
        dice: { die1: data.die1, die2: data.die2 },
      }))
    })

    socket.on('game:finished', (data: any) => {
      setGameStatus('finished')
      setTimeout(() => {
        navigate('/')
      }, 3000)
    })
  }

  const handleMove = async (from: number, to: number, die: number) => {
    if (!gameId || !gameState?.canMove) return

    const socket = getSocket()
    if (!socket) return

    try {
      socket.emit('game:move', {
        gameId,
        from,
        to,
        die,
      })
    } catch (error) {
      console.error('Failed to make move:', error)
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

  const handleConfirm = () => {
    // Подтверждение хода - если все кубики использованы, автоматически передать ход
    // Или подтвердить готовность к игре
    if (gameStatus === 'waiting') {
      // TODO: Подтвердить готовность
    }
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

      {/* Кнопка подтверждения */}
      {(gameStatus === 'waiting' || (gameStatus === 'in_progress' && isMyTurn && gameState.dice)) && (
        <div className="game-confirm-section">
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleConfirm}
            className="game-confirm-btn"
          >
            Подтвердить
          </Button>
        </div>
      )}

      {/* Доска */}
      <div className="board-wrapper">
        <BackgammonBoard
          gameState={gameState}
          currentPlayer={gameState.currentPlayer}
          dice={gameState.dice ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2]) : null}
          onMove={handleMove}
          onRollDice={handleRollDice}
          canMove={gameState.canMove}
          isMyTurn={isMyTurn}
          gameId={gameId}
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
