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
    <div className="app-container page-transition">
      <PageHeader title="Поиск" />
      
      <div className="game-search-content">
        <div className="game-search-subtitle">Подбор по рейтингу и режиму</div>

        <Card className="game-search-card">
          {/* Режим */}
          <div className="game-search-field">
            <div className="game-search-label">Режим:</div>
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
          </div>

          {/* Формат */}
          <div className="game-search-field">
            <div className="game-search-label">Формат:</div>
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
          </div>

          {/* Время на ход */}
          <div className="game-search-field">
            <div className="game-search-label">Время на ход:</div>
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
          </div>

          {/* Ставка */}
          <div className="game-search-field">
            <div className="game-search-label">Ставка:</div>
            <div className="stake-buttons">
              {[0, 100, 500, 1000].map((value) => (
                <button
                  key={value}
                  className={`stake-btn ${stake === value ? 'active' : ''}`}
                  onClick={() => setStake(value as typeof stake)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Кнопка поиска */}
          {!searching && (
            <Button fullWidth onClick={handleStartSearch} className="game-search-start-btn">
              Начать поиск
            </Button>
          )}
        </Card>

        {searching && (
          <div className="game-search-searching">
            <div className="searching-text">Подбираем противника по рейтингу и ставке...</div>
            <Button variant="secondary" fullWidth onClick={handleCancelSearch}>
              Отменить поиск
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
