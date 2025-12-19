import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'
import './History.css'

interface GameHistory {
  id: string
  mode: 'short' | 'long'
  type: 'vs_player' | 'vs_bot' | 'tournament'
  opponent: {
    id: string
    username: string
    avatarUrl?: string
  }
  result: 'win' | 'loss' | 'draw'
  score: { player1: number; player2: number }
  duration: number
  createdAt: string
  moves: any[]
}

export default function History() {
  const navigate = useNavigate()
  const [games, setGames] = useState<GameHistory[]>([])
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'bot'>('all')
  const [modeFilter, setModeFilter] = useState<'all' | 'short' | 'long'>('all')
  const [selectedGame, setSelectedGame] = useState<GameHistory | null>(null)
  const [replayStep, setReplayStep] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [filter, modeFilter])

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.append('result', filter)
      if (modeFilter !== 'all') params.append('mode', modeFilter)

      const response = await apiClient.get(`/history?${params.toString()}`)
      setGames(response.data || [])
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const handleReplay = (game: GameHistory) => {
    setSelectedGame(game)
    setReplayStep(0)
    setIsReplaying(true)
  }

  const handleReplayStep = (step: number) => {
    if (!selectedGame) return
    const maxStep = selectedGame.moves.length
    const newStep = Math.max(0, Math.min(maxStep, replayStep + step))
    setReplayStep(newStep)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Сегодня'
    if (days === 1) return 'Вчера'
    if (days < 7) return `${days} дней назад`
    return date.toLocaleDateString('ru-RU')
  }

  return (
    <div className="app-container">
      <PageHeader title="История игр" />
      
      <div style={{ padding: '20px' }}>
        {/* Фильтры */}
        <div className="history-filters">
          <div className="filter-group">
            <div className="filter-label">Результат:</div>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Все
              </button>
              <button
                className={`filter-btn ${filter === 'wins' ? 'active' : ''}`}
                onClick={() => setFilter('wins')}
              >
                Победы
              </button>
              <button
                className={`filter-btn ${filter === 'losses' ? 'active' : ''}`}
                onClick={() => setFilter('losses')}
              >
                Поражения
              </button>
              <button
                className={`filter-btn ${filter === 'bot' ? 'active' : ''}`}
                onClick={() => setFilter('bot')}
              >
                С ботом
              </button>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-label">Режим:</div>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${modeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setModeFilter('all')}
              >
                Все
              </button>
              <button
                className={`filter-btn ${modeFilter === 'short' ? 'active' : ''}`}
                onClick={() => setModeFilter('short')}
              >
                Короткие
              </button>
              <button
                className={`filter-btn ${modeFilter === 'long' ? 'active' : ''}`}
                onClick={() => setModeFilter('long')}
              >
                Длинные
              </button>
            </div>
          </div>
        </div>

        {/* Список игр */}
        <div className="games-list">
          {games.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
                Нет сыгранных игр
              </div>
            </Card>
          ) : (
            games.map((game) => (
              <Card key={game.id} className="game-history-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={`result-badge ${game.result}`}>
                    {game.result === 'win' ? '✓' : game.result === 'loss' ? '✗' : '='}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="card-title">
                        {game.type === 'vs_bot' ? '🤖 Бот' : game.opponent.username}
                      </span>
                      <span className="mode-badge">{game.mode === 'long' ? 'Длинные' : 'Короткие'}</span>
                    </div>
                    <div className="card-subtitle">
                      {formatDate(game.createdAt)} • {formatDuration(game.duration)}
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      Счет: {game.score.player1}:{game.score.player2}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => handleReplay(game)}>
                    Реплей
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Модальное окно реплея */}
      {selectedGame && isReplaying && (
        <div className="replay-overlay" onClick={() => setIsReplaying(false)}>
          <div className="replay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="replay-header">
              <h3>Реплей игры</h3>
              <button className="close-btn" onClick={() => setIsReplaying(false)}>×</button>
            </div>
            <div className="replay-info">
              <div>Ход {replayStep} из {selectedGame.moves.length}</div>
              <div>{selectedGame.mode === 'long' ? 'Длинные' : 'Короткие'} нарды</div>
            </div>
            <div className="replay-board">
              {/* Здесь будет компонент доски с текущим состоянием */}
              <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
                Доска реплея (требует интеграции с BackgammonBoard)
              </div>
            </div>
            <div className="replay-controls">
              <button
                className="replay-btn"
                onClick={() => setReplayStep(0)}
                disabled={replayStep === 0}
              >
                ⏮
              </button>
              <button
                className="replay-btn"
                onClick={() => handleReplayStep(-1)}
                disabled={replayStep === 0}
              >
                ⏪
              </button>
              <button
                className="replay-btn"
                onClick={() => handleReplayStep(1)}
                disabled={replayStep >= selectedGame.moves.length}
              >
                ⏩
              </button>
              <button
                className="replay-btn"
                onClick={() => setReplayStep(selectedGame.moves.length)}
                disabled={replayStep >= selectedGame.moves.length}
              >
                ⏭
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
