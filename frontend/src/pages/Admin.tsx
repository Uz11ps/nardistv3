import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import './Admin.css'

interface Stats {
  users: {
    total: number
    active: number
    banned: number
    admins: number
    levelDistribution: Array<{ level: number; count: string }>
  }
  games: {
    total: number
    finished: number
    inProgress: number
    totalMoves: number
    last7Days: Array<{ date: string; count: string }>
  }
  economy: {
    totalNarCoin: string
    totalXp: string
  }
}

export default function Admin() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'games' | 'notifications' | 'create-game' | 'tournaments' | 'academy' | 'city'>('stats')
  const [tournaments, setTournaments] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [cityRewards, setCityRewards] = useState<any>(null)
  
  // Формы создания
  const [newGame, setNewGame] = useState({ player1Id: '', player2Id: '', mode: 'short', type: 'vs_player' })
  const [newTournament, setNewTournament] = useState({ name: '', mode: 'short', format: 'bracket', startDate: '', maxParticipants: 16, entryFee: 0 })
  const [newArticle, setNewArticle] = useState({ title: '', content: '', type: 'article', isPaid: false, price: 0 })
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationUserId, setNotificationUserId] = useState('')
  const [sendToAll, setSendToAll] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      try {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
        await loadStats()
        setIsAuthenticated(true)
      } catch (error) {
        localStorage.removeItem('admin_token')
      }
    }
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiClient.post('/admin/login', { login, password })
      localStorage.setItem('admin_token', response.data.access_token)
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`
      setIsAuthenticated(true)
      await loadStats()
    } catch (error: any) {
      alert('Неверный логин или пароль')
    }
  }

  const loadStats = async () => {
    try {
      const [statsRes, usersRes, gamesRes, tournamentsRes, articlesRes, cityRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/users'),
        apiClient.get('/admin/games'),
        apiClient.get('/admin/tournaments').catch(() => ({ data: [] })),
        apiClient.get('/admin/academy').catch(() => ({ data: [] })),
        apiClient.get('/admin/city/rewards').catch(() => ({ data: null })),
      ])
      setStats(statsRes.data)
      setUsers(usersRes.data)
      setGames(gamesRes.data)
      setTournaments(tournamentsRes.data || [])
      setArticles(articlesRes.data || [])
      setCityRewards(cityRes.data)
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    }
  }

  const sendNotification = async () => {
    try {
      await apiClient.post('/admin/notifications', {
        message: notificationMessage,
        userId: sendToAll ? undefined : notificationUserId,
        all: sendToAll,
      })
      alert('Уведомление отправлено!')
      setNotificationMessage('')
      setNotificationUserId('')
    } catch (error: any) {
      alert('Ошибка отправки: ' + (error.response?.data?.message || error.message))
    }
  }

  if (loading) {
    return <div className="admin-loading">Загрузка...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <h1>Админ-панель</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Логин"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Войти</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Админ-панель Нарды</h1>
        <button onClick={() => {
          localStorage.removeItem('admin_token')
          setIsAuthenticated(false)
        }}>Выйти</button>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          Статистика
        </button>
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
        <button
          className={activeTab === 'games' ? 'active' : ''}
          onClick={() => setActiveTab('games')}
        >
          Игры
        </button>
        <button
          className={activeTab === 'notifications' ? 'active' : ''}
          onClick={() => setActiveTab('notifications')}
        >
          Уведомления
        </button>
        <button
          className={activeTab === 'create-game' ? 'active' : ''}
          onClick={() => setActiveTab('create-game')}
        >
          Создать игру
        </button>
        <button
          className={activeTab === 'tournaments' ? 'active' : ''}
          onClick={() => setActiveTab('tournaments')}
        >
          Турниры
        </button>
        <button
          className={activeTab === 'academy' ? 'active' : ''}
          onClick={() => setActiveTab('academy')}
        >
          Обучение
        </button>
        <button
          className={activeTab === 'city' ? 'active' : ''}
          onClick={() => setActiveTab('city')}
        >
          Город
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'stats' && stats && (
          <div className="admin-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Пользователи</h3>
                <div className="stat-value">{stats.users.total}</div>
                <div className="stat-details">
                  <div>Активных: {stats.users.active}</div>
                  <div>Забанено: {stats.users.banned}</div>
                  <div>Админов: {stats.users.admins}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Игры</h3>
                <div className="stat-value">{stats.games.total}</div>
                <div className="stat-details">
                  <div>Завершено: {stats.games.finished}</div>
                  <div>В процессе: {stats.games.inProgress}</div>
                  <div>Всего ходов: {stats.games.totalMoves}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Экономика</h3>
                <div className="stat-value">{Number(stats.economy.totalNarCoin).toLocaleString()} NAR</div>
                <div className="stat-details">
                  <div>Всего XP: {Number(stats.economy.totalXp).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="stats-chart">
              <h3>Распределение по уровням</h3>
              <div className="level-chart">
                {stats.users.levelDistribution.map((item) => (
                  <div key={item.level} className="level-bar">
                    <div className="level-label">Уровень {item.level}</div>
                    <div className="level-progress">
                      <div
                        className="level-fill"
                        style={{
                          width: `${(Number(item.count) / stats.users.total) * 100}%`,
                        }}
                      >
                        {item.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="stats-chart">
              <h3>Игры за последние 7 дней</h3>
              <div className="games-chart">
                {stats.games.last7Days.map((item) => (
                  <div key={item.date} className="games-bar">
                    <div className="games-date">{new Date(item.date).toLocaleDateString()}</div>
                    <div className="games-count">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-users">
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ник</th>
                    <th>Уровень</th>
                    <th>NAR</th>
                    <th>XP</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id.substring(0, 8)}...</td>
                      <td>{user.nickname || user.username}</td>
                      <td>{user.level}</td>
                      <td>{Number(user.narCoin).toLocaleString()}</td>
                      <td>{Number(user.xp).toLocaleString()}</td>
                      <td>
                        {user.isBanned ? (
                          <span className="badge banned">Забанен</span>
                        ) : (
                          <span className="badge active">Активен</span>
                        )}
                      </td>
                      <td>
                        {user.isBanned ? (
                          <button
                            onClick={() => {
                              apiClient.post(`/admin/users/${user.id}/unban`).then(() => loadStats())
                            }}
                          >
                            Разбанить
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const reason = prompt('Причина бана:')
                              if (reason) {
                                apiClient.post(`/admin/users/${user.id}/ban`, { reason }).then(() => loadStats())
                              }
                            }}
                          >
                            Забанить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div className="admin-games">
            <div className="games-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Режим</th>
                    <th>Статус</th>
                    <th>Игрок 1</th>
                    <th>Игрок 2</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.id}>
                      <td>{game.id.substring(0, 8)}...</td>
                      <td>{game.mode === 'short' ? 'Короткие' : 'Длинные'}</td>
                      <td>
                        {game.status === 'finished' && <span className="badge finished">Завершена</span>}
                        {game.status === 'in_progress' && <span className="badge in-progress">В процессе</span>}
                        {game.status === 'waiting' && <span className="badge waiting">Ожидание</span>}
                      </td>
                      <td>{game.player1?.nickname || game.player1?.username || 'N/A'}</td>
                      <td>{game.player2?.nickname || game.player2?.username || 'Бот'}</td>
                      <td>{new Date(game.createdAt).toLocaleString()}</td>
                      <td>
                        <button onClick={() => {
                          window.open(`/admin/games/${game.id}`, '_blank')
                        }}>Детали</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="admin-notifications">
            <div className="notification-form">
              <h3>Отправить уведомление</h3>
              <textarea
                placeholder="Текст сообщения"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                rows={5}
              />
              <div className="notification-options">
                <label>
                  <input
                    type="checkbox"
                    checked={sendToAll}
                    onChange={(e) => setSendToAll(e.target.checked)}
                  />
                  Отправить всем пользователям
                </label>
                {!sendToAll && (
                  <input
                    type="text"
                    placeholder="ID пользователя (опционально)"
                    value={notificationUserId}
                    onChange={(e) => setNotificationUserId(e.target.value)}
                  />
                )}
              </div>
              <button onClick={sendNotification}>Отправить</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

