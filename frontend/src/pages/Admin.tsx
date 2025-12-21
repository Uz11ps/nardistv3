import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient, { getImageUrl } from '../api/client'
import BackgammonBoard from '../components/BackgammonBoard'
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
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'games' | 'notifications' | 'create-game' | 'tournaments' | 'academy' | 'city' | 'skins' | 'quests' | 'clans'>('stats')
  const [tournaments, setTournaments] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [cityRewards, setCityRewards] = useState<any>(null)
  const [skins, setSkins] = useState<any[]>([])
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [gameReplay, setGameReplay] = useState<any>(null)
  const [replayStep, setReplayStep] = useState(0)
  const [quests, setQuests] = useState<any[]>([])
  const [clans, setClans] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedSkin, setSelectedSkin] = useState<any>(null)
  
  // Фильтры
  const [userFilters, setUserFilters] = useState({ search: '', status: '', level: '' })
  const [gameFilters, setGameFilters] = useState({ search: '', status: '', mode: '' })
  const [tournamentFilters, setTournamentFilters] = useState({ search: '', status: '' })
  const [questFilters, setQuestFilters] = useState({ search: '', type: '' })
  const [clanFilters, setClanFilters] = useState({ search: '', level: '' })
  
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
        // Токен уже будет добавлен через interceptor
        await loadStats()
        setIsAuthenticated(true)
      } catch (error) {
        localStorage.removeItem('admin_token')
        setIsAuthenticated(false)
      }
    } else {
      setIsAuthenticated(false)
    }
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiClient.post('/admin/login', { login, password })
      localStorage.setItem('admin_token', response.data.access_token)
      // Токен будет автоматически добавлен через interceptor
      setIsAuthenticated(true)
      await loadStats()
    } catch (error: any) {
      alert('Неверный логин или пароль')
    }
  }

  const loadStats = async () => {
    try {
      const [statsRes, usersRes, gamesRes, tournamentsRes, articlesRes, cityRes, skinsRes, questsRes, clansRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/users'),
        apiClient.get('/admin/games'),
        apiClient.get('/admin/tournaments').catch(() => ({ data: [] })),
        apiClient.get('/admin/academy').catch(() => ({ data: [] })),
        apiClient.get('/admin/city/rewards').catch(() => ({ data: null })),
        apiClient.get('/admin/skins').catch(() => ({ data: [] })),
        apiClient.get('/admin/quests').catch(() => ({ data: [] })),
        apiClient.get('/admin/clans').catch(() => ({ data: [] })),
      ])
      setStats(statsRes.data)
      setUsers(usersRes.data)
      setGames(gamesRes.data)
      setTournaments(tournamentsRes.data || [])
      setArticles(articlesRes.data || [])
      setCityRewards(cityRes.data)
      setSkins(skinsRes.data || [])
      setQuests(questsRes.data || [])
      setClans(clansRes.data || [])
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
        <button className="admin-logout-btn" onClick={() => {
          localStorage.removeItem('admin_token')
          setIsAuthenticated(false)
        }}>Выйти</button>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Статистика
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          Игры
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          Уведомления
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'create-game' ? 'active' : ''}`}
          onClick={() => setActiveTab('create-game')}
        >
          Создать игру
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setActiveTab('tournaments')}
        >
          Турниры
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'academy' ? 'active' : ''}`}
          onClick={() => setActiveTab('academy')}
        >
          Обучение
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'city' ? 'active' : ''}`}
          onClick={() => setActiveTab('city')}
        >
          Город
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'skins' ? 'active' : ''}`}
          onClick={() => setActiveTab('skins')}
        >
          Скины
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('quests')}
        >
          Квесты
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'clans' ? 'active' : ''}`}
          onClick={() => setActiveTab('clans')}
        >
          Кланы
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
            <div className="admin-filters">
              <input
                type="text"
                placeholder="Поиск по ID/Нику..."
                className="admin-filter-input"
                value={userFilters.search}
                onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value })}
              />
              <select
                className="admin-filter-select"
                value={userFilters.status}
                onChange={(e) => setUserFilters({ ...userFilters, status: e.target.value })}
              >
                <option value="">Все статусы</option>
                <option value="active">Активен</option>
                <option value="banned">Забанен</option>
              </select>
              <input
                type="number"
                placeholder="Уровень"
                className="admin-filter-input"
                value={userFilters.level}
                onChange={(e) => setUserFilters({ ...userFilters, level: e.target.value })}
              />
            </div>
            <div className="admin-table-container">
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
                  {users.filter((user) => {
                    if (userFilters.search && !user.id.toLowerCase().includes(userFilters.search.toLowerCase()) && !(user.nickname || user.username || '').toLowerCase().includes(userFilters.search.toLowerCase())) return false
                    if (userFilters.status === 'active' && user.isBanned) return false
                    if (userFilters.status === 'banned' && !user.isBanned) return false
                    if (userFilters.level && user.level !== parseInt(userFilters.level)) return false
                    return true
                  }).map((user) => (
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
                        <div className="btn-group">
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
                          {!user.isAdmin && (
                            <>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  if (confirm(`Вы уверены, что хотите удалить пользователя ${user.nickname || user.username}? Это действие необратимо!`)) {
                                    apiClient.delete(`/admin/users/${user.id}`).then(() => {
                                      alert('Пользователь удален')
                                      loadStats()
                                    }).catch((err) => {
                                      alert('Ошибка: ' + (err.response?.data?.message || err.message))
                                    })
                                  }
                                }}
                              >
                                Удалить
                              </button>
                              <button
                          className="btn btn-info btn-sm"
                          onClick={() => {
                                  setSelectedUser(user)
                                }}
                              >
                                Редактировать
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedUser && (
              <div className="edit-form">
                <h3>Редактирование пользователя: {selectedUser.nickname || selectedUser.username}</h3>
                <div className="form-group">
                  <label>NAR-coin:</label>
                  <input
                    type="number"
                    id="edit-narcoin"
                    defaultValue={Number(selectedUser.narCoin)}
                  />
                </div>
                <div className="form-group">
                  <label>XP:</label>
                  <input
                    type="number"
                    id="edit-xp"
                    defaultValue={Number(selectedUser.xp)}
                  />
                </div>
                <div className="form-group">
                  <label>Уровень:</label>
                  <input
                    type="number"
                    id="edit-level"
                    defaultValue={selectedUser.level}
                  />
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" id="edit-admin" defaultChecked={selectedUser.isAdmin} />
                    Администратор
                  </label>
                </div>
                <div className="edit-form-actions">
                    <button className="btn btn-primary"
                      onClick={async () => {
                        try {
                          const narCoin = parseInt((document.getElementById('edit-narcoin') as HTMLInputElement).value)
                          const xp = parseInt((document.getElementById('edit-xp') as HTMLInputElement).value)
                          await apiClient.put(`/admin/users/${selectedUser.id}/balance`, { narCoin, xp })
                          alert('Баланс обновлен')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                    >
                      Сохранить баланс
                    </button>
                    <button className="btn btn-primary"
                      onClick={async () => {
                        try {
                          const level = parseInt((document.getElementById('edit-level') as HTMLInputElement).value)
                          await apiClient.put(`/admin/users/${selectedUser.id}/level`, { level })
                          alert('Уровень обновлен')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                    >
                      Сохранить уровень
                    </button>
                    <button className="btn btn-primary"
                      onClick={async () => {
                        try {
                          const isAdmin = (document.getElementById('edit-admin') as HTMLInputElement).checked
                          await apiClient.put(`/admin/users/${selectedUser.id}/role`, { isAdmin, isTrainer: false })
                          alert('Роль обновлена')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                    >
                      Сохранить роль
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={async () => {
                        if (confirm('Сбросить весь прогресс пользователя? (XP, уровень, валюта)')) {
                          try {
                            await apiClient.post(`/admin/users/${selectedUser.id}/reset-progress`)
                            alert('Прогресс сброшен')
                            loadStats()
                            setSelectedUser(null)
                          } catch (err: any) {
                            alert('Ошибка: ' + (err.response?.data?.message || err.message))
                          }
                        }
                      }}
                    >
                      Сбросить прогресс
                    </button>
                  </div>
                  <div className="edit-form-section">
                    <h4>Премиум подписка</h4>
                    <div className="form-group">
                      <label>План подписки:</label>
                      <select 
                        id="subscription-plan"
                        onChange={(e) => {
                          const customGroup = document.getElementById('custom-months-group')
                          if (customGroup) {
                            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none'
                          }
                        }}
                      >
                        <option value="month_1">1 месяц</option>
                        <option value="month_3">3 месяца</option>
                        <option value="month_12">12 месяцев</option>
                        <option value="custom">Кастомный (указать месяцы)</option>
                      </select>
                    </div>
                    <div className="form-group" id="custom-months-group" style={{ display: 'none' }}>
                      <label>Количество месяцев:</label>
                      <input
                        type="number"
                        id="subscription-months"
                        min="1"
                        max="24"
                        defaultValue="1"
                      />
                    </div>
                    <button
                      className="btn btn-success"
                      onClick={async () => {
                        try {
                          const planSelect = document.getElementById('subscription-plan') as HTMLSelectElement
                          const plan = planSelect.value
                          const monthsInput = document.getElementById('subscription-months') as HTMLInputElement
                          const months = plan === 'custom' ? parseInt(monthsInput.value) : undefined
                          
                          if (plan === 'custom' && (!months || months < 1)) {
                            alert('Укажите количество месяцев (от 1 до 24)')
                            return
                          }
                          
                          await apiClient.post(`/admin/users/${selectedUser.id}/subscription`, {
                            plan: plan === 'custom' ? '1' : plan,
                            months: plan === 'custom' ? months : undefined,
                          })
                          alert('Премиум подписка выдана!')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                    >
                      Выдать премиум подписку
                    </button>
                    <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Отмена</button>
                  </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'games' && (
          <div className="admin-games">
            <div className="admin-filters">
              <input
                type="text"
                placeholder="Поиск по ID/Игроку..."
                className="admin-filter-input"
                value={gameFilters.search}
                onChange={(e) => setGameFilters({ ...gameFilters, search: e.target.value })}
              />
              <select
                className="admin-filter-select"
                value={gameFilters.status}
                onChange={(e) => setGameFilters({ ...gameFilters, status: e.target.value })}
              >
                <option value="">Все статусы</option>
                <option value="waiting">Ожидание</option>
                <option value="in_progress">В процессе</option>
                <option value="finished">Завершена</option>
              </select>
              <select
                className="admin-filter-select"
                value={gameFilters.mode}
                onChange={(e) => setGameFilters({ ...gameFilters, mode: e.target.value })}
              >
                <option value="">Все режимы</option>
                <option value="short">Короткие</option>
                <option value="long">Длинные</option>
              </select>
            </div>
            <div className="admin-table-container">
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
                  {games.filter((game) => {
                    if (gameFilters.search && !game.id.toLowerCase().includes(gameFilters.search.toLowerCase()) && !(game.player1?.nickname || game.player1?.username || '').toLowerCase().includes(gameFilters.search.toLowerCase()) && !(game.player2?.nickname || game.player2?.username || '').toLowerCase().includes(gameFilters.search.toLowerCase())) return false
                    if (gameFilters.status && game.status !== gameFilters.status) return false
                    if (gameFilters.mode && game.mode !== gameFilters.mode) return false
                    return true
                  }).map((game) => (
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
                        <div className="btn-group">
                          <button onClick={async () => {
                            try {
                              // Загружаем полные данные реплея
                              const replayResponse = await apiClient.get(`/history/replay/${game.id}`)
                              setSelectedGame(game)
                              setGameReplay(replayResponse.data)
                              setReplayStep(0)
                            } catch (error: any) {
                              alert('Ошибка загрузки реплея: ' + (error.response?.data?.message || error.message))
                            }
                          }}>Просмотр</button>
                        </div>
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

        {activeTab === 'create-game' && (
          <div className="admin-create-game">
            <div className="create-form">
              <h3>Создать игру</h3>
              <div className="form-group">
                <label>ID игрока 1 (обязательно)</label>
                <input
                  type="text"
                  value={newGame.player1Id}
                  onChange={(e) => setNewGame({ ...newGame, player1Id: e.target.value })}
                  placeholder="UUID игрока"
                />
              </div>
              <div className="form-group">
                <label>ID игрока 2 (опционально, если пусто - игра с ботом)</label>
                <input
                  type="text"
                  value={newGame.player2Id}
                  onChange={(e) => setNewGame({ ...newGame, player2Id: e.target.value })}
                  placeholder="UUID игрока или оставить пустым"
                />
              </div>
              <div className="form-group">
                <label>Режим</label>
                <select
                  value={newGame.mode}
                  onChange={(e) => setNewGame({ ...newGame, mode: e.target.value })}
                >
                  <option value="short">Короткие нарды</option>
                  <option value="long">Длинные нарды</option>
                </select>
              </div>
              <div className="form-group">
                <label>Тип игры</label>
                <select
                  value={newGame.type}
                  onChange={(e) => setNewGame({ ...newGame, type: e.target.value })}
                >
                  <option value="vs_player">Игрок vs Игрок</option>
                  <option value="vs_bot">Игрок vs Бот</option>
                  <option value="tournament">Турнир</option>
                </select>
              </div>
              <button onClick={async () => {
                try {
                  const res = await apiClient.post('/admin/games/create', newGame)
                  alert(`Игра создана! ID: ${res.data.id}`)
                  setNewGame({ player1Id: '', player2Id: '', mode: 'short', type: 'vs_player' })
                  loadStats()
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Создать игру</button>
            </div>
          </div>
        )}

        {activeTab === 'tournaments' && (
          <div className="admin-tournaments">
            <div className="create-form">
              <h3>Создать турнир</h3>
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text"
                  value={newTournament.name}
                  onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                  placeholder="Название турнира"
                />
              </div>
              <div className="form-group">
                <label>Режим</label>
                <select
                  value={newTournament.mode}
                  onChange={(e) => setNewTournament({ ...newTournament, mode: e.target.value })}
                >
                  <option value="short">Короткие нарды</option>
                  <option value="long">Длинные нарды</option>
                </select>
              </div>
              <div className="form-group">
                <label>Формат</label>
                <select
                  value={newTournament.format}
                  onChange={(e) => setNewTournament({ ...newTournament, format: e.target.value })}
                >
                  <option value="bracket">Олимпийская система</option>
                  <option value="round_robin">Круговой</option>
                </select>
              </div>
              <div className="form-group">
                <label>Дата начала</label>
                <input
                  type="datetime-local"
                  value={newTournament.startDate}
                  onChange={(e) => setNewTournament({ ...newTournament, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Максимум участников</label>
                <input
                  type="number"
                  value={newTournament.maxParticipants}
                  onChange={(e) => setNewTournament({ ...newTournament, maxParticipants: parseInt(e.target.value) })}
                  min="2"
                />
              </div>
              <div className="form-group">
                <label>Взнос (NAR)</label>
                <input
                  type="number"
                  value={newTournament.entryFee}
                  onChange={(e) => setNewTournament({ ...newTournament, entryFee: parseInt(e.target.value) })}
                  min="0"
                />
              </div>
              <button onClick={async () => {
                try {
                  await apiClient.post('/admin/tournaments/create', {
                    ...newTournament,
                    startDate: newTournament.startDate ? new Date(newTournament.startDate).toISOString() : new Date().toISOString(),
                    status: 'registration',
                  })
                  alert('Турнир создан!')
                  setNewTournament({ name: '', mode: 'short', format: 'bracket', startDate: '', maxParticipants: 16, entryFee: 0 })
                  loadStats()
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Создать турнир</button>
            </div>

            <div className="tournaments-list">
              <h3>Существующие турниры</h3>
              <div className="admin-filters">
                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  className="admin-filter-input"
                  value={tournamentFilters.search}
                  onChange={(e) => setTournamentFilters({ ...tournamentFilters, search: e.target.value })}
                />
                <select
                  className="admin-filter-select"
                  value={tournamentFilters.status}
                  onChange={(e) => setTournamentFilters({ ...tournamentFilters, status: e.target.value })}
                >
                  <option value="">Все статусы</option>
                  <option value="UPCOMING">Предстоящий</option>
                  <option value="REGISTRATION">Регистрация</option>
                  <option value="IN_PROGRESS">В процессе</option>
                  <option value="FINISHED">Завершен</option>
                </select>
              </div>
              <div className="admin-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Режим</th>
                      <th>Формат</th>
                      <th>Статус</th>
                      <th>Участников</th>
                      <th>Дата начала</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournaments.filter((t) => {
                      if (tournamentFilters.search && !t.name.toLowerCase().includes(tournamentFilters.search.toLowerCase())) return false
                      if (tournamentFilters.status && t.status !== tournamentFilters.status) return false
                      return true
                    }).map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.mode === 'short' ? 'Короткие' : 'Длинные'}</td>
                      <td>{t.format === 'bracket' ? 'Олимпийская' : 'Круговой'}</td>
                      <td><span className="badge">{t.status}</span></td>
                      <td>{t.currentParticipants || 0} / {t.maxParticipants}</td>
                      <td>{new Date(t.startDate).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {activeTab === 'academy' && (
          <div className="admin-academy">
            <div className="create-form">
              <h3>Создать материал</h3>
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text"
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  placeholder="Название статьи/урока"
                />
              </div>
              <div className="form-group">
                <label>Тип</label>
                <select
                  value={newArticle.type}
                  onChange={(e) => setNewArticle({ ...newArticle, type: e.target.value })}
                >
                  <option value="article">Статья</option>
                  <option value="course">Курс</option>
                  <option value="video">Видео</option>
                </select>
              </div>
              <div className="form-group">
                <label>Содержание</label>
                <textarea
                  value={newArticle.content}
                  onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                  rows={10}
                  placeholder="Текст материала..."
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newArticle.isPaid}
                    onChange={(e) => setNewArticle({ ...newArticle, isPaid: e.target.checked })}
                  />
                  Платный материал
                </label>
              </div>
              {newArticle.isPaid && (
                <div className="form-group">
                  <label>Цена (NAR)</label>
                  <input
                    type="number"
                    value={newArticle.price}
                    onChange={(e) => setNewArticle({ ...newArticle, price: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>
              )}
              <button onClick={async () => {
                try {
                  await apiClient.post('/admin/academy/create', {
                    ...newArticle,
                    authorId: 'admin',
                  })
                  alert('Материал создан!')
                  setNewArticle({ title: '', content: '', type: 'article', isPaid: false, price: 0 })
                  loadStats()
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Создать материал</button>
            </div>

            <div className="articles-list">
              <h3>Существующие материалы</h3>
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Платный</th>
                    <th>Цена</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{a.type}</td>
                      <td>{a.isPaid ? 'Да' : 'Нет'}</td>
                      <td>{a.price || 0} NAR</td>
                      <td>
                        <button onClick={() => {
                          if (confirm('Удалить материал?')) {
                            apiClient.delete(`/admin/academy/${a.id}`).then(() => loadStats())
                          }
                        }}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'skins' && (
          <div className="admin-skins">
            <h3>Управление скинами</h3>
            <div className="admin-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Тема</th>
                    <th>Редкость</th>
                    <th>Цена</th>
                    <th>Вес</th>
                    <th>Премиум</th>
                    <th>По умолчанию</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {skins.map((skin) => (
                    <tr key={skin.id}>
                      <td>{skin.name}</td>
                      <td>
                        <span className={`badge ${skin.type === 'board' ? 'primary' : skin.type === 'dice' ? 'info' : 'warning'}`}>
                          {skin.type === 'board' ? 'Доска' : skin.type === 'dice' ? 'Кубики' : skin.type === 'checkers' ? 'Шашки' : skin.type || 'Неизвестно'}
                        </span>
                      </td>
                      <td>{skin.theme}</td>
                      <td>
                        <span className={`badge ${skin.rarity || 'common'}`}>
                          {skin.rarity === 'common' ? 'Обычный' : 
                           skin.rarity === 'rare' ? 'Редкий' : 
                           skin.rarity === 'epic' ? 'Эпический' : 
                           skin.rarity === 'legendary' ? 'Легендарный' : skin.rarity || 'Обычный'}
                        </span>
                      </td>
                      <td>{skin.price ? `${skin.price} NAR` : 'Бесплатно'}</td>
                      <td>{skin.weight || 1}</td>
                      <td>{skin.isPremium ? 'Да' : 'Нет'}</td>
                      <td>{skin.isDefault ? 'Да' : 'Нет'}</td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSkin(skin)}>Редактировать</button>
                          <button className="btn btn-danger btn-sm" onClick={() => {
                            if (confirm('Удалить скин?')) {
                              apiClient.delete(`/admin/skins/${skin.id}`).then(() => {
                                alert('Скин удален')
                                loadStats()
                              }).catch((err) => {
                                alert('Ошибка: ' + (err.response?.data?.message || err.message))
                              })
                            }
                          }}>Удалить</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedSkin ? (
              <div className="admin-form">
                <h4>Редактировать скин: {selectedSkin.name}</h4>
                <div className="form-group">
                  <label>Тип скина:</label>
                  <select 
                    id="edit-skin-type" 
                    defaultValue={selectedSkin.type}
                    disabled
                  >
                    <option value="board">Доска (Board)</option>
                    <option value="dice">Кубики (Dice)</option>
                    <option value="checkers">Шашки (Checkers)</option>
                  </select>
                  <span className="field-hint">Тип скина нельзя изменить</span>
                </div>
                <div className="form-group">
                  <label>Название:</label>
                  <input 
                    type="text" 
                    placeholder="Название скина" 
                    id="edit-skin-name" 
                    defaultValue={selectedSkin.name}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Тема (описание):</label>
                  <input 
                    type="text" 
                    placeholder="Тема или описание" 
                    id="edit-skin-theme" 
                    defaultValue={selectedSkin.theme}
                  />
                </div>
                <div className="form-group">
                  <label>Цена (NAR):</label>
                  <input 
                    type="number" 
                    placeholder="0 для бесплатного" 
                    id="edit-skin-price" 
                    min="0" 
                    defaultValue={selectedSkin.price || 0}
                  />
                </div>
                <div className="form-group">
                  <label>
                    Вес <span className="field-hint">(вероятность выпадения в случайной выборке, чем больше число - тем чаще выпадает)</span>:
                  </label>
                  <input 
                    type="number" 
                    placeholder="1" 
                    id="edit-skin-weight" 
                    min="1" 
                    defaultValue={selectedSkin.weight || 1}
                  />
                </div>
                <div className="form-group">
                  <label>Редкость:</label>
                  <select id="edit-skin-rarity" defaultValue={selectedSkin.rarity || 'common'}>
                    <option value="common">Обычный</option>
                    <option value="rare">Редкий</option>
                    <option value="epic">Эпический</option>
                    <option value="legendary">Легендарный</option>
                  </select>
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      id="edit-skin-premium" 
                      defaultChecked={selectedSkin.isPremium}
                    /> Премиум
                  </label>
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      id="edit-skin-default" 
                      defaultChecked={selectedSkin.isDefault}
                    /> По умолчанию
                  </label>
                </div>
                <div className="form-group">
                  <label>Изображение:</label>
                  {selectedSkin.imageUrl && (
                    <div style={{ marginBottom: '8px' }}>
                      <img 
                        src={getImageUrl(selectedSkin.imageUrl)} 
                        alt={selectedSkin.name}
                        style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <input type="file" accept="image/*" id="edit-skin-image" />
                  <span className="field-hint">Оставьте пустым, чтобы не изменять изображение</span>
                </div>
                <div className="btn-group">
                  <button className="btn btn-primary" onClick={async () => {
                    try {
                      const updateData: any = {
                        name: (document.getElementById('edit-skin-name') as HTMLInputElement).value,
                        theme: (document.getElementById('edit-skin-theme') as HTMLInputElement).value || selectedSkin.type,
                        price: parseInt((document.getElementById('edit-skin-price') as HTMLInputElement).value) || 0,
                        weight: parseInt((document.getElementById('edit-skin-weight') as HTMLInputElement).value) || 1,
                        rarity: (document.getElementById('edit-skin-rarity') as HTMLSelectElement).value,
                        isPremium: (document.getElementById('edit-skin-premium') as HTMLInputElement).checked,
                        isDefault: (document.getElementById('edit-skin-default') as HTMLInputElement).checked,
                      }
                      
                      await apiClient.put(`/admin/skins/${selectedSkin.id}`, updateData)
                      
                      // Если есть новое изображение, загружаем его
                      const fileInput = document.getElementById('edit-skin-image') as HTMLInputElement
                      if (fileInput.files && fileInput.files[0]) {
                        const imageFormData = new FormData()
                        imageFormData.append('image', fileInput.files[0])
                        await apiClient.post(`/admin/skins/${selectedSkin.id}/upload-image`, imageFormData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        })
                      }
                      
                      alert('Скин обновлен!')
                      setSelectedSkin(null)
                      loadStats()
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}>Сохранить изменения</button>
                  <button className="btn btn-secondary" onClick={() => setSelectedSkin(null)}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="admin-form">
                <h4>Создать новый скин</h4>
              <div className="form-group">
                <label>Тип скина:</label>
                <select id="skin-type" required>
                  <option value="">-- Выберите тип --</option>
                  <option value="board">Доска (Board)</option>
                  <option value="dice">Кубики (Dice)</option>
                  <option value="checkers">Шашки (Checkers)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Название:</label>
                <input type="text" placeholder="Название скина" id="skin-name" required />
              </div>
              <div className="form-group">
                <label>Тема (описание):</label>
                <input type="text" placeholder="Тема или описание" id="skin-theme" />
              </div>
              <div className="form-group">
                <label>Цена (NAR):</label>
                <input type="number" placeholder="0 для бесплатного" id="skin-price" min="0" />
              </div>
              <div className="form-group">
                <label>
                  Вес <span className="field-hint">(вероятность выпадения в случайной выборке, чем больше число - тем чаще выпадает)</span>:
                </label>
                <input type="number" placeholder="1" id="skin-weight" min="1" defaultValue="1" />
              </div>
              <div className="form-group">
                <label>Редкость:</label>
                <select id="skin-rarity">
                  <option value="common">Обычный</option>
                  <option value="rare">Редкий</option>
                  <option value="epic">Эпический</option>
                  <option value="legendary">Легендарный</option>
                </select>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" id="skin-premium" /> Премиум
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" id="skin-default" /> По умолчанию
                </label>
              </div>
              <div className="form-group">
                <label>Изображение:</label>
                <input type="file" accept="image/*" id="skin-image" />
              </div>
              <button className="btn btn-primary" onClick={async () => {
                const skinType = (document.getElementById('skin-type') as HTMLSelectElement).value
                if (!skinType) {
                  alert('Выберите тип скина!')
                  return
                }

                const formData = new FormData()
                formData.append('type', skinType)
                formData.append('name', (document.getElementById('skin-name') as HTMLInputElement).value)
                formData.append('theme', (document.getElementById('skin-theme') as HTMLInputElement).value || skinType)
                
                const priceValue = (document.getElementById('skin-price') as HTMLInputElement).value
                if (priceValue) {
                  formData.append('price', priceValue)
                }
                
                formData.append('weight', (document.getElementById('skin-weight') as HTMLInputElement).value || '1')
                formData.append('rarity', (document.getElementById('skin-rarity') as HTMLSelectElement).value)
                formData.append('isPremium', (document.getElementById('skin-premium') as HTMLInputElement).checked.toString())
                formData.append('isDefault', (document.getElementById('skin-default') as HTMLInputElement).checked.toString())
                
                // Добавляем пустые конфиги в зависимости от типа
                if (skinType === 'board') {
                  formData.append('boardConfig', JSON.stringify({}))
                } else if (skinType === 'dice') {
                  formData.append('diceConfig', JSON.stringify({}))
                } else if (skinType === 'checkers') {
                  formData.append('checkersConfig', JSON.stringify({}))
                }
                
                const fileInput = document.getElementById('skin-image') as HTMLInputElement
                if (fileInput.files && fileInput.files[0]) {
                  formData.append('image', fileInput.files[0])
                }

                try {
                  await apiClient.post('/admin/skins', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  })
                  alert('Скин создан!')
                  loadStats()
                  // Очистить форму
                  ;(document.getElementById('skin-type') as HTMLSelectElement).value = ''
                  ;(document.getElementById('skin-name') as HTMLInputElement).value = ''
                  ;(document.getElementById('skin-theme') as HTMLInputElement).value = ''
                  ;(document.getElementById('skin-price') as HTMLInputElement).value = ''
                  ;(document.getElementById('skin-weight') as HTMLInputElement).value = '1'
                  ;(document.getElementById('skin-premium') as HTMLInputElement).checked = false
                  ;(document.getElementById('skin-default') as HTMLInputElement).checked = false
                  fileInput.value = ''
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Создать скин</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quests' && (
          <div className="admin-quests">
            <h3>Управление квестами</h3>
            <div className="admin-filters">
              <input
                type="text"
                placeholder="Поиск по названию..."
                className="admin-filter-input"
                value={questFilters.search}
                onChange={(e) => setQuestFilters({ ...questFilters, search: e.target.value })}
              />
              <select
                className="admin-filter-select"
                value={questFilters.type}
                onChange={(e) => setQuestFilters({ ...questFilters, type: e.target.value })}
              >
                <option value="">Все типы</option>
                <option value="daily">Ежедневный</option>
                <option value="weekly">Еженедельный</option>
                <option value="special">Особый</option>
              </select>
            </div>
            <div className="admin-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Цель</th>
                    <th>Целевое значение</th>
                    <th>Награда NAR</th>
                    <th>Награда XP</th>
                    <th>Премиум</th>
                    <th>Период</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {quests.filter((quest) => {
                    if (questFilters.search && !quest.name.toLowerCase().includes(questFilters.search.toLowerCase())) return false
                    if (questFilters.type && quest.type !== questFilters.type) return false
                    return true
                  }).map((quest) => (
                    <tr key={quest.id}>
                      <td>{quest.name}</td>
                      <td>
                        {quest.type === 'daily' ? 'Ежедневный' : 
                         quest.type === 'weekly' ? 'Еженедельный' : 
                         quest.type === 'special' ? 'Особый' : quest.type}
                      </td>
                      <td>{quest.target}</td>
                      <td>{quest.targetValue}</td>
                      <td>{Number(quest.rewardNarCoin || 0).toLocaleString()}</td>
                      <td>{quest.rewardXP || 0}</td>
                      <td>{quest.isPremium ? 'Да' : 'Нет'}</td>
                      <td>
                        {new Date(quest.startDate).toLocaleDateString()} - {new Date(quest.endDate).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (confirm('Удалить квест?')) {
                              apiClient.delete(`/admin/quests/${quest.id}`).then(() => {
                                alert('Квест удален')
                                loadStats()
                              }).catch((err) => {
                                alert('Ошибка: ' + (err.response?.data?.message || err.message))
                              })
                            }
                          }}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-form">
              <h4>Создать новый квест</h4>
              <div className="admin-form admin-form-nested">
                <div className="form-group">
                  <label>Название:</label>
                  <input type="text" placeholder="Название" id="quest-name" />
                </div>
                <div className="form-group">
                  <label>Описание:</label>
                  <textarea placeholder="Описание" id="quest-description" rows={3}></textarea>
                </div>
                <div className="form-group">
                  <label>Тип:</label>
                  <select id="quest-type">
                    <option value="daily">Ежедневный</option>
                    <option value="weekly">Еженедельный</option>
                    <option value="special">Особый</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Цель:</label>
                  <select id="quest-target">
                    <option value="play_matches">Играть матчи</option>
                    <option value="win_streak">Серия побед</option>
                    <option value="collect_income">Собрать доход</option>
                    <option value="tournament">Турнир</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Целевое значение:</label>
                  <input type="number" placeholder="Целевое значение" id="quest-target-value" />
                </div>
                <div className="form-group">
                  <label>Награда NAR-coin:</label>
                  <input type="number" placeholder="Награда NAR-coin" id="quest-reward-nar" />
                </div>
                <div className="form-group">
                  <label>Награда XP:</label>
                  <input type="number" placeholder="Награда XP" id="quest-reward-xp" />
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" id="quest-premium" /> Премиум квест
                  </label>
                </div>
                <div className="form-group">
                  <label>Дата начала:</label>
                  <input type="datetime-local" id="quest-start-date" />
                </div>
                <div className="form-group">
                  <label>Дата окончания:</label>
                  <input type="datetime-local" id="quest-end-date" />
                </div>
                <button onClick={async () => {
                  try {
                    await apiClient.post('/admin/quests', {
                      name: (document.getElementById('quest-name') as HTMLInputElement).value,
                      description: (document.getElementById('quest-description') as HTMLTextAreaElement).value,
                      type: (document.getElementById('quest-type') as HTMLSelectElement).value,
                      target: (document.getElementById('quest-target') as HTMLSelectElement).value,
                      targetValue: parseInt((document.getElementById('quest-target-value') as HTMLInputElement).value),
                      rewardNarCoin: parseInt((document.getElementById('quest-reward-nar') as HTMLInputElement).value || '0'),
                      rewardXP: parseInt((document.getElementById('quest-reward-xp') as HTMLInputElement).value || '0'),
                      isPremium: (document.getElementById('quest-premium') as HTMLInputElement).checked,
                      startDate: (document.getElementById('quest-start-date') as HTMLInputElement).value,
                      endDate: (document.getElementById('quest-end-date') as HTMLInputElement).value,
                    })
                    alert('Квест создан!')
                    loadStats()
                  } catch (error: any) {
                    alert('Ошибка: ' + (error.response?.data?.message || error.message))
                  }
                }}>Создать квест</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clans' && (
          <div className="admin-clans">
            <h3>Управление кланами</h3>
            <div className="admin-filters">
              <input
                type="text"
                placeholder="Поиск по названию..."
                className="admin-filter-input"
                value={clanFilters.search}
                onChange={(e) => setClanFilters({ ...clanFilters, search: e.target.value })}
              />
              <input
                type="number"
                placeholder="Уровень"
                className="admin-filter-input"
                value={clanFilters.level}
                onChange={(e) => setClanFilters({ ...clanFilters, level: e.target.value })}
              />
            </div>
            <div className="admin-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Лидер</th>
                    <th>Уровень</th>
                    <th>Участников</th>
                    <th>Казна</th>
                    <th>Доход/неделю</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {clans.filter((clan) => {
                    if (clanFilters.search && !clan.name.toLowerCase().includes(clanFilters.search.toLowerCase())) return false
                    if (clanFilters.level && clan.level !== parseInt(clanFilters.level)) return false
                    return true
                  }).map((clan) => (
                    <tr key={clan.id}>
                      <td>{clan.name}</td>
                      <td>{clan.leaderId?.substring(0, 8) || 'N/A'}...</td>
                      <td>{clan.level || 1}</td>
                      <td>{clan.memberCount || 0}/{clan.maxMembers || 10}</td>
                      <td>{Number(clan.treasury || 0).toLocaleString()}</td>
                      <td>{Number(clan.weeklyIncome || 0).toLocaleString()}</td>
                      <td>
                        <div className="btn-group">
                          <button
                            onClick={() => {
                              setSelectedUser({ type: 'clan', ...clan })
                            }}
                          >
                            Редактировать
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`Удалить клан "${clan.name}"? Это удалит клан и всех его участников!`)) {
                                apiClient.delete(`/admin/clans/${clan.id}`).then(() => {
                                  alert('Клан удален')
                                  loadStats()
                                }).catch((err) => {
                                  alert('Ошибка: ' + (err.response?.data?.message || err.message))
                                })
                              }
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedUser && selectedUser.type === 'clan' && (
              <div className="edit-form">
                <h3>Редактирование клана: {selectedUser.name}</h3>
                <div className="form-group">
                  <label>Уровень:</label>
                  <input
                    type="number"
                    id="edit-clan-level"
                    defaultValue={selectedUser.level || 1}
                  />
                </div>
                <div className="form-group">
                  <label>Макс участников:</label>
                  <input
                    type="number"
                    id="edit-clan-max-members"
                    defaultValue={selectedUser.maxMembers || 10}
                  />
                </div>
                <div className="form-group">
                  <label>Казна:</label>
                  <input
                    type="number"
                    id="edit-clan-treasury"
                    defaultValue={Number(selectedUser.treasury || 0)}
                  />
                </div>
                <div className="form-group">
                  <label>Доход/неделю:</label>
                  <input
                    type="number"
                    id="edit-clan-income"
                    defaultValue={Number(selectedUser.weeklyIncome || 0)}
                  />
                </div>
                <div className="form-group">
                  <label>Описание:</label>
                  <textarea
                    id="edit-clan-description"
                    defaultValue={selectedUser.description || ''}
                    rows={3}
                  ></textarea>
                </div>
                <div className="edit-form-actions">
                    <button className="btn btn-primary"
                      onClick={async () => {
                        try {
                          await apiClient.put(`/admin/clans/${selectedUser.id}`, {
                            level: parseInt((document.getElementById('edit-clan-level') as HTMLInputElement).value),
                            maxMembers: parseInt((document.getElementById('edit-clan-max-members') as HTMLInputElement).value),
                            treasury: parseInt((document.getElementById('edit-clan-treasury') as HTMLInputElement).value),
                            weeklyIncome: parseInt((document.getElementById('edit-clan-income') as HTMLInputElement).value),
                            description: (document.getElementById('edit-clan-description') as HTMLTextAreaElement).value,
                          })
                          alert('Клан обновлен')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                    >
                      Сохранить
                    </button>
                    <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Отмена</button>
                  </div>
                  {selectedUser.members && selectedUser.members.length > 0 && (
                    <div className="mt-3">
                      <h4>Участники клана:</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>ID пользователя</th>
                            <th>Роль</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.members.map((member: any) => (
                            <tr key={member.id}>
                              <td>{member.userId?.substring(0, 8)}...</td>
                              <td>{member.role}</td>
                              <td>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => {
                                    if (confirm('Удалить участника из клана?')) {
                                      apiClient.delete(`/admin/clans/${selectedUser.id}/members/${member.userId}`).then(() => {
                                        alert('Участник удален')
                                        loadStats()
                                        setSelectedUser(null)
                                      }).catch((err) => {
                                        alert('Ошибка: ' + (err.response?.data?.message || err.message))
                                      })
                                    }
                                  }}
                                >
                                  Удалить
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'city' && cityRewards && (
          <div className="admin-city">
            <h3>Настройка наград города</h3>
            <div className="city-rewards">
              {cityRewards.districts?.map((district: any) => (
                <div key={district.id} className="district-card">
                  <h4>{district.name}</h4>
                  <div className="form-group">
                    <label>Доход в час (NAR)</label>
                    <input
                      type="number"
                      value={district.incomePerHour}
                      onChange={(e) => {
                        const updated = {
                          ...cityRewards,
                          districts: cityRewards.districts.map((d: any) =>
                            d.id === district.id
                              ? { ...d, incomePerHour: parseInt(e.target.value) }
                              : d
                          ),
                        }
                        setCityRewards(updated)
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Максимальное накопление (NAR)</label>
                    <input
                      type="number"
                      value={district.maxAccumulation}
                      onChange={(e) => {
                        const updated = {
                          ...cityRewards,
                          districts: cityRewards.districts.map((d: any) =>
                            d.id === district.id
                              ? { ...d, maxAccumulation: parseInt(e.target.value) }
                              : d
                          ),
                        }
                        setCityRewards(updated)
                      }}
                    />
                  </div>
                </div>
              ))}
              <button onClick={async () => {
                try {
                  await apiClient.put('/admin/city/rewards', cityRewards)
                  alert('Настройки сохранены!')
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Сохранить изменения</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

