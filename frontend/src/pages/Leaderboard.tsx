import { useState, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import PlayerName from '../components/PlayerName'
import PlayerProfileModal from '../components/PlayerProfileModal'
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
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)

  useEffect(() => {
    loadLeaderboard()
    loadMyStats()
  }, [sortBy])

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/ratings/leaderboard?mode=short&sortBy=${sortBy}&limit=100`).catch(() => ({ data: [] }))
      const data = response.data || []
      console.log('Leaderboard data received:', data.length, 'entries')
      setLeaderboard(data)
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

  // Находим место пользователя в лидерборде
  const myRank = user ? leaderboard.findIndex(entry => entry.user.id === user.id) + 1 : null
  const myRankClass = myRank === 1 ? 'rank-1' : myRank === 2 ? 'rank-2' : myRank === 3 ? 'rank-3' : ''

  return (
    <PageLayout
      title="Лидерборд"
      showBack={true}
    >
      <div className="leaderboard-content">
        {/* Моя статистика */}
        {myStats && user && (
          <div className={`leaderboard-my-stats ${myRankClass}`}>
            <div className="leaderboard-my-stats-header">
              Моя статистика
              {myRank !== null && myRank > 0 && (
                <span style={{ marginLeft: '8px', color: '#B6B6B6', fontSize: '14px', fontWeight: '400' }}>
                  Место: {myRank}
                </span>
              )}
            </div>
            <div className="leaderboard-my-stats-content">
              {sortBy === 'rating' && (
                <div className="leaderboard-my-stats-item">
                  <div className="leaderboard-my-stats-label">Рейтинг</div>
                  <div className="leaderboard-my-stats-value">{myStats.overallRating}</div>
                </div>
              )}
              {sortBy === 'matches' && (
                <div className="leaderboard-my-stats-item">
                  <div className="leaderboard-my-stats-label">Матчей</div>
                  <div className="leaderboard-my-stats-value">{myStats.totalMatches}</div>
                </div>
              )}
              {sortBy === 'winrate' && (
                <div className="leaderboard-my-stats-item">
                  <div className="leaderboard-my-stats-label">Винрейт</div>
                  <div className="leaderboard-my-stats-value">{myStats.winRate}%</div>
                </div>
              )}
              {sortBy === 'xp' && (
                <div className="leaderboard-my-stats-item">
                  <div className="leaderboard-my-stats-label">XP</div>
                  <div className="leaderboard-my-stats-value">{myStats.totalXP.toLocaleString()}</div>
                </div>
              )}
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
            {leaderboard.map((entry, index) => {
              const rank = index + 1
              const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''
              return (
              <div
                key={entry.user.id}
                className={`leaderboard-item ${rankClass}`}
                onClick={() => {
                  setSelectedPlayer(entry.user)
                  setShowPlayerModal(true)
                }}
                style={{ cursor: 'pointer' }}
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
                    {(sortBy === 'xp' || sortBy === 'rating') && (
                      <div className="leaderboard-details">
                        {sortBy === 'rating' && `Рейтинг: ${entry.user.rating}`}
                        {sortBy === 'xp' && `Уровень ${entry.user.level}`}
                      </div>
                    )}
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
            )})}
          </div>
        )}
      </div>
      <PlayerProfileModal
        isOpen={showPlayerModal}
        player={selectedPlayer}
        onClose={() => {
          setShowPlayerModal(false)
          setSelectedPlayer(null)
        }}
      />
    </PageLayout>
  )
}

