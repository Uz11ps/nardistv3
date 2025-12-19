import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { getSocket } from '../api/websocket'
import './GameSearch.css'

export default function GameSearch() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searching, setSearching] = useState(false)
  const [mode, setMode] = useState<'long' | 'short'>('long')
  const [format, setFormat] = useState<'rating' | 'normal'>('rating')
  const [timeLimit, setTimeLimit] = useState<30 | 60>(30)
  const [stake, setStake] = useState<0 | 100 | 500 | 1000>(0)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socket.on('matchmaking:found', (data: any) => {
      setSearching(false)
      navigate(`/game/${data.gameId}`)
    })

    return () => {
      socket.off('matchmaking:found')
    }
  }, [navigate])

  const handleStartSearch = () => {
    const socket = getSocket()
    if (!socket) return

    setSearching(true)
    socket.emit('matchmaking:join', {
      mode,
      format,
      timeLimit,
      stake,
    })
  }

  const handleCancelSearch = () => {
    const socket = getSocket()
    if (!socket) return

    setSearching(false)
    socket.emit('matchmaking:leave')
  }

  return (
    <div className="app-container">
      <PageHeader title="Поиск" />
      
      <div style={{ padding: '20px' }}>
        <div className="card-subtitle" style={{ marginBottom: '24px', textAlign: 'center' }}>
          Подбор по рейтингу и режиму
        </div>

        {/* Режим */}
        <Card style={{ marginBottom: '16px' }}>
          <div className="form-label" style={{ marginBottom: '12px' }}>Режим:</div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${mode === 'long' ? 'active' : ''}`}
              onClick={() => setMode('long')}
            >
              Длинные
            </button>
            <button
              className={`toggle-btn ${mode === 'short' ? 'active' : ''}`}
              onClick={() => setMode('short')}
            >
              Короткие
            </button>
          </div>
        </Card>

        {/* Формат */}
        <Card style={{ marginBottom: '16px' }}>
          <div className="form-label" style={{ marginBottom: '12px' }}>Формат:</div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${format === 'rating' ? 'active' : ''}`}
              onClick={() => setFormat('rating')}
            >
              Рейтинг
            </button>
            <button
              className={`toggle-btn ${format === 'normal' ? 'active' : ''}`}
              onClick={() => setFormat('normal')}
            >
              Обычный
            </button>
          </div>
        </Card>

        {/* Время на ход */}
        <Card style={{ marginBottom: '16px' }}>
          <div className="form-label" style={{ marginBottom: '12px' }}>Время на ход:</div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${timeLimit === 30 ? 'active' : ''}`}
              onClick={() => setTimeLimit(30)}
            >
              30 сек
            </button>
            <button
              className={`toggle-btn ${timeLimit === 60 ? 'active' : ''}`}
              onClick={() => setTimeLimit(60)}
            >
              60 сек
            </button>
          </div>
        </Card>

        {/* Ставка */}
        <Card style={{ marginBottom: '24px' }}>
          <div className="form-label" style={{ marginBottom: '12px' }}>Ставка:</div>
          <div className="stake-buttons">
            {[0, 100, 500, 1000].map((value) => (
              <button
                key={value}
                className={`stake-btn ${stake === value ? 'active' : ''}`}
                onClick={() => setStake(value as typeof stake)}
              >
                {value === 0 ? '0' : `${value} NAR`}
              </button>
            ))}
          </div>
        </Card>

        {searching ? (
          <div className="searching-container">
            <div className="searching-animation">
              <div className="search-dot" style={{ animationDelay: '0s' }} />
              <div className="search-dot" style={{ animationDelay: '0.2s' }} />
              <div className="search-dot" style={{ animationDelay: '0.4s' }} />
            </div>
            <p className="searching-text">Подбираем противника по рейтингу и ставке...</p>
            <Button variant="secondary" fullWidth onClick={handleCancelSearch}>
              Отменить поиск
            </Button>
          </div>
        ) : (
          <Button fullWidth onClick={handleStartSearch}>
            Начать поиск
          </Button>
        )}

        <div style={{ marginTop: '24px', fontSize: '14px', color: '#aaaaaa', textAlign: 'center' }}>
          Игры дают опыт, NAR-coin и рейтинг
        </div>
      </div>
    </div>
  )
}

