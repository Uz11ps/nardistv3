import { useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'

export default function GameResult() {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const location = useLocation()
  
  // Получаем результат из state навигации или параметров
  const gameResult = location.state || { result: 'win', score: { player1: 5, player2: 2 } }
  const { result, score } = gameResult

  useEffect(() => {
    // Если нет gameId и результата, перенаправляем на главную
    if (!gameId && !gameResult) {
      navigate('/')
    }
  }, [gameId, gameResult, navigate])

  const isWinner = result === 'win'
  const isDraw = result === 'draw'

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
            <span className="card-subtitle">15:32</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="card-subtitle">Ходов:</span>
            <span className="card-subtitle">42</span>
          </div>

          {isWinner && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#3a3a3a', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#aaaaaa', marginBottom: '4px' }}>Награды:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="gold" style={{ fontWeight: 600 }}>💰 +50 NAR</span>
                <span style={{ color: '#ff3333', fontWeight: 600 }}>🔥 +25 XP</span>
              </div>
            </div>
          )}
        </Card>

        {/* Действия */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/game/search')}
          >
            Играть еще
          </Button>
          
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate('/history')}
          >
            История игр
          </Button>
          
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate('/')}
          >
            На главную
          </Button>
        </div>
      </div>    </div>
  )
}

