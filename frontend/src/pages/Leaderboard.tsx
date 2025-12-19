import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'

interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    username: string
    nickname?: string
    avatarUrl?: string
    level: number
    rating: number
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
      // TODO: заменить на реальный эндпоинт
      // const response = await apiClient.get(`/ratings/leaderboard?mode=${mode}&period=${filter}`)
      // setLeaderboard(response.data)
      
      // Заглушка
      setLeaderboard([
        { rank: 1, user: { id: '1', username: 'player1', level: 25, rating: 1850 }, wins: 150, losses: 30 },
        { rank: 2, user: { id: '2', username: 'player2', level: 22, rating: 1800 }, wins: 140, losses: 40 },
        { rank: 3, user: { id: '3', username: 'player3', level: 20, rating: 1750 }, wins: 130, losses: 50 },
      ])
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
    <div className="app-container">
      <PageHeader title="Лидерборд" />
      
      <div style={{ padding: '20px' }}>
        {/* Фильтры */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', color: '#aaaaaa', marginBottom: '8px' }}>Период:</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
                style={{
                  padding: '8px 16px',
                  background: filter === 'all' ? '#ff3333' : '#3a3a3a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Все время
              </button>
              <button
                className={`filter-btn ${filter === 'weekly' ? 'active' : ''}`}
                onClick={() => setFilter('weekly')}
                style={{
                  padding: '8px 16px',
                  background: filter === 'weekly' ? '#ff3333' : '#3a3a3a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Неделя
              </button>
              <button
                className={`filter-btn ${filter === 'monthly' ? 'active' : ''}`}
                onClick={() => setFilter('monthly')}
                style={{
                  padding: '8px 16px',
                  background: filter === 'monthly' ? '#ff3333' : '#3a3a3a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Месяц
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '14px', color: '#aaaaaa', marginBottom: '8px' }}>Режим:</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`filter-btn ${mode === 'short' ? 'active' : ''}`}
                onClick={() => setMode('short')}
                style={{
                  padding: '8px 16px',
                  background: mode === 'short' ? '#ff3333' : '#3a3a3a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Короткие
              </button>
              <button
                className={`filter-btn ${mode === 'long' ? 'active' : ''}`}
                onClick={() => setMode('long')}
                style={{
                  padding: '8px 16px',
                  background: mode === 'long' ? '#ff3333' : '#3a3a3a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Длинные
              </button>
            </div>
          </div>
        </div>

        {/* Лидерборд */}
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>Загрузка...</div>
          </Card>
        ) : leaderboard.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>Нет данных</div>
          </Card>
        ) : (
          <div>
            {leaderboard.map((entry) => (
              <Card
                key={entry.user.id}
                style={{
                  marginBottom: '12px',
                  borderLeft: `4px solid ${getRankColor(entry.rank)}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Ранг */}
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: entry.rank <= 3 ? getRankColor(entry.rank) : '#3a3a3a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: entry.rank <= 3 ? '24px' : '16px',
                      fontWeight: 600,
                      color: entry.rank <= 3 ? '#000' : '#ffffff',
                    }}
                  >
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Аватар */}
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#3a3a3a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {entry.user.avatarUrl ? (
                      <img
                        src={entry.user.avatarUrl}
                        alt={entry.user.username}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '24px' }}>👤</span>
                    )}
                  </div>

                  {/* Информация */}
                  <div style={{ flex: 1 }}>
                    <div className="card-title">
                      {entry.user.nickname || entry.user.username}
                    </div>
                    <div className="card-subtitle">
                      Уровень {entry.user.level} • Рейтинг: {entry.user.rating}
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      Побед: {entry.wins} • Поражений: {entry.losses}
                    </div>
                  </div>

                  {/* Корона для топ-3 */}
                  {entry.rank <= 3 && (
                    <span style={{ fontSize: '24px' }}>👑</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

