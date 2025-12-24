import { useState, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Leaderboard.css'

interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    username: string
    nickname?: string
    avatarUrl?: string
    level: number
    rating: number
    badge?: string
  }
  wins: number
  losses: number
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [mode, setMode] = useState<'short' | 'long'>('short')

  useEffect(() => {
    loadLeaderboard()
  }, [filter, mode])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/ratings/leaderboard?mode=${mode}&period=${filter}`).catch(() => ({ data: [] }))
      setLeaderboard(response.data || [])
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700' // Золото
    if (rank === 2) return '#C0C0C0' // Серебро
    if (rank === 3) return '#CD7F32' // Бронза
    return '#aaaaaa'
  }

  return (
    <PageLayout
      title="Лидерборд"
      showBack={true}
      tabs={[
        { id: 'all', label: 'Все', active: filter === 'all', onClick: () => setFilter('all') },
        { id: 'weekly', label: 'Неделя', active: filter === 'weekly', onClick: () => setFilter('weekly') },
        { id: 'monthly', label: 'Месяц', active: filter === 'monthly', onClick: () => setFilter('monthly') },
      ]}
    >
      <div className="leaderboard-content">
        {/* Режим */}
        <div className="leaderboard-mode-filters">
          <button
            className={`leaderboard-mode-btn ${mode === 'short' ? 'active' : ''}`}
            onClick={() => setMode('short')}
          >
            Короткие
          </button>
          <button
            className={`leaderboard-mode-btn ${mode === 'long' ? 'active' : ''}`}
            onClick={() => setMode('long')}
          >
            Длинные
          </button>
        </div>

        {/* Лидерборд */}
        {loading ? (
          <div className="leaderboard-empty">Загрузка...</div>
        ) : leaderboard.length === 0 ? (
          <div className="leaderboard-empty">Нет данных</div>
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((entry) => (
              <div
                key={entry.user.id}
                className="leaderboard-item"
                style={{ borderLeft: `4px solid ${getRankColor(entry.rank)}` }}
              >
                <div className="leaderboard-item-content">
                  {/* Ранг */}
                  <div
                    className="leaderboard-rank"
                    style={{
                      background: entry.rank <= 3 ? getRankColor(entry.rank) : '#3a3a3a',
                      color: entry.rank <= 3 ? '#000' : '#ffffff',
                    }}
                  >
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Аватар */}
                  <div className="leaderboard-avatar">
                    {entry.user.avatarUrl ? (
                      <img
                        src={entry.user.avatarUrl}
                        alt={entry.user.username}
                        className="leaderboard-avatar-img"
                      />
                    ) : (
                      <img src="/img/челувек.png" alt="User" className="leaderboard-avatar-placeholder" />
                    )}
                  </div>

                  {/* Информация */}
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">
                      {entry.user.nickname || entry.user.username}
                    </div>
                    <div className="leaderboard-details">
                      Уровень {entry.user.level} • Рейтинг: {entry.user.rating}
                      {entry.user.badge && (
                        <span style={{ marginLeft: '8px', color: '#ffd700', fontSize: '12px', fontWeight: 600 }}>
                          🏆 {entry.user.badge}
                        </span>
                      )}
                    </div>
                    <div className="leaderboard-stats">
                      Побед: {entry.wins} • Поражений: {entry.losses}
                    </div>
                  </div>

                  {/* Корона для топ-3 */}
                  {entry.rank <= 3 && (
                    <span className="leaderboard-crown">👑</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

