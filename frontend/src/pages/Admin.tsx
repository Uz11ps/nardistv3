import { useEffect, useState, useRef } from 'react'
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
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'games' | 'notifications' | 'create-game' | 'tournaments' | 'academy' | 'city' | 'skins' | 'quests' | 'clans' | 'policy'>('stats')
  const [tournaments, setTournaments] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [selectedArticle, setSelectedArticle] = useState<any>(null)
  const [cityRewards, setCityRewards] = useState<any>(null)
  const [buildings, setBuildings] = useState<any[]>([])
  const [policies, setPolicies] = useState<{ privacy?: string; agreement?: string }>({})
  const [notificationTemplates, setNotificationTemplates] = useState<any[]>([])
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [editingPolicy, setEditingPolicy] = useState<'privacy' | 'agreement' | null>(null)
  const [policyContent, setPolicyContent] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null)
  const [newBuilding, setNewBuilding] = useState({
    type: '',
    name: '',
    icon: '',
    image: '',
    basePrice: 0,
    baseIncomePerHour: 0,
    maxAccumulation: 0,
    maxLevel: 10,
  })
  const [skins, setSkins] = useState<any[]>([])
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [gameReplay, setGameReplay] = useState<any>(null)
  const [replayStep, setReplayStep] = useState(0)
  
  // Функция для загрузки состояния на конкретном шаге
  const loadReplayStep = async (step: number) => {
    if (!selectedGame) return
    try {
      const response = await apiClient.get(`/history/replay/${selectedGame.id}?step=${step}`)
      if (response.data) {
        setGameReplay(response.data)
      }
    } catch (error) {
      console.error('Failed to load replay step:', error)
    }
  }
  const [quests, setQuests] = useState<any[]>([])
  const [clans, setClans] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedSkin, setSelectedSkin] = useState<any>(null)
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  
  // Фильтры
  const [userFilters, setUserFilters] = useState({ search: '', status: '', level: '' })
  const [gameFilters, setGameFilters] = useState({ search: '', status: '', mode: '' })
  const [tournamentFilters, setTournamentFilters] = useState({ search: '', status: '' })
  const [questFilters, setQuestFilters] = useState({ search: '', type: '' })
  const [clanFilters, setClanFilters] = useState({ search: '', level: '' })
  
  // Формы создания
  const [newGame, setNewGame] = useState({ player1Id: '', player2Id: '', mode: 'short', type: 'vs_player' })
  const [newTournament, setNewTournament] = useState({ 
    name: '', 
    mode: 'short', 
    format: 'bracket', 
    startDate: '', 
    registrationStart: '',
    registrationEnd: '',
    maxParticipants: 16, 
    entryFee: 0 
  })
  const [newArticle, setNewArticle] = useState({ title: '', content: '', type: 'course', isPaid: false, price: 0 })
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationUserId, setNotificationUserId] = useState('')
  const [sendToAll, setSendToAll] = useState(false)
  const [notificationImage, setNotificationImage] = useState<File | null>(null)
  const notificationImageInputRef = useRef<HTMLInputElement>(null)

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
      const [statsRes, usersRes, gamesRes, tournamentsRes, articlesRes, cityRes, skinsRes, questsRes, clansRes, buildingsRes, policiesRes, templatesRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/users'),
        apiClient.get('/admin/games'),
        apiClient.get('/admin/tournaments').catch(() => ({ data: [] })),
        apiClient.get('/admin/academy').catch(() => ({ data: [] })),
        apiClient.get('/admin/city/rewards').catch(() => ({ data: null })),
        apiClient.get('/admin/skins').catch(() => ({ data: [] })),
        apiClient.get('/admin/quests').catch(() => ({ data: [] })),
        apiClient.get('/admin/clans').catch(() => ({ data: [] })),
        apiClient.get('/admin/buildings').catch(() => ({ data: [] })),
        apiClient.get('/policy/admin/all').catch(() => ({ data: [] })),
        apiClient.get('/admin/notification-templates').catch(() => ({ data: [] })),
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
      setBuildings(buildingsRes.data || [])
      setNotificationTemplates(templatesRes.data || [])
      
      // Загружаем политики
      const policiesData: { privacy?: string; agreement?: string } = {}
      if (policiesRes.data && Array.isArray(policiesRes.data)) {
        policiesRes.data.forEach((p: any) => {
          if (p.type === 'privacy') policiesData.privacy = p.content
          if (p.type === 'agreement') policiesData.agreement = p.content
        })
      }
      setPolicies(policiesData)
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    }
  }

  const loadPolicies = async () => {
    try {
      const response = await apiClient.get('/policy/admin/all').catch(() => ({ data: [] }))
      const policiesData: { privacy?: string; agreement?: string } = {}
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((p: any) => {
          if (p.type === 'privacy') policiesData.privacy = p.content
          if (p.type === 'agreement') policiesData.agreement = p.content
        })
      }
      setPolicies(policiesData)
    } catch (error) {
      console.error('Failed to load policies:', error)
    }
  }

  const handleEditPolicy = (type: 'privacy' | 'agreement') => {
    setEditingPolicy(type)
    setPolicyContent(policies[type] || '')
  }

  const handleSavePolicy = async () => {
    if (!editingPolicy) return
    try {
      await apiClient.post('/policy', {
        type: editingPolicy,
        content: policyContent
      })
      alert('Политика сохранена')
      setEditingPolicy(null)
      setPolicyContent('')
      loadPolicies()
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const loadCityRewards = async () => {
    try {
      const response = await apiClient.get('/admin/city/rewards')
      setCityRewards(response.data)
    } catch (error) {
      console.error('Failed to load city rewards:', error)
    }
  }

  const loadBuildings = async () => {
    try {
      const response = await apiClient.get('/admin/buildings')
      setBuildings(response.data || [])
    } catch (error) {
      console.error('Failed to load buildings:', error)
    }
  }

  const handleCreateBuilding = async () => {
    try {
      await apiClient.post('/admin/buildings', newBuilding)
      alert('Строение создано!')
      setNewBuilding({
        type: '',
        name: '',
        icon: '',
        image: '',
        basePrice: 0,
        baseIncomePerHour: 0,
        maxAccumulation: 0,
        maxLevel: 10,
      })
      loadBuildings()
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpdateBuilding = async (id: string, data: any) => {
    try {
      await apiClient.put(`/admin/buildings/${id}`, data)
      alert('Строение обновлено!')
      loadBuildings()
      setSelectedBuilding(null)
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleDeleteBuilding = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить это строение?')) {
      return
    }
    try {
      await apiClient.delete(`/admin/buildings/${id}`)
      alert('Строение удалено!')
      loadBuildings()
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const sendNotification = async () => {
    try {
      const formData = new FormData()
      formData.append('message', notificationMessage)
      if (!sendToAll && notificationUserId) {
        formData.append('userId', notificationUserId)
      }
      formData.append('all', sendToAll.toString())
      if (notificationImage) {
        formData.append('image', notificationImage)
      }

      await apiClient.post('/admin/notifications', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      alert('Уведомление отправлено!')
      setNotificationMessage('')
      setNotificationUserId('')
      setNotificationImage(null)
      if (notificationImageInputRef.current) {
        notificationImageInputRef.current.value = ''
      }
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
          Федерации
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'policy' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('policy')
            loadPolicies()
          }}
        >
          Политика
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
              <div 
                className="admin-modal-overlay" 
                onClick={() => setSelectedUser(null)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '20px',
                }}
              >
                <div 
                  className="edit-form admin-modal"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '600px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: '#FFF' }}>Редактирование пользователя: {selectedUser.nickname || selectedUser.username}</h3>
                    <button
                      onClick={() => setSelectedUser(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#FFF',
                        fontSize: '32px',
                        cursor: 'pointer',
                        padding: 0,
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
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
                  </div>
                  <div className="edit-form-section">
                    <h4>Настройки реферальной программы</h4>
                    <div className="form-group">
                      <label>Процент от доната реферала (%):</label>
                      <input
                        type="number"
                        id="edit-referral-percent"
                        min="0"
                        max="100"
                        defaultValue={selectedUser.referralPercent || 5}
                        style={{ width: '100%', padding: '8px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Базовый бонус (NAR):</label>
                      <input
                        type="number"
                        id="edit-referral-base-bonus"
                        min="0"
                        defaultValue={Number(selectedUser.referralBaseBonus || 100)}
                        style={{ width: '100%', padding: '8px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #3a3a3a' }}>
                    <button 
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 600 }}
                      onClick={async () => {
                        try {
                          // Собираем все данные из формы
                          const narCoin = parseInt((document.getElementById('edit-narcoin') as HTMLInputElement).value)
                          const xp = parseInt((document.getElementById('edit-xp') as HTMLInputElement).value)
                          const level = parseInt((document.getElementById('edit-level') as HTMLInputElement).value)
                          const isAdmin = (document.getElementById('edit-admin') as HTMLInputElement).checked
                          
                          const referralPercentEl = document.getElementById('edit-referral-percent') as HTMLInputElement
                          const referralBaseBonusEl = document.getElementById('edit-referral-base-bonus') as HTMLInputElement
                          const referralPercent = referralPercentEl ? parseInt(referralPercentEl.value || '5') : 5
                          const referralBaseBonus = referralBaseBonusEl ? parseInt(referralBaseBonusEl.value || '100') : 100

                          // Выполняем все запросы последовательно
                          await apiClient.put(`/admin/users/${selectedUser.id}/balance`, { narCoin, xp })
                          await apiClient.put(`/admin/users/${selectedUser.id}/level`, { level })
                          await apiClient.put(`/admin/users/${selectedUser.id}/role`, { isAdmin, isTrainer: false })
                          await apiClient.put(`/admin/users/${selectedUser.id}/referral-settings`, { referralPercent, referralBaseBonus })

                          alert('Все изменения сохранены')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                    >
                      Сохранить
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedUser(null)}
                      style={{ width: '100%', padding: '12px', fontSize: '16px', marginTop: '12px' }}
                    >
                      Отмена
                    </button>
                  </div>
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
              <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>
                  Изображение (опционально):
                </label>
                <input
                  ref={notificationImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    setNotificationImage(file || null)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#1a1a1a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                {notificationImage && (
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#aaa' }}>
                    Выбрано: {notificationImage.name}
                  </div>
                )}
              </div>
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
            
            <div className="notification-management" style={{ marginTop: '32px' }}>
              <h3>Управление уведомлениями</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    if (confirm('Удалить все уведомления? Это действие необратимо!')) {
                      try {
                        await apiClient.delete('/admin/notifications/all')
                        alert('Все уведомления удалены')
                      } catch (error: any) {
                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                      }
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#e74c3c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Удалить все уведомления
                </button>
                {notificationUserId && (
                  <button
                    onClick={async () => {
                      if (confirm(`Удалить все уведомления пользователя ${notificationUserId}?`)) {
                        try {
                          await apiClient.delete(`/admin/notifications/user/${notificationUserId}`)
                          alert('Уведомления пользователя удалены')
                        } catch (error: any) {
                          alert('Ошибка: ' + (error.response?.data?.message || error.message))
                        }
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#e67e22',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Удалить уведомления пользователя
                  </button>
                )}
              </div>
            </div>

            {/* Управление шаблонами уведомлений Telegram */}
            <div className="notification-templates" style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid #3a3a3a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Шаблоны уведомлений Telegram</h3>
                <button
                  onClick={() => {
                    const newType = prompt('Введите тип шаблона (например: inactive_user, birthday, tournament_start):')
                    if (newType) {
                      setEditingTemplate({
                        type: newType,
                        title: '',
                        message: '',
                        isActive: true,
                        description: '',
                      })
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  + Добавить шаблон
                </button>
              </div>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
                Редактируйте шаблоны автоматических уведомлений. Используйте переменные: {'{username}'}, {'{level}'}, {'{days}'}
              </p>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                {notificationTemplates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      background: '#2a2a2a',
                      padding: '20px',
                      borderRadius: '8px',
                      border: editingTemplate?.id === template.id ? '2px solid #4a90e2' : '1px solid #3a3a3a',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: '#fff' }}>{template.title || template.type}</h4>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                          Тип: {template.type} | Порог: {template.daysThreshold ? `${template.daysThreshold} дней` : 'N/A'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          background: template.isActive ? '#4a90e2' : '#666',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fff',
                        }}>
                          {template.isActive ? 'Активен' : 'Неактивен'}
                        </span>
                        <button
                          onClick={() => setEditingTemplate(template)}
                          style={{
                            padding: '6px 12px',
                            background: '#4a90e2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Удалить шаблон "${template.type}"?`)) {
                              try {
                                await apiClient.delete(`/admin/notification-templates/${template.type}`)
                                alert('Шаблон удален')
                                loadStats()
                              } catch (error: any) {
                                alert('Ошибка: ' + (error.response?.data?.message || error.message))
                              }
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                    <div style={{ color: '#ccc', fontSize: '14px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Заголовок:</strong> {template.title}
                      </div>
                      <div>
                        <strong>Сообщение:</strong> {template.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {editingTemplate && (
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => setEditingTemplate(null)}
                >
                  <div
                    style={{
                      background: '#1a1a1a',
                      padding: '24px',
                      borderRadius: '12px',
                      width: '90%',
                      maxWidth: '600px',
                      border: '1px solid #3a3a3a',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ marginTop: 0, color: '#fff' }}>Редактировать шаблон</h3>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Заголовок:</label>
                      <input
                        type="text"
                        value={editingTemplate.title}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: '#2a2a2a',
                          border: '1px solid #3a3a3a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>
                        Сообщение (используйте {'{username}'}, {'{level}'}, {'{days}'}):
                      </label>
                      <textarea
                        value={editingTemplate.message}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, message: e.target.value })}
                        rows={6}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: '#2a2a2a',
                          border: '1px solid #3a3a3a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc' }}>
                        <input
                          type="checkbox"
                          checked={editingTemplate.isActive}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                        />
                        Активен
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setEditingTemplate(null)}
                        style={{
                          padding: '10px 20px',
                          background: '#3a3a3a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            if (editingTemplate.id) {
                              // Обновление существующего шаблона
                              await apiClient.put(`/admin/notification-templates/${editingTemplate.type}`, {
                                title: editingTemplate.title,
                                message: editingTemplate.message,
                                isActive: editingTemplate.isActive,
                              })
                              alert('Шаблон успешно обновлен!')
                            } else {
                              // Создание нового шаблона
                              await apiClient.post('/admin/notification-templates', {
                                type: editingTemplate.type,
                                title: editingTemplate.title,
                                message: editingTemplate.message,
                                isActive: editingTemplate.isActive,
                                description: editingTemplate.description || '',
                              })
                              alert('Шаблон успешно создан!')
                            }
                            setEditingTemplate(null)
                            const response = await apiClient.get('/admin/notification-templates')
                            setNotificationTemplates(response.data || [])
                          } catch (error: any) {
                            alert('Ошибка: ' + (error.response?.data?.message || error.message))
                          }
                        }}
                        style={{
                          padding: '10px 20px',
                          background: '#4a90e2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                <label>Дата начала регистрации</label>
                <input
                  type="datetime-local"
                  value={newTournament.registrationStart}
                  onChange={(e) => setNewTournament({ ...newTournament, registrationStart: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Дата окончания регистрации</label>
                <input
                  type="datetime-local"
                  value={newTournament.registrationEnd}
                  onChange={(e) => setNewTournament({ ...newTournament, registrationEnd: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Дата начала турнира</label>
                <input
                  type="datetime-local"
                  value={newTournament.startDate}
                  onChange={(e) => setNewTournament({ ...newTournament, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Максимум участников</label>
                <input
                  type="number"
                  value={newTournament.maxParticipants}
                  onChange={(e) => setNewTournament({ ...newTournament, maxParticipants: parseInt(e.target.value) })}
                  min="2"
                  required
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
                  if (!newTournament.registrationStart || !newTournament.registrationEnd || !newTournament.startDate) {
                    alert('Заполните все даты!')
                    return
                  }
                  
                  await apiClient.post('/admin/tournaments/create', {
                    ...newTournament,
                    registrationStart: new Date(newTournament.registrationStart).toISOString(),
                    registrationEnd: new Date(newTournament.registrationEnd).toISOString(),
                    startDate: new Date(newTournament.startDate).toISOString(),
                    status: 'registration',
                  })
                  alert('Турнир создан!')
                  setNewTournament({ 
                    name: '', 
                    mode: 'short', 
                    format: 'bracket', 
                    startDate: '', 
                    registrationStart: '',
                    registrationEnd: '',
                    maxParticipants: 16, 
                    entryFee: 0 
                  })
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
                  <option value="upcoming">Предстоящий</option>
                  <option value="registration">Регистрация</option>
                  <option value="in_progress">В процессе</option>
                  <option value="finished">Завершен</option>
                  <option value="cancelled">Отменен</option>
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
                      <th>Взнос</th>
                      <th>Призовой фонд</th>
                      <th>Начало регистрации</th>
                      <th>Окончание регистрации</th>
                      <th>Дата начала</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournaments.filter((t) => {
                      if (tournamentFilters.search && !t.name.toLowerCase().includes(tournamentFilters.search.toLowerCase())) return false
                      if (tournamentFilters.status && t.status !== tournamentFilters.status) return false
                      return true
                    }).map((t) => {
                      const entryFee = typeof t.entryFee === 'string' ? Number(t.entryFee) : (t.entryFee || 0)
                      const prizePool = entryFee * (t.currentParticipants || 0)
                      return (
                        <tr key={t.id}>
                          <td>{t.name}</td>
                          <td>{t.mode === 'short' ? 'Короткие' : 'Длинные'}</td>
                          <td>{t.format === 'bracket' ? 'Олимпийская' : 'Круговой'}</td>
                          <td><span className="badge">{t.status}</span></td>
                          <td>{t.currentParticipants || 0} / {t.maxParticipants}</td>
                          <td>{entryFee} NAR</td>
                          <td>{prizePool.toLocaleString()} NAR</td>
                          <td>{t.registrationStart ? new Date(t.registrationStart).toLocaleString() : '-'}</td>
                          <td>{t.registrationEnd ? new Date(t.registrationEnd).toLocaleString() : '-'}</td>
                          <td>{t.startDate ? new Date(t.startDate).toLocaleString() : '-'}</td>
                          <td>
                            <button onClick={() => setSelectedTournament(t)} style={{ marginRight: '8px' }}>Редактировать</button>
                            <button onClick={async () => {
                              if (confirm('Удалить турнир?')) {
                                try {
                                  await apiClient.delete(`/admin/tournaments/${t.id}`)
                                  alert('Турнир удален')
                                  loadStats()
                                } catch (error: any) {
                                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                                }
                              }
                            }}>Удалить</button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            
            {selectedTournament && (
              <div className="admin-modal-overlay" onClick={() => setSelectedTournament(null)}>
                <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                  <h4>Редактировать турнир: {selectedTournament.name}</h4>
                  <div className="form-group">
                    <label>Название</label>
                    <input
                      type="text"
                      value={selectedTournament.name}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Режим</label>
                    <select
                      value={selectedTournament.mode}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, mode: e.target.value })}
                    >
                      <option value="short">Короткие нарды</option>
                      <option value="long">Длинные нарды</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Формат</label>
                    <select
                      value={selectedTournament.format}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, format: e.target.value })}
                    >
                      <option value="bracket">Олимпийская система</option>
                      <option value="round_robin">Круговой</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Статус</label>
                    <select
                      value={selectedTournament.status}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, status: e.target.value })}
                    >
                      <option value="upcoming">Предстоящий</option>
                      <option value="registration">Регистрация</option>
                      <option value="in_progress">В процессе</option>
                      <option value="finished">Завершен</option>
                      <option value="cancelled">Отменен</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Макс. участников</label>
                    <input
                      type="number"
                      value={selectedTournament.maxParticipants}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, maxParticipants: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Взнос (NAR)</label>
                    <input
                      type="number"
                      value={typeof selectedTournament.entryFee === 'string' ? Number(selectedTournament.entryFee) : (selectedTournament.entryFee || 0)}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, entryFee: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Начало регистрации</label>
                    <input
                      type="datetime-local"
                      value={selectedTournament.registrationStart ? new Date(selectedTournament.registrationStart).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, registrationStart: new Date(e.target.value).toISOString() })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Окончание регистрации</label>
                    <input
                      type="datetime-local"
                      value={selectedTournament.registrationEnd ? new Date(selectedTournament.registrationEnd).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, registrationEnd: new Date(e.target.value).toISOString() })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Дата начала</label>
                    <input
                      type="datetime-local"
                      value={selectedTournament.startDate ? new Date(selectedTournament.startDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setSelectedTournament({ ...selectedTournament, startDate: new Date(e.target.value).toISOString() })}
                    />
                  </div>
                  <button onClick={async () => {
                    try {
                      await apiClient.put(`/admin/tournaments/${selectedTournament.id}`, selectedTournament)
                      alert('Турнир обновлен')
                      setSelectedTournament(null)
                      loadStats()
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}>Сохранить</button>
                  <button onClick={() => setSelectedTournament(null)}>Отмена</button>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {activeTab === 'academy' && (
          <div className="admin-academy">
            <div className="create-form">
              <h3>Создать курс</h3>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
                Курсы создаются только администраторами. Для курсов можно добавить тестовые задания.
                <br />
                <strong>Статьи создаются игроками</strong> и проходят верификацию в разделе ниже.
              </p>
              <div className="form-group">
                <label>Название курса</label>
                <input
                  type="text"
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  placeholder="Название курса"
                />
              </div>
              <div className="form-group">
                <label>Тип</label>
                <select
                  value={newArticle.type}
                  onChange={(e) => setNewArticle({ ...newArticle, type: e.target.value })}
                >
                  <option value="course">Курс (только для админов)</option>
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
                    type: 'course', // Курсы создаются только админами
                    authorId: null, // null означает, что это курс от админа
                    isVerified: true, // Курсы от админов сразу верифицированы
                  })
                  alert('Курс создан!')
                  setNewArticle({ title: '', content: '', type: 'course', isPaid: false, price: 0 })
                  // Перезагружаем данные
                  const response = await apiClient.get('/admin/academy')
                  setArticles(response.data || [])
                  loadStats()
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Создать курс</button>
            </div>

            <div className="articles-list">
              <h3>Все материалы</h3>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
                <strong>Курсы</strong> - создаются администраторами, сразу опубликованы. <strong>Статьи</strong> - создаются игроками, требуют верификации.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Автор</th>
                    <th>Платный</th>
                    <th>Цена</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{a.type === 'course' ? 'Курс' : a.type === 'article' ? 'Статья' : a.type}</td>
                      <td>{a.author || 'Администратор'}</td>
                      <td>{a.isPaid ? 'Да' : 'Нет'}</td>
                      <td>{Number(a.price || 0).toLocaleString()} NAR</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: a.type === 'course' 
                            ? '#2196F3' // Курсы от админов - синий
                            : a.isVerified 
                              ? '#4CAF50' // Статьи верифицированные - зеленый
                              : '#FF9800', // Статьи на проверке - оранжевый
                          color: '#FFF',
                        }}>
                          {a.type === 'course' 
                            ? '📚 Курс (от админа)' 
                            : a.isVerified 
                              ? '✓ Статья верифицирована' 
                              : '⏳ Статья на проверке'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => setSelectedArticle(a)}
                            style={{
                              padding: '4px 8px',
                              background: '#4a90e2',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Просмотр
                          </button>
                          {a.type === 'article' && a.authorId && !a.isVerified && (
                            <button 
                              onClick={async () => {
                                try {
                                  await apiClient.post(`/admin/courses/${a.id}/verify`)
                                  alert('Статья верифицирована!')
                                  loadStats()
                                } catch (error: any) {
                                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                                }
                              }}
                              style={{
                                padding: '4px 8px',
                                background: '#4CAF50',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Верифицировать статью
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              if (confirm('Удалить материал?')) {
                                apiClient.delete(`/admin/academy/${a.id}`).then(() => loadStats())
                              }
                            }}
                            style={{
                              padding: '4px 8px',
                              background: '#f44336',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
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

            {/* Модальное окно просмотра материала */}
            {selectedArticle && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '20px',
                }}
                onClick={() => setSelectedArticle(null)}
              >
                <div
                  style={{
                    background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '800px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    animation: 'fadeIn 0.3s ease-out',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#FFF', fontSize: '24px' }}>{selectedArticle.title}</h2>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#FFF',
                        fontSize: '32px',
                        cursor: 'pointer',
                        padding: 0,
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#3a3a3a',
                      color: '#FFF',
                    }}>
                      Тип: {selectedArticle.type === 'course' ? 'Курс' : selectedArticle.type === 'article' ? 'Статья' : selectedArticle.type}
                    </span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#3a3a3a',
                      color: '#FFF',
                    }}>
                      Автор: {selectedArticle.author || 'Администратор'}
                    </span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: selectedArticle.type === 'course' 
                        ? '#2196F3' 
                        : selectedArticle.isVerified 
                          ? '#4CAF50' 
                          : '#FF9800',
                      color: '#FFF',
                    }}>
                      {selectedArticle.type === 'course' 
                        ? '📚 Курс (от админа)' 
                        : selectedArticle.isVerified 
                          ? '✓ Статья верифицирована' 
                          : '⏳ Статья на проверке'}
                    </span>
                    {selectedArticle.isPaid && (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: '#FFD700',
                        color: '#000',
                      }}>
                        Цена: {Number(selectedArticle.price || 0).toLocaleString()} NAR
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ color: '#FFF', fontSize: '18px', marginBottom: '12px' }}>Содержание:</h3>
                    <div
                      style={{
                        background: '#2a2a2a',
                        padding: '16px',
                        borderRadius: '8px',
                        color: '#B6B6B6',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid #3a3a3a',
                      }}
                    >
                      {selectedArticle.content || 'Содержание отсутствует'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    {selectedArticle.type === 'article' && selectedArticle.authorId && !selectedArticle.isVerified && (
                      <button
                        onClick={async () => {
                          try {
                            await apiClient.post(`/admin/courses/${selectedArticle.id}/verify`)
                            alert('Статья верифицирована!')
                            setSelectedArticle(null)
                            loadStats()
                          } catch (error: any) {
                            alert('Ошибка: ' + (error.response?.data?.message || error.message))
                          }
                        }}
                        style={{
                          padding: '10px 20px',
                          background: 'linear-gradient(180deg, #4CAF50 -144.23%, #2E7D32 105.77%)',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          transition: 'transform 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        Верифицировать статью
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedArticle(null)}
                      style={{
                        padding: '10px 20px',
                        background: '#3a3a3a',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#4a4a4a'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#3a3a3a'}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                  <label>Превью (для инвентаря):</label>
                  {selectedSkin.imageUrl && (
                    <div style={{ marginBottom: '8px' }}>
                      <img 
                        src={getImageUrl(selectedSkin.imageUrl) || selectedSkin.imageUrl} 
                        alt={selectedSkin.name}
                        style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="edit-skin-image"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const preview = document.getElementById('edit-skin-image-preview')
                          if (preview) {
                            preview.innerHTML = `<img src="${event.target?.result}" alt="Превью" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                          }
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  <div id="edit-skin-image-preview" style={{ marginTop: '8px' }}></div>
                  <span className="field-hint">Превью для отображения в инвентаре</span>
                </div>
                <div className="form-group">
                  <label>Изображение для магазина:</label>
                  {selectedSkin.shopImageUrl && (
                    <div style={{ marginBottom: '8px' }}>
                      <img 
                        src={getImageUrl(selectedSkin.shopImageUrl) || selectedSkin.shopImageUrl} 
                        alt="Изображение для магазина"
                        style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="edit-skin-shop-image"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const preview = document.getElementById('edit-skin-shop-image-preview')
                          if (preview) {
                            preview.innerHTML = `<img src="${event.target?.result}" alt="Изображение для магазина" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                          }
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  <div id="edit-skin-shop-image-preview" style={{ marginTop: '8px' }}></div>
                  <span className="field-hint">Отдельное изображение для отображения в магазине</span>
                </div>
                {selectedSkin.type === 'board' && (
                  <div className="form-group">
                    <label>Текстура доски (файл для игры):</label>
                    {selectedSkin.boardTextureUrl && (
                      <div style={{ marginBottom: '8px' }}>
                        <img 
                          src={getImageUrl(selectedSkin.boardTextureUrl) || selectedSkin.boardTextureUrl} 
                          alt="Board texture"
                          style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="edit-skin-board-texture"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const preview = document.getElementById('edit-skin-board-texture-preview')
                            if (preview) {
                              preview.innerHTML = `<img src="${event.target?.result}" alt="Текстура доски" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                            }
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                    <div id="edit-skin-board-texture-preview" style={{ marginTop: '8px' }}></div>
                    <span className="field-hint">Оставьте пустым, чтобы не изменять текстуру</span>
                  </div>
                )}
                {selectedSkin.type === 'dice' && (
                  <div className="form-group">
                    <label>Текстуры кубиков (6 файлов для игры - от 1 до 6):</label>
                    {selectedSkin.diceTextureUrls && typeof selectedSkin.diceTextureUrls === 'object' && (
                      <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          selectedSkin.diceTextureUrls?.[num] ? (
                            <div key={num} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '12px', marginBottom: '4px', color: '#aaa' }}>Кубик {num}</div>
                              <img 
                                src={getImageUrl(selectedSkin.diceTextureUrls[num]) || selectedSkin.diceTextureUrls[num]} 
                                alt={`Dice ${num}`}
                                style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px', border: '1px solid #333' }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          ) : null
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <div key={num}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Кубик {num}:</label>
                          <input 
                            type="file" 
                            accept="image/*" 
                            id={`edit-skin-dice-texture-${num}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = (event) => {
                                  const preview = document.getElementById(`edit-skin-dice-texture-${num}-preview`)
                                  if (preview) {
                                    preview.innerHTML = `<img src="${event.target?.result}" alt="Кубик ${num}" style="max-width: 100px; max-height: 100px; border-radius: 8px; margin-top: 4px; border: 1px solid #333;" />`
                                  }
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                          />
                          <div id={`edit-skin-dice-texture-${num}-preview`} style={{ marginTop: '4px' }}></div>
                        </div>
                      ))}
                    </div>
                    <span className="field-hint" style={{ marginTop: '8px', display: 'block' }}>Загрузите 6 изображений в порядке от 1 до 6. Оставьте пустым, чтобы не изменять текстуру</span>
                  </div>
                )}
                {selectedSkin.type === 'checkers' && (
                  <div className="form-group">
                    <label>Текстура шашек (файл для игры):</label>
                    {selectedSkin.checkersTextureUrl && (
                      <div style={{ marginBottom: '8px' }}>
                        <img 
                          src={getImageUrl(selectedSkin.checkersTextureUrl) || selectedSkin.checkersTextureUrl} 
                          alt="Checkers texture"
                          style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="edit-skin-checkers-texture"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const preview = document.getElementById('edit-skin-checkers-texture-preview')
                            if (preview) {
                              preview.innerHTML = `<img src="${event.target?.result}" alt="Текстура шашек" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                            }
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                    <div id="edit-skin-checkers-texture-preview" style={{ marginTop: '8px' }}></div>
                    <span className="field-hint">Оставьте пустым, чтобы не изменять текстуру</span>
                  </div>
                )}
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
                      
                      const shopImageInput = document.getElementById('edit-skin-shop-image') as HTMLInputElement
                      if (shopImageInput.files && shopImageInput.files[0]) {
                        const shopImageFormData = new FormData()
                        shopImageFormData.append('shopImage', shopImageInput.files[0])
                        await apiClient.post(`/admin/skins/${selectedSkin.id}/upload-textures`, shopImageFormData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        })
                      }
                      
                      // Если есть новые текстуры, загружаем их
                      if (selectedSkin.type === 'board') {
                        const boardTextureInput = document.getElementById('edit-skin-board-texture') as HTMLInputElement
                        if (boardTextureInput.files && boardTextureInput.files[0]) {
                          const textureFormData = new FormData()
                          textureFormData.append('boardTexture', boardTextureInput.files[0])
                          await apiClient.post(`/admin/skins/${selectedSkin.id}/upload-textures`, textureFormData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          })
                        }
                      } else if (selectedSkin.type === 'dice') {
                        // Загружаем все 6 файлов для кубиков
                        const diceFiles: File[] = []
                        for (let i = 1; i <= 6; i++) {
                          const diceInput = document.getElementById(`edit-skin-dice-texture-${i}`) as HTMLInputElement
                          if (diceInput.files && diceInput.files[0]) {
                            diceFiles.push(diceInput.files[0])
                          }
                        }
                        if (diceFiles.length > 0) {
                          const textureFormData = new FormData()
                          diceFiles.forEach((file, index) => {
                            textureFormData.append(`diceTexture${index + 1}`, file)
                          })
                          await apiClient.post(`/admin/skins/${selectedSkin.id}/upload-textures`, textureFormData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          })
                        }
                      } else if (selectedSkin.type === 'checkers') {
                        const checkersTextureInput = document.getElementById('edit-skin-checkers-texture') as HTMLInputElement
                        if (checkersTextureInput.files && checkersTextureInput.files[0]) {
                          const textureFormData = new FormData()
                          textureFormData.append('checkersTexture', checkersTextureInput.files[0])
                          await apiClient.post(`/admin/skins/${selectedSkin.id}/upload-textures`, textureFormData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          })
                        }
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
                <label>Превью (для инвентаря):</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="skin-image"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        const preview = document.getElementById('skin-image-preview')
                        if (preview) {
                          preview.innerHTML = `<img src="${event.target?.result}" alt="Превью" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                        }
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                <div id="skin-image-preview" style={{ marginTop: '8px' }}></div>
                <span className="field-hint">Превью для отображения в инвентаре</span>
              </div>
              <div className="form-group">
                <label>Изображение для магазина:</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="skin-shop-image"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        const preview = document.getElementById('skin-shop-image-preview')
                        if (preview) {
                          preview.innerHTML = `<img src="${event.target?.result}" alt="Изображение для магазина" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                        }
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                <div id="skin-shop-image-preview" style={{ marginTop: '8px' }}></div>
                <span className="field-hint">Отдельное изображение для отображения в магазине</span>
              </div>
              <div className="form-group" id="skin-texture-group" style={{ display: 'none' }}>
                <label id="skin-texture-label">Текстура (файл для игры):</label>
                <div id="skin-texture-single" style={{ display: 'none' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="skin-texture"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const preview = document.getElementById('skin-texture-preview')
                          if (preview) {
                            preview.innerHTML = `<img src="${event.target?.result}" alt="Текстура" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 8px;" />`
                          }
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  <div id="skin-texture-preview" style={{ marginTop: '8px' }}></div>
                </div>
                <div id="skin-texture-dice" style={{ display: 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <div key={num}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Кубик {num}:</label>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id={`skin-dice-texture-${num}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (event) => {
                                const preview = document.getElementById(`skin-dice-texture-${num}-preview`)
                                if (preview) {
                                  preview.innerHTML = `<img src="${event.target?.result}" alt="Кубик ${num}" style="max-width: 100px; max-height: 100px; border-radius: 8px; margin-top: 4px; border: 1px solid #333;" />`
                                }
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                        />
                        <div id={`skin-dice-texture-${num}-preview`} style={{ marginTop: '4px' }}></div>
                      </div>
                    ))}
                  </div>
                  <span className="field-hint" style={{ marginTop: '8px', display: 'block' }}>Загрузите 6 изображений в порядке от 1 до 6</span>
                </div>
                <span className="field-hint" id="skin-texture-hint">Этот файл будет использоваться в игре</span>
              </div>
              <script dangerouslySetInnerHTML={{__html: `
                document.getElementById('skin-type').addEventListener('change', function() {
                  const type = this.value;
                  const textureGroup = document.getElementById('skin-texture-group');
                  const textureLabel = document.getElementById('skin-texture-label');
                  const textureSingle = document.getElementById('skin-texture-single');
                  const textureDice = document.getElementById('skin-texture-dice');
                  const textureHint = document.getElementById('skin-texture-hint');
                  
                  if (type) {
                    textureGroup.style.display = 'block';
                    if (type === 'board') {
                      textureLabel.textContent = 'Текстура доски (файл для игры):';
                      textureSingle.style.display = 'block';
                      textureDice.style.display = 'none';
                      textureHint.textContent = 'Этот файл будет использоваться в игре';
                    } else if (type === 'dice') {
                      textureLabel.textContent = 'Текстуры кубиков (6 файлов для игры - от 1 до 6):';
                      textureSingle.style.display = 'none';
                      textureDice.style.display = 'block';
                      textureHint.style.display = 'none';
                    } else if (type === 'checkers') {
                      textureLabel.textContent = 'Текстура шашек (файл для игры):';
                      textureSingle.style.display = 'block';
                      textureDice.style.display = 'none';
                      textureHint.textContent = 'Этот файл будет использоваться в игре';
                    }
                  } else {
                    textureGroup.style.display = 'none';
                  }
                });
              `}} />
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
                  formData.append('preview', fileInput.files[0])
                }
                
                const shopImageInput = document.getElementById('skin-shop-image') as HTMLInputElement
                if (shopImageInput.files && shopImageInput.files[0]) {
                  formData.append('shopImage', shopImageInput.files[0])
                }
                
                // Добавляем текстуру в зависимости от типа
                if (skinType === 'board') {
                  const textureInput = document.getElementById('skin-texture') as HTMLInputElement
                  if (textureInput.files && textureInput.files[0]) {
                    formData.append('boardTexture', textureInput.files[0])
                  }
                } else if (skinType === 'dice') {
                  // Для кубиков добавляем все 6 файлов (diceTexture1-6)
                  for (let i = 1; i <= 6; i++) {
                    const diceInput = document.getElementById(`skin-dice-texture-${i}`) as HTMLInputElement
                    if (diceInput.files && diceInput.files[0]) {
                      formData.append(`diceTexture${i}`, diceInput.files[0])
                    }
                  }
                } else if (skinType === 'checkers') {
                  const textureInput = document.getElementById('skin-texture') as HTMLInputElement
                  if (textureInput.files && textureInput.files[0]) {
                    formData.append('checkersTexture', textureInput.files[0])
                  }
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
                  const shopImageInput = document.getElementById('skin-shop-image') as HTMLInputElement
                  if (shopImageInput) shopImageInput.value = ''
                  const shopImagePreview = document.getElementById('skin-shop-image-preview')
                  if (shopImagePreview) shopImagePreview.innerHTML = ''
                  // Очистить поля текстур
                  const textureInput = document.getElementById('skin-texture') as HTMLInputElement
                  if (textureInput) textureInput.value = ''
                  // Очистить поля кубиков (1-6)
                  for (let i = 1; i <= 6; i++) {
                    const diceInput = document.getElementById(`skin-dice-texture-${i}`) as HTMLInputElement
                    if (diceInput) diceInput.value = ''
                    const dicePreview = document.getElementById(`skin-dice-texture-${i}-preview`)
                    if (dicePreview) dicePreview.innerHTML = ''
                  }
                  const texturePreview = document.getElementById('skin-texture-preview')
                  if (texturePreview) texturePreview.innerHTML = ''
                  const imagePreview = document.getElementById('skin-image-preview')
                  if (imagePreview) imagePreview.innerHTML = ''
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
                    <th>Канал</th>
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
                      <td>{quest.channelUsername || '-'}</td>
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
                  <select 
                    id="quest-target"
                    onChange={(e) => {
                      const channelGroup = document.getElementById('quest-channel-group')
                      if (channelGroup) {
                        channelGroup.style.display = e.target.value === 'subscribe_channel' ? 'block' : 'none'
                      }
                    }}
                  >
                    <option value="play_matches">Играть матчи</option>
                    <option value="win_streak">Серия побед</option>
                    <option value="collect_income">Собрать доход</option>
                    <option value="tournament">Турнир</option>
                    <option value="subscribe_channel">Подписка на канал</option>
                  </select>
                </div>
                <div className="form-group" id="quest-channel-group" style={{ display: 'none' }}>
                  <label>Username канала (например, @channelname):</label>
                  <input type="text" placeholder="@channelname" id="quest-channel-username" />
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
                    const target = (document.getElementById('quest-target') as HTMLSelectElement).value
                    const questData: any = {
                      name: (document.getElementById('quest-name') as HTMLInputElement).value,
                      description: (document.getElementById('quest-description') as HTMLTextAreaElement).value,
                      type: (document.getElementById('quest-type') as HTMLSelectElement).value,
                      target: target,
                      targetValue: parseInt((document.getElementById('quest-target-value') as HTMLInputElement).value),
                      rewardNarCoin: parseInt((document.getElementById('quest-reward-nar') as HTMLInputElement).value || '0'),
                      rewardXP: parseInt((document.getElementById('quest-reward-xp') as HTMLInputElement).value || '0'),
                      isPremium: (document.getElementById('quest-premium') as HTMLInputElement).checked,
                      startDate: (document.getElementById('quest-start-date') as HTMLInputElement).value,
                      endDate: (document.getElementById('quest-end-date') as HTMLInputElement).value,
                    }
                    
                    // Если цель - подписка на канал, добавляем channelUsername
                    if (target === 'subscribe_channel') {
                      questData.channelUsername = (document.getElementById('quest-channel-username') as HTMLInputElement).value
                      if (!questData.channelUsername) {
                        alert('Введите username канала для задания на подписку')
                        return
                      }
                    }
                    
                    await apiClient.post('/admin/quests', questData)
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
            <h3>Управление федерациями</h3>
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
                              if (confirm(`Удалить федерацию "${clan.name}"? Это удалит федерацию и всех ее участников!`)) {
                                apiClient.delete(`/admin/clans/${clan.id}`).then(() => {
                                  alert('Федерация удалена')
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
                <h3>Редактирование федерации: {selectedUser.name}</h3>
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
                          alert('Федерация обновлена')
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
                      <h4>Участники федерации:</h4>
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
                                    if (confirm('Удалить участника из федерации?')) {
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

        {activeTab === 'policy' && (
          <div className="admin-policy">
            <h3>Управление политиками</h3>
            
            <div className="policy-section">
              <div className="policy-header">
                <h4>Политика конфиденциальности</h4>
                {editingPolicy !== 'privacy' ? (
                  <button className="btn btn-primary" onClick={() => handleEditPolicy('privacy')}>
                    Редактировать
                  </button>
                ) : (
                  <div className="policy-actions">
                    <button className="btn btn-primary" onClick={handleSavePolicy}>
                      Сохранить
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                      setEditingPolicy(null)
                      setPolicyContent('')
                    }}>
                      Отмена
                    </button>
                  </div>
                )}
              </div>
              {editingPolicy === 'privacy' ? (
                <textarea
                  className="policy-textarea"
                  value={policyContent}
                  onChange={(e) => setPolicyContent(e.target.value)}
                  rows={20}
                  placeholder="Введите текст политики конфиденциальности..."
                />
              ) : (
                <div className="policy-preview">
                  {policies.privacy ? (
                    <div dangerouslySetInnerHTML={{ __html: policies.privacy.replace(/\n/g, '<br />') }} />
                  ) : (
                    <p className="policy-empty">Политика конфиденциальности еще не создана</p>
                  )}
                </div>
              )}
            </div>

            <div className="policy-section">
              <div className="policy-header">
                <h4>Политика соглашения</h4>
                {editingPolicy !== 'agreement' ? (
                  <button className="btn btn-primary" onClick={() => handleEditPolicy('agreement')}>
                    Редактировать
                  </button>
                ) : (
                  <div className="policy-actions">
                    <button className="btn btn-primary" onClick={handleSavePolicy}>
                      Сохранить
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                      setEditingPolicy(null)
                      setPolicyContent('')
                    }}>
                      Отмена
                    </button>
                  </div>
                )}
              </div>
              {editingPolicy === 'agreement' ? (
                <textarea
                  className="policy-textarea"
                  value={policyContent}
                  onChange={(e) => setPolicyContent(e.target.value)}
                  rows={20}
                  placeholder="Введите текст политики соглашения..."
                />
              ) : (
                <div className="policy-preview">
                  {policies.agreement ? (
                    <div dangerouslySetInnerHTML={{ __html: policies.agreement.replace(/\n/g, '<br />') }} />
                  ) : (
                    <p className="policy-empty">Политика соглашения еще не создана</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'city' && (
          <div className="admin-city">
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <button
                onClick={() => {
                  loadBuildings()
                }}
                style={{
                  padding: '8px 16px',
                  background: '#4a90e2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Обновить данные
              </button>
            </div>

            {/* Управление строениями */}
            <div style={{ marginBottom: '32px' }}>
              <h3>Управление строениями</h3>
              
              {/* Форма создания нового строения */}
              <div style={{
                background: '#2a2a2a',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
              }}>
                <h4 style={{ marginTop: 0, color: '#fff' }}>Создать новое строение</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Тип строения</label>
                    <input
                      type="text"
                      value={newBuilding.type}
                      onChange={(e) => setNewBuilding({ ...newBuilding, type: e.target.value })}
                      placeholder="shop, factory, etc."
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Название</label>
                    <input
                      type="text"
                      value={newBuilding.name}
                      onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                      placeholder="Название строения"
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Иконка (URL)</label>
                    <input
                      type="text"
                      value={newBuilding.icon}
                      onChange={(e) => setNewBuilding({ ...newBuilding, icon: e.target.value })}
                      placeholder="https://..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Изображение (URL)</label>
                    <input
                      type="text"
                      value={newBuilding.image}
                      onChange={(e) => setNewBuilding({ ...newBuilding, image: e.target.value })}
                      placeholder="https://..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Базовая цена (NAR)</label>
                    <input
                      type="number"
                      value={newBuilding.basePrice}
                      onChange={(e) => setNewBuilding({ ...newBuilding, basePrice: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Доход в час (NAR)</label>
                    <input
                      type="number"
                      value={newBuilding.baseIncomePerHour}
                      onChange={(e) => setNewBuilding({ ...newBuilding, baseIncomePerHour: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Макс. накопление (NAR)</label>
                    <input
                      type="number"
                      value={newBuilding.maxAccumulation}
                      onChange={(e) => setNewBuilding({ ...newBuilding, maxAccumulation: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Макс. уровень</label>
                    <input
                      type="number"
                      value={newBuilding.maxLevel}
                      onChange={(e) => setNewBuilding({ ...newBuilding, maxLevel: parseInt(e.target.value) || 10 })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateBuilding}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: '#4a90e2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Создать строение
                </button>
              </div>

              {/* Список строений */}
              <div style={{ display: 'grid', gap: '12px' }}>
                {buildings.map((building) => (
                  <div
                    key={building.id}
                    style={{
                      background: '#2a2a2a',
                      padding: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, color: '#fff' }}>{building.name}</h4>
                        <span style={{
                          padding: '2px 8px',
                          background: '#4a90e2',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fff',
                        }}>
                          {building.type}
                        </span>
                      </div>
                      <div style={{ color: '#999', fontSize: '14px' }}>
                        <div>Цена: {Number(building.basePrice).toLocaleString()} NAR</div>
                        <div>Доход: {Number(building.baseIncomePerHour).toLocaleString()} NAR/час</div>
                        <div>Макс. накопление: {Number(building.maxAccumulation).toLocaleString()} NAR</div>
                        <div>Макс. уровень: {building.maxLevel}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedBuilding(building)}
                        style={{
                          padding: '6px 12px',
                          background: '#4a90e2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDeleteBuilding(building.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#e24a4a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Модальное окно редактирования */}
              {selectedBuilding && (
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                  }}
                  onClick={() => setSelectedBuilding(null)}
                >
                  <div
                    style={{
                      background: '#2a2a2a',
                      padding: '24px',
                      borderRadius: '8px',
                      maxWidth: '500px',
                      width: '90%',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ marginTop: 0, color: '#fff' }}>Редактировать строение</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Тип строения</label>
                        <input
                          type="text"
                          value={selectedBuilding.type}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, type: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Название</label>
                        <input
                          type="text"
                          value={selectedBuilding.name}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, name: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Иконка (URL)</label>
                        <input
                          type="text"
                          value={selectedBuilding.icon || ''}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, icon: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Изображение (URL)</label>
                        <input
                          type="text"
                          value={selectedBuilding.image || ''}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, image: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Базовая цена (NAR)</label>
                        <input
                          type="number"
                          value={Number(selectedBuilding.basePrice)}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, basePrice: parseInt(e.target.value) || 0 })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Доход в час (NAR)</label>
                        <input
                          type="number"
                          value={Number(selectedBuilding.baseIncomePerHour)}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, baseIncomePerHour: parseInt(e.target.value) || 0 })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Макс. накопление (NAR)</label>
                        <input
                          type="number"
                          value={Number(selectedBuilding.maxAccumulation)}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, maxAccumulation: parseInt(e.target.value) || 0 })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Макс. уровень</label>
                        <input
                          type="number"
                          value={selectedBuilding.maxLevel}
                          onChange={(e) => setSelectedBuilding({ ...selectedBuilding, maxLevel: parseInt(e.target.value) || 10 })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#1a1a1a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button
                        onClick={() => handleUpdateBuilding(selectedBuilding.id, selectedBuilding)}
                        style={{
                          padding: '8px 16px',
                          background: '#4a90e2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setSelectedBuilding(null)}
                        style={{
                          padding: '8px 16px',
                          background: '#666',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно реплея игры */}
      {selectedGame && gameReplay && (
        <div className="replay-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => {
          setSelectedGame(null)
          setGameReplay(null)
          setReplayStep(0)
        }}>
          <div className="replay-modal" style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Реплей игры #{selectedGame.id}</h3>
              <button style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0 8px'
              }} onClick={() => {
                setSelectedGame(null)
                setGameReplay(null)
                setReplayStep(0)
              }}>×</button>
            </div>
            
            <div style={{ marginBottom: '16px', color: '#aaa', fontSize: '14px' }}>
              <div>
                Ход {replayStep} из {gameReplay.moves?.length || 0}
                {gameReplay.moves && gameReplay.moves[replayStep - 1] && (
                  <span style={{ marginLeft: '12px', color: '#ffffff' }}>
                    {gameReplay.moves[replayStep - 1].player.username}
                  </span>
                )}
              </div>
              <div>{selectedGame.mode === 'long' ? 'Длинные' : 'Короткие'} нарды</div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              {(() => {
                // Преобразуем gameState для BackgammonBoard
                const convertGameStateForBoard = (gameState: any) => {
                  if (!gameState) return null
                  
                  const points = gameState.points || []
                  const convertedPoints = points.map((pointValue: number, index: number) => {
                    const checkers: number[] = []
                    const absValue = Math.abs(pointValue)
                    
                    for (let i = 0; i < absValue; i++) {
                      checkers.push(pointValue > 0 ? 0 : 1)
                    }
                    
                    return {
                      index,
                      checkers,
                      color: pointValue > 0 ? 'white' : pointValue < 0 ? 'black' : null,
                    }
                  })
                  
                  return {
                    ...gameState,
                    points: convertedPoints,
                    bar: Array.isArray(gameState.bar) 
                      ? { white: gameState.bar[0] || 0, black: gameState.bar[1] || 0 }
                      : gameState.bar || { white: 0, black: 0 },
                    bearOff: Array.isArray(gameState.borneOff)
                      ? { white: gameState.borneOff[0] || 0, black: gameState.borneOff[1] || 0 }
                      : gameState.bearOff || { white: 0, black: 0 },
                  }
                }
                
                const getCurrentGameState = () => {
                  if (!gameReplay || !gameReplay.game) return null
                  
                  if (gameReplay.currentGameState) {
                    return convertGameStateForBoard(gameReplay.currentGameState)
                  }
                  
                  const { game, moves } = gameReplay
                  let currentState: any = null
                  
                  if (replayStep === 0) {
                    currentState = game.initialGameState || game.gameState
                  } else if (moves && moves[replayStep - 1]) {
                    currentState = moves[replayStep - 1].gameStateAfter
                  } else {
                    currentState = game.initialGameState || game.gameState
                  }
                  
                  return convertGameStateForBoard(currentState)
                }
                
                const getCurrentPlayer = () => {
                  if (!gameReplay || !gameReplay.game) return 0
                  if (replayStep === 0) return 0
                  
                  const { moves } = gameReplay
                  if (moves && moves[replayStep - 1]) {
                    const move = moves[replayStep - 1]
                    return move.player.id === gameReplay.game.player1.id ? 1 : 0
                  }
                  
                  return 0
                }
                
                const getCurrentDice = () => {
                  if (!gameReplay || !gameReplay.moves || replayStep === 0) return null
                  
                  const move = gameReplay.moves[replayStep - 1]
                  if (move && move.dice && move.dice.length >= 2) {
                    return { die1: move.dice[0], die2: move.dice[1] }
                  }
                  
                  return null
                }
                
                const currentState = getCurrentGameState()
                
                return currentState ? (
                  <BackgammonBoard
                    gameState={currentState}
                    currentPlayer={getCurrentPlayer()}
                    dice={getCurrentDice()}
                    onMove={() => {}}
                    onRollDice={() => {}}
                    canMove={false}
                    isMyTurn={false}
                  />
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
                    Нет данных для отображения
                  </div>
                )
              })()}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <button
                style={{
                  padding: '8px 16px',
                  background: replayStep === 0 ? '#333' : '#4a4a4a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: replayStep === 0 ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  setReplayStep(0)
                  loadReplayStep(0)
                }}
                disabled={replayStep === 0}
                title="В начало"
              >
                ⏮
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  background: replayStep === 0 ? '#333' : '#4a4a4a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: replayStep === 0 ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  const newStep = Math.max(0, replayStep - 1)
                  setReplayStep(newStep)
                  loadReplayStep(newStep)
                }}
                disabled={replayStep === 0}
                title="Назад"
              >
                ⏪
              </button>
              
              <input
                type="range"
                min="0"
                max={gameReplay.moves?.length || 0}
                value={replayStep}
                onChange={(e) => {
                  const newStep = parseInt(e.target.value, 10)
                  setReplayStep(newStep)
                  loadReplayStep(newStep)
                }}
                style={{ flex: 1 }}
              />
              
              <button
                style={{
                  padding: '8px 16px',
                  background: replayStep >= (gameReplay.moves?.length || 0) ? '#333' : '#4a4a4a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: replayStep >= (gameReplay.moves?.length || 0) ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  const newStep = Math.min(gameReplay.moves?.length || 0, replayStep + 1)
                  setReplayStep(newStep)
                  loadReplayStep(newStep)
                }}
                disabled={replayStep >= (gameReplay.moves?.length || 0)}
                title="Вперед"
              >
                ⏩
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  background: replayStep >= (gameReplay.moves?.length || 0) ? '#333' : '#4a4a4a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: replayStep >= (gameReplay.moves?.length || 0) ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  const maxStep = gameReplay.moves?.length || 0
                  setReplayStep(maxStep)
                  loadReplayStep(maxStep)
                }}
                disabled={replayStep >= (gameReplay.moves?.length || 0)}
                title="В конец"
              >
                ⏭
              </button>
            </div>
            
            {/* Информация о текущем ходе */}
            {gameReplay.moves && gameReplay.moves[replayStep - 1] && (
              <div style={{ 
                padding: '12px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '8px',
                fontSize: '14px',
                color: '#fff'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Ход {replayStep}:</strong> {gameReplay.moves[replayStep - 1].player.username}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  Кубики: {gameReplay.moves[replayStep - 1].dice?.join(', ') || 'N/A'}
                </div>
                {gameReplay.moves[replayStep - 1].moves && gameReplay.moves[replayStep - 1].moves.length > 0 && (
                  <div>
                    Ходы: {gameReplay.moves[replayStep - 1].moves.map((m: any, idx: number) => (
                      <span key={idx}>
                        {idx > 0 ? ', ' : ''}
                        {m.from === -1 ? 'бар' : m.from} → {m.to === -1 ? 'вынос' : m.to >= 24 ? 'вынос' : m.to}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

