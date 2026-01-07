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
  const [stake, setStake] = useState<number>(0)
  const stakeOptions = [0, 50, 100, 250, 500, 750, 1000, 1500, 3000, 5000]
  const [matchesToWin, setMatchesToWin] = useState<number>(1)
  const matchesToWinOptions = [1, 2, 3, 5]

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
      matchesToWin,
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
        <div className="game-search-card-v2">
          {/* Режим */}
          <div className="game-search-field-v2">
            <div className="game-search-label-v2">Режим:</div>
            <div className="mode-toggle-v2">
              <button
                className={`mode-toggle-btn-v2 ${mode === 'long' ? 'active' : ''}`}
                onClick={() => setMode('long')}
              >
                Длинные
              </button>
              <button
                className={`mode-toggle-btn-v2 ${mode === 'short' ? 'active' : ''}`}
                onClick={() => setMode('short')}
              >
                Короткие
              </button>
            </div>
          </div>

          {/* Ставка */}
          <div className="game-search-field-v2">
            <div className="game-search-label-v2">Ставка:</div>
            <div className="stake-grid-v2">
              {stakeOptions.map((value) => (
                <button
                  key={value}
                  className={`stake-btn-v2 ${stake === value ? 'selected' : ''}`}
                  onClick={() => setStake(value)}
                >
                  {value === 0 ? 'FREE' : value}
                </button>
              ))}
            </div>
          </div>

          {/* До побед */}
          <div className="game-search-field-v2">
            <div className="game-search-label-v2">Матч до:</div>
            <div className="stake-grid-v2">
              {matchesToWinOptions.map((value) => (
                <button
                  key={value}
                  className={`stake-btn-v2 ${matchesToWin === value ? 'selected' : ''}`}
                  onClick={() => setMatchesToWin(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="game-search-info-v2">
            Время на игру: 60 сек<br/>
            Время на ход: 15 сек<br/>
            Матч до: {matchesToWin} {matchesToWin === 1 ? 'победы' : matchesToWin < 5 ? 'побед' : 'побед'}<br/>
            Куб удвоения: Да
          </div>

          {!searching ? (
            <button onClick={handleStartSearch} className="game-search-start-btn-v2">
              Начать поиск
            </button>
          ) : (
            <div className="game-search-searching-v2">
              <div className="searching-text-v2">Подбираем противника по рейтингу и ставке...</div>
              <button className="game-search-cancel-btn-v2" onClick={handleCancelSearch}>
                Отменить поиск
              </button>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
