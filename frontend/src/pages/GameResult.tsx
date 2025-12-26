import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function GameResult() {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const location = useLocation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [gameData, setGameData] = useState<any>(null)
  const [movesCount, setMovesCount] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rewards, setRewards] = useState<{ xp: number; narCoin?: number }>({ xp: 0 })

  useEffect(() => {
    if (gameId) {
      loadGameData()
    } else {
      // Если нет gameId, используем данные из state
      const gameResult = location.state
      if (gameResult && gameResult.id) {
        // Если есть ID игры, загружаем полные данные
        loadGameDataById(gameResult.id)
      } else if (gameResult) {
        // Если есть данные, но нет ID - используем как есть
        setGameData(gameResult)
        setMovesCount(gameResult.movesCount || 0)
        setDuration(gameResult.duration || 0)
        setRewards(gameResult.rewards || { xp: 0 })
        setLoading(false)
      } else {
        navigate('/')
      }
    }
  }, [gameId])

  const loadGameDataById = async (id: string) => {
    try {
      setLoading(true)
      // Загружаем данные игры
      const [gameResponse, replayResponse] = await Promise.all([
        apiClient.get(`/games/${id}`).catch(() => ({ data: null })),
        apiClient.get(`/history/replay/${id}`).catch(() => ({ data: null })),
      ])

      const game = gameResponse.data
      if (!game) {
        alert('Игра не найдена')
        navigate('/')
        return
      }

      await processGameData(game, replayResponse.data)
    } catch (error) {
      console.error('Failed to load game data:', error)
      alert('Ошибка загрузки данных игры')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const loadGameData = async () => {
    if (!gameId) return
    await loadGameDataById(gameId)
  }

  const processGameData = async (game: any, replayData: any) => {
    // Определяем результат для текущего пользователя
    const isPlayer1 = game.player1Id === user?.id
    // Для игр с ботом: winnerId === null означает победу бота, winnerId === player1Id означает победу игрока
    const isWinner = game.type === 'vs_bot' 
      ? (game.winnerId === game.player1Id) 
      : (game.winnerId === user?.id)
    const isDraw = !game.winnerId && game.type !== 'vs_bot'
    
    // Подсчитываем количество ходов - загружаем реальные данные из реплея
    const moves = replayData?.moves || []
    const movesCountValue = Array.isArray(moves) ? moves.length : 0
    
    // Вычисляем продолжительность из реальных данных игры
    let durationSeconds = 0
    if (game.createdAt) {
      const startTime = new Date(game.createdAt).getTime()
      const endTime = game.updatedAt ? new Date(game.updatedAt).getTime() : Date.now()
      durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000))
    }
    
    // Получаем начисленный XP из данных игры
    const xpReward = isPlayer1 ? (game.player1XP || 0) : (game.player2XP || 0)
    
    // Если была ставка, вычисляем выигрыш
    let narCoinReward = undefined
    if (game.stake && game.stake > 0 && isWinner && game.type !== 'vs_bot') {
      const stakeValue = Number(game.stake)
      const totalPot = stakeValue * 2
      const commission = Math.floor(totalPot * 0.15) // 15% комиссия согласно бэкенду
      narCoinReward = totalPot - commission
    }

    setGameData({
      ...game,
      result: isWinner ? 'win' : isDraw ? 'draw' : 'loss',
      isWinner,
      isDraw,
      score: {
        player1: game.player1Score || 0,
        player2: game.player2Score || 0,
      },
    })
    setMovesCount(movesCountValue)
    setDuration(durationSeconds)
    setRewards({ xp: xpReward, narCoin: narCoinReward })
  }

  if (loading) {
    return (
      <div className="app-container">
        <PageHeader title="Результат игры" showBack={false} />
        <div style={{ padding: '40px', textAlign: 'center', color: '#B6B6B6' }}>Загрузка...</div>
      </div>
    )
  }

  if (!gameData) {
    return null
  }

  const { result, score, stake = 0 } = gameData
  const isWinner = gameData.isWinner
  const isDraw = gameData.isDraw

  return (
    <div className="app-container">
      <PageHeader title="Результат игры" showBack={false} />
      
      <div style={{ padding: '20px', textAlign: 'center' }}>
        {/* Результат */}
        <Card style={{ marginBottom: '20px', background: isWinner ? 'linear-gradient(135deg, rgba(0, 255, 0, 0.1), rgba(0, 200, 0, 0.1))' : isDraw ? 'linear-gradient(135deg, rgba(255, 255, 0, 0.1), rgba(200, 200, 0, 0.1))' : 'linear-gradient(135deg, rgba(255, 0, 0, 0.1), rgba(200, 0, 0, 0.1))' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>
            {isWinner ? '🎉' : isDraw ? '🤝' : '😔'}
          </div>
          <div className="card-title" style={{ fontSize: '28px', marginBottom: '8px' }}>
            {isWinner ? 'Победа!' : isDraw ? 'Ничья' : 'Поражение'}
          </div>
          <div className="card-subtitle" style={{ fontSize: '16px' }}>
            Счет: {score.player1} : {score.player2}
          </div>
        </Card>

        {/* Статистика игры */}
        <Card style={{ marginBottom: '20px', textAlign: 'left' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>Статистика игры</div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="card-subtitle">Продолжительность:</span>
            <span className="card-subtitle">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="card-subtitle">Ходов:</span>
            <span className="card-subtitle">{movesCount}</span>
          </div>

          {(isWinner || !isWinner) && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#3a3a3a', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#aaaaaa', marginBottom: '4px' }}>Награды:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#ff3333', fontWeight: 600 }}>🔥 +{rewards.xp} XP</span>
                {rewards.narCoin && rewards.narCoin > 0 && (
                  <span className="gold" style={{ fontWeight: 600 }}>
                    💰 +{rewards.narCoin} NAR
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Действия */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => navigate('/game/search')}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)',
              boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.25)',
              border: '0.1px solid #C93C3D',
              color: '#FFF',
              fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)'
              e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(232, 65, 66, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(0, 0, 0, 0.25)'
            }}
          >
            Играть еще
          </button>
          
          <button
            onClick={() => navigate('/history')}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              border: '1px solid #3a3a3a',
              color: '#FFF',
              fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2a2a2a'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)'
            }}
          >
            История игр
          </button>
          
          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              border: '1px solid #3a3a3a',
              color: '#FFF',
              fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2a2a2a'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)'
            }}
          >
            На главную
          </button>
        </div>
      </div>    </div>
  )
}

