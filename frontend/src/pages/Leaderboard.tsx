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
    xp?: number
    badge?: string
  }
  wins: number
  losses: number
  draws?: number
  totalMatches?: number
  winRate?: number | null
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [sortBy, setSortBy] = useState<'xp' | 'matches' | 'winrate'>('xp')

  useEffect(() => {
    loadLeaderboard()
  }, [filter, sortBy])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/ratings/leaderboard?period=${filter}&sortBy=${sortBy}`).catch(() => ({ data: [] }))
      setLeaderboard(response.data || [])
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
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
        {/* Фильтры по типу статистики */}
        <div className="leaderboard-mode-filters">
          <button
            className={`leaderboard-mode-btn ${sortBy === 'xp' ? 'active' : ''}`}
            onClick={() => setSortBy('xp')}
          >
            XP
          </button>
          <button
            className={`leaderboard-mode-btn ${sortBy === 'matches' ? 'active' : ''}`}
            onClick={() => setSortBy('matches')}
          >
            Матчи
          </button>
          <button
            className={`leaderboard-mode-btn ${sortBy === 'winrate' ? 'active' : ''}`}
            onClick={() => setSortBy('winrate')}
          >
            Винрейт
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
                      background: '#3a3a3a',
                      color: '#ffffff',
                    }}
                  >
                    #{entry.rank}
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
                    </div>
                    <div className="leaderboard-stats">
                      {sortBy === 'xp' && entry.user.xp !== undefined && (
                        <>XP: {entry.user.xp.toLocaleString()}</>
                      )}
                      {sortBy === 'matches' && (
                        <>Матчей: {entry.totalMatches || (entry.wins + entry.losses + (entry.draws || 0))}</>
                      )}
                      {sortBy === 'winrate' && (
                        <>Винрейт: {entry.winRate || 0}%</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

