import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { getMatchmakingSocket } from '../api/websocket'
import './GameSearch.css'

export default function GameSearch() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searching, setSearching] = useState(false)
  const [mode, setMode] = useState<'long' | 'short'>('long')
  const [stake, setStake] = useState<0 | 100 | 500 | 1000>(0)

  useEffect(() => {
    const socket = getMatchmakingSocket()
    if (!socket) return

    socket.on('match_found', (data: any) => {
      setSearching(false)
      navigate(`/game/${data.gameId}`)
    })

    socket.on('searching', () => {
      setSearching(true)
    })

    socket.on('search_cancelled', () => {
      setSearching(false)
    })

    return () => {
      socket.off('match_found')
      socket.off('searching')
      socket.off('search_cancelled')
    }
  }, [navigate])

  const handleStartSearch = () => {
    const socket = getMatchmakingSocket()
    if (!socket) {
      alert('WebSocket не подключен. Перезагрузите страницу.')
      return
    }

    setSearching(true)
    socket.emit('find_match', {
      mode,
      stake,
    })
  }

  const handleCancelSearch = () => {
    const socket = getMatchmakingSocket()
    if (!socket) return

    setSearching(false)
    socket.emit('cancel_search')
  }

  return (
    <PageLayout title="Поиск" subtitle="Подбор по рейтингу и режиму" showBack={true}>
      <div className="game-search-content">
        <div className="game-search-card">
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
            {stake > 0 && (
              <div className="stake-prize-info">
                Приз за победу: {stake * 2 - 15} NAR
                <span className="stake-commission"> (комиссия 15 NAR)</span>
              </div>
            )}
          </div>

          {/* Кнопка поиска */}
          {!searching && (
            <button onClick={handleStartSearch} className="game-search-start-btn">
              Начать поиск
            </button>
          )}
        </div>

        {searching && (
          <div className="game-search-searching">
            <div className="searching-text">Подбираем противника по рейтингу и ставке...</div>
            <button className="game-search-cancel-btn" onClick={handleCancelSearch}>
              Отменить поиск
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
