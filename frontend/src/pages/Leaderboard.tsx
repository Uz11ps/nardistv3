import { useState, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import PlayerName from '../components/PlayerName'
import { useAuthStore } from '../store/authStore'
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
    hasPremium?: boolean
  }
  wins: number
  losses: number
  draws?: number
  totalMatches?: number
  winRate?: number | null
  ratingChange?: number
}

interface MyStats {
  overallRating: number
  shortRating: number
  longRating: number
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  totalXP: number
}

export default function Leaderboard() {
  const { user } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myStats, setMyStats] = useState<MyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'xp' | 'matches' | 'winrate' | 'rating'>('xp')

  useEffect(() => {
    loadLeaderboard()
    loadMyStats()
  }, [sortBy])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/ratings/leaderboard?sortBy=${sortBy}`).catch(() => ({ data: [] }))
      setLeaderboard(response.data || [])
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyStats = async () => {
    try {
      const response = await apiClient.get('/ratings/my-stats').catch(() => ({ data: null }))
      setMyStats(response.data)
    } catch (error) {
      console.error('Failed to load my stats:', error)
    }
  }

  return (
    <PageLayout
      title="Лидерборд"
      showBack={true}
    >
      <div className="leaderboard-content">
        {/* Моя статистика */}
        {myStats && user && (
          <div className="leaderboard-my-stats">
            <div className="leaderboard-my-stats-header">Моя статистика</div>
            <div className="leaderboard-my-stats-content">
              <div className="leaderboard-my-stats-item">
                <div className="leaderboard-my-stats-label">Рейтинг</div>
                <div className="leaderboard-my-stats-value">{myStats.overallRating}</div>
              </div>
              <div className="leaderboard-my-stats-item">
                <div className="leaderboard-my-stats-label">Матчей</div>
                <div className="leaderboard-my-stats-value">{myStats.totalMatches}</div>
              </div>
              <div className="leaderboard-my-stats-item">
                <div className="leaderboard-my-stats-label">Винрейт</div>
                <div className="leaderboard-my-stats-value">{myStats.winRate}%</div>
              </div>
              <div className="leaderboard-my-stats-item">
                <div className="leaderboard-my-stats-label">XP</div>
                <div className="leaderboard-my-stats-value">{myStats.totalXP.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

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
          <button
            className={`leaderboard-mode-btn ${sortBy === 'rating' ? 'active' : ''}`}
            onClick={() => setSortBy('rating')}
          >
            Рейтинг
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
              >
                <div className="leaderboard-item-content">
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
                      <PlayerName 
                        nickname={entry.user.nickname}
                        username={entry.user.username}
                        hasPremium={entry.user.hasPremium}
                      />
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
                      {sortBy === 'rating' && (
                        <>Рейтинг: {entry.user.rating}</>
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

