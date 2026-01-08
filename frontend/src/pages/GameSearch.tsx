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
  const [queueStats, setQueueStats] = useState<{ longQueue: number; shortQueue: number; activeGames: number } | null>(null)

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

    socket.on('queue_stats', (stats: { longQueue: number; shortQueue: number; activeGames: number }) => {
      setQueueStats(stats)
    })

    // Запрашиваем статистику при подключении и периодически обновляем
    socket.emit('get_queue_stats')
    const statsInterval = setInterval(() => {
      socket.emit('get_queue_stats')
    }, 5000) // Обновляем каждые 5 секунд

    return () => {
      socket.off('match_found')
      socket.off('searching')
      socket.off('search_cancelled')
      socket.off('queue_stats')
      clearInterval(statsInterval)
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
                Длинные {queueStats && <span className="queue-count">({queueStats.longQueue})</span>}
              </button>
              <button
                className={`mode-toggle-btn-v2 ${mode === 'short' ? 'active' : ''}`}
                onClick={() => setMode('short')}
              >
                Короткие {queueStats && <span className="queue-count">({queueStats.shortQueue})</span>}
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
            Матч до: {matchesToWin} {matchesToWin === 1 ? 'победы' : matchesToWin < 5 ? 'побед' : 'побед'}
          </div>

          {!searching ? (
            <button onClick={handleStartSearch} className="game-search-start-btn-v2">
              Начать поиск
            </button>
          ) : (
            <div className="game-search-searching-v2">
              <div className="searching-text-v2">
                Подбираем противника по рейтингу и ставке...
                {queueStats && (
                  <div style={{ marginTop: '8px', fontSize: '0.9em', opacity: 0.8 }}>
                    Ищут игру: {mode === 'long' ? queueStats.longQueue : queueStats.shortQueue} | В игре: {queueStats.activeGames}
                  </div>
                )}
              </div>
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
