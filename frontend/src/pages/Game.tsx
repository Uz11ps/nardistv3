import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import BackgammonBoard from '../components/BackgammonBoard'
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
  const [opponent, setOpponent] = useState<any>(null)
  const [score, setScore] = useState({ player1: 0, player2: 0 })
  const [gameStatus, setGameStatus] = useState<string>('waiting')
  const [timer, setTimer] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const mode = searchParams.get('mode')
  const isBotGame = mode === 'bot'

  useEffect(() => {
    if (gameId) {
      loadGame()
      connectToGame()
    } else if (isBotGame) {
      createBotGame()
    } else {
      navigate('/game/search')
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      const socket = getSocket()
      if (socket) {
        socket.off('game:update')
        socket.off('game:move')
        socket.off('game:dice')
        socket.off('game:finished')
      }
    }
  }, [gameId, isBotGame])

  const loadGame = async () => {
    try {
      const response = await apiClient.get(`/games/${gameId}`)
      const game = response.data
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
    })

    socket.on('game:move', (data: any) => {
      // Анимация хода
      animateMove(data.from, data.to)
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

  const animateMove = (from: number, to: number) => {
    // Анимация будет обработана в компоненте доски
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
      socket.emit('game:roll-dice', { gameId })
    } catch (error) {
      console.error('Failed to roll dice:', error)
    }
  }

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (gameState?.canMove && gameStatus === 'in_progress') {
      setTimer(60) // 60 секунд на ход
      startTimer()
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [gameState?.canMove, gameStatus])

  if (!gameState) {
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
  const myScore = gameState.currentPlayer === 0 ? score.player1 : score.player2
  const opponentScore = gameState.currentPlayer === 0 ? score.player2 : score.player1

  return (
    <div className="app-container game-container">
      <PageHeader title={`Стол ${gameId?.slice(0, 8)}`} />
      
      <div className="game-header">
        <div className="player-info">
          <div className="player-avatar">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} />
            ) : (
              <div>👤</div>
            )}
          </div>
          <div>
            <div className="player-name">{user?.nickname || user?.username}</div>
            <div className="player-score">Счет: {myScore}</div>
          </div>
          {isMyTurn && (
            <div className="turn-indicator">
              <div className="pulse-dot" />
              Ваш ход
            </div>
          )}
        </div>

        <div className="game-info">
          {gameState.dice && (
            <div className="dice-display">
              <div className="dice">{gameState.dice.die1}</div>
              <div className="dice">{gameState.dice.die2}</div>
            </div>
          )}
          {timer > 0 && (
            <div className={`timer ${timer < 10 ? 'timer-warning' : ''}`}>
              {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>

        <div className="player-info">
          <div className="player-avatar">
            {opponent?.avatarUrl ? (
              <img src={opponent.avatarUrl} alt={opponent.username} />
            ) : (
              <div>{isBotGame ? '🤖' : '👤'}</div>
            )}
          </div>
          <div>
            <div className="player-name">{opponent?.nickname || opponent?.username || 'Бот'}</div>
            <div className="player-score">Счет: {opponentScore}</div>
          </div>
          {!isMyTurn && gameStatus === 'in_progress' && (
            <div className="turn-indicator">
              <div className="pulse-dot" />
              Ход соперника
            </div>
          )}
        </div>
      </div>

      <div className="board-wrapper">
        <BackgammonBoard
          gameState={gameState}
          currentPlayer={gameState.currentPlayer}
          dice={gameState.dice}
          onMove={handleMove}
          onRollDice={handleRollDice}
          canMove={gameState.canMove}
          isMyTurn={isMyTurn}
        />
      </div>

      {gameStatus === 'finished' && (
        <div className="game-overlay">
          <div className="game-result">
            <h2>Игра завершена!</h2>
            <p>Победитель: {myScore > opponentScore ? 'Вы' : opponent?.username || 'Соперник'}</p>
            <button onClick={() => navigate('/')}>Вернуться</button>
          </div>
        </div>
      )}
    </div>
  )
}
