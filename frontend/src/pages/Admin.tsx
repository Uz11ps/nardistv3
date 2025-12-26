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
    totalTransactions?: number
    completedTransactions?: number
  }
  tournaments?: {
    total: number
    active: number
  }
  quests?: {
    total: number
    active: number
  }
  skins?: {
    total: number
  }
  transactions?: {
    total: number
    completed: number
  }
}

export default function Admin() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'games' | 'notifications' | 'create-game' | 'tournaments' | 'academy' | 'city' | 'skins' | 'quests' | 'clans' | 'policy' | 'prices' | 'system-settings' | 'progression' | 'payments'>('stats')
  const [onboardingTasks, setOnboardingTasks] = useState<any[]>([])
  const [onboardingStats, setOnboardingStats] = useState<any>(null)
  const [progressionConfig, setProgressionConfig] = useState<any>(null)
  const [paymentStats, setPaymentStats] = useState<any>(null)
  const [systemSettings, setSystemSettings] = useState<any>({})
  const [isSavingProgression, setIsSavingProgression] = useState(false)
  const [editingOnboardingTask, setEditingOnboardingTask] = useState<any>(null)
  const [newOnboardingTask, setNewOnboardingTask] = useState({
    type: 'train_with_bot',
    title: '',
    description: '',
    order: 1,
    requirements: {},
    rewardNarCoin: 0,
    rewardXP: 0,
    isRequired: true,
    isActive: true,
  })
  const [tournaments, setTournaments] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
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
    districtId: '',
  })
  const [skins, setSkins] = useState<any[]>([])
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [gameReplay, setGameReplay] = useState<any>(null)
  const [replayStep, setReplayStep] = useState(0)
  
  // Функция для загрузки состояния на конкретном шаге
  const loadReplayStep = async (step: number) => {
    if (!selectedGame) return
    try {
      const response = await apiClient.get(`/admin/games/${selectedGame.id}/replay`, { params: { step } })
      if (response.data) {
        // Обновляем gameReplay с новым состоянием
        setGameReplay((prev: any) => ({
          ...prev,
          ...response.data,
          currentGameState: response.data.currentGameState || response.data.game?.gameState,
        }))
      }
    } catch (error) {
      console.error('Failed to load replay step:', error)
      alert('Ошибка загрузки шага реплея: ' + (error as any)?.response?.data?.message || (error as Error)?.message)
    }
  }
  const [quests, setQuests] = useState<any[]>([])
  const [clans, setClans] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedSkin, setSelectedSkin] = useState<any>(null)
  const [editingSkin, setEditingSkin] = useState<any>(null)
  const [selectedQuest, setSelectedQuest] = useState<any>(null)
  const [editingQuest, setEditingQuest] = useState<any>(null)
  const [selectedCourse, setSelectedCourse] = useState<any>(null)
  const [editingCourse, setEditingCourse] = useState<any>(null)
  const [selectedArticle, setSelectedArticle] = useState<any>(null)
  const [editingArticle, setEditingArticle] = useState<any>(null)
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [subscriptionPrices, setSubscriptionPrices] = useState({ month_1: 3, month_3: 7, month_12: 22 })
  const [narCoinPackages, setNarCoinPackages] = useState<Array<{ amount: number; price: number }>>([])
  const [editingSetting, setEditingSetting] = useState<{ key: string; value: any } | null>(null)
  const [districts, setDistricts] = useState<any[]>([])
  const [editingDistrict, setEditingDistrict] = useState<any>(null)
  
  // Фильтры
  const [userFilters, setUserFilters] = useState({ search: '', status: '', level: '' })
  const [gameFilters, setGameFilters] = useState({ search: '', status: '', mode: '' })
  const [tournamentFilters, setTournamentFilters] = useState({ search: '', status: '' })
  const [questFilters, setQuestFilters] = useState({ search: '', type: '' })
  const [clanFilters, setClanFilters] = useState({ search: '', level: '' })
  
  // Формы создания
  const [newGame, setNewGame] = useState({ 
    player1Id: '', 
    player2Id: '', 
    mode: 'short', 
    type: 'vs_player',
    stake: 0,
    moveTimeout: 60,
    tournamentId: '',
  })
  const [newTournament, setNewTournament] = useState({ 
    name: '', 
    mode: 'short', 
    format: 'bracket', 
    startDate: '', 
    registrationStart: '',
    registrationEnd: '',
    maxParticipants: 16, 
    entryFee: 0,
    prizes: '' // JSON строка с наградами
  })
  const [newArticle, setNewArticle] = useState({ 
    title: '', 
    content: '', 
    type: 'course', 
    isPaid: false, 
    price: 0,
    rewards: '', // JSON строка с наградами (может быть несколько)
  })
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
      console.log('🔐 Попытка входа в админку:', { login, password: password ? '***' : 'empty' })
      const response = await apiClient.post('/admin/login', { login, password })
      console.log('✅ Ответ от сервера:', response.data)
      if (response.data?.access_token) {
        localStorage.setItem('admin_token', response.data.access_token)
        setIsAuthenticated(true)
        // Небольшая задержка, чтобы токен успел сохраниться и interceptor успел его подхватить
        await new Promise(resolve => setTimeout(resolve, 100))
        await loadStats()
      } else {
        console.error('❌ Токен не получен в ответе')
        alert('Ошибка: токен не получен')
      }
    } catch (error: any) {
      console.error('❌ Ошибка входа:', error)
      console.error('Статус:', error.response?.status)
      console.error('Данные ответа:', error.response?.data)
      alert(error.response?.data?.message || 'Неверный логин или пароль')
    }
  }

  const loadStats = async () => {
    try {
      // Проверяем авторизацию перед загрузкой данных
      const adminToken = localStorage.getItem('admin_token')
      if (!adminToken) {
        setIsAuthenticated(false)
        return
      }
      
      const [statsRes, statisticsRes, usersRes, gamesRes, tournamentsRes, articlesRes, cityRes, skinsRes, questsRes, clansRes, buildingsRes, policiesRes, templatesRes, onboardingTasksRes, onboardingStatsRes, progressionRes] = await Promise.all([
        apiClient.get('/admin/stats').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: {} }
        }),
        apiClient.get('/admin/statistics').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: {} }
        }),
        apiClient.get('/admin/users').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/games').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/tournaments').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/academy').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/city/rewards').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: null }
        }),
        apiClient.get('/admin/skins').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/quests').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/clans').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/buildings').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/policy/admin/all').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/notification-templates').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/onboarding/tasks').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: [] }
        }),
        apiClient.get('/admin/onboarding/tasks/stats').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: null }
        }),
        apiClient.get('/admin/progression/config').catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('admin_token')
            setIsAuthenticated(false)
          }
          return { data: null }
        }),
      ])
      // Объединяем базовую статистику с расширенной
      const mergedStats = { ...statsRes.data, ...statisticsRes.data }
      setStats(mergedStats)
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
      setOnboardingTasks(onboardingTasksRes.data || [])
      setOnboardingStats(onboardingStatsRes.data || null)
      setProgressionConfig(progressionRes.data?.config || progressionRes.data)
      
      // Загружаем политики
      const policiesData: { privacy?: string; agreement?: string } = {}
      if (policiesRes.data && Array.isArray(policiesRes.data)) {
        policiesRes.data.forEach((p: any) => {
          if (p.type === 'privacy') policiesData.privacy = p.content
          if (p.type === 'agreement') policiesData.agreement = p.content
        })
      }
      setPolicies(policiesData)
    } catch (error: any) {
      // Не показываем ошибки в консоли для неавторизованных запросов
      if (error.response?.status !== 401) {
        console.error('Ошибка загрузки данных:', error)
      }
      // Если получили 401, сбрасываем авторизацию
      if (error.response?.status === 401) {
        localStorage.removeItem('admin_token')
        setIsAuthenticated(false)
      }
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

  const loadOnboardingTasks = async () => {
    try {
      const [tasksRes, statsRes] = await Promise.all([
        apiClient.get('/admin/onboarding/tasks'),
        apiClient.get('/admin/onboarding/tasks/stats'),
      ])
      setOnboardingTasks(tasksRes.data || [])
      setOnboardingStats(statsRes.data || null)
    } catch (error) {
      console.error('Failed to load onboarding tasks:', error)
    }
  }

  const handleCreateOnboardingTask = async () => {
    try {
      await apiClient.post('/admin/onboarding/tasks', newOnboardingTask)
      setNewOnboardingTask({
        type: 'train_with_bot',
        title: '',
        description: '',
        order: onboardingTasks.length + 1,
        requirements: {},
        rewardNarCoin: 0,
        rewardXP: 0,
        isRequired: true,
        isActive: true,
      })
      await loadOnboardingTasks()
      alert('Задание создано')
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpdateOnboardingTask = async (id: string, data: any) => {
    try {
      await apiClient.put(`/admin/onboarding/tasks/${id}`, data)
      await loadOnboardingTasks()
      setEditingOnboardingTask(null)
      alert('Задание обновлено')
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleDeleteOnboardingTask = async (id: string) => {
    if (!confirm('Удалить задание?')) return
    try {
      await apiClient.delete(`/admin/onboarding/tasks/${id}`)
      await loadOnboardingTasks()
      alert('Задание удалено')
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
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

  const loadDistricts = async () => {
    try {
      const response = await apiClient.get('/admin/districts').catch(() => ({ data: [] }))
      setDistricts(response.data || [])
    } catch (error) {
      console.error('Failed to load districts:', error)
    }
  }

  const loadSystemSettings = async () => {
    try {
      const response = await apiClient.get('/admin/system-settings')
      setSystemSettings(response.data || {})
    } catch (error) {
      console.error('Failed to load system settings:', error)
    }
  }

  const loadProgressionConfig = async () => {
    try {
      const response = await apiClient.get('/admin/progression/config')
      setProgressionConfig(response.data?.config || response.data)
    } catch (error) {
      console.error('Failed to load progression config:', error)
    }
  }

  const loadPaymentStats = async () => {
    try {
      const response = await apiClient.get('/admin/payment-stats')
      setPaymentStats(response.data)
    } catch (error) {
      console.error('Failed to load payment stats:', error)
    }
  }

  const loadSubscriptionPrices = async () => {
    try {
      const response = await apiClient.get('/admin/prices/subscription')
      setSubscriptionPrices(response.data)
    } catch (error) {
      console.error('Failed to load subscription prices:', error)
    }
  }

  const loadNarCoinPrices = async () => {
    try {
      const response = await apiClient.get('/admin/prices/nar-coin')
      setNarCoinPackages(response.data)
    } catch (error) {
      console.error('Failed to load nar-coin prices:', error)
    }
  }

  const handleSaveProgressionConfig = async () => {
    try {
      setIsSavingProgression(true)
      await apiClient.put('/admin/progression/config', progressionConfig)
      alert('Настройки прогрессии сохранены')
    } catch (error: any) {
      alert('Ошибка при сохранении: ' + (error.response?.data?.message || error.message))
    } finally {
      setIsSavingProgression(false)
    }
  }

  const handleUpdateSystemSettings = async (settings: any) => {
    try {
      await apiClient.put('/admin/system-settings', settings)
      alert('Настройки сохранены')
      loadSystemSettings()
    } catch (error: any) {
      alert('Ошибка при сохранении: ' + (error.response?.data?.message || error.message))
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
                    districtId: '',
                  })
      
      // Очистить файлы
      const iconInput = document.getElementById('building-icon-file') as HTMLInputElement
      if (iconInput) iconInput.value = ''
      const imageInput = document.getElementById('building-image-file') as HTMLInputElement
      if (imageInput) imageInput.value = ''
      const iconPreview = document.getElementById('building-icon-preview')
      if (iconPreview) iconPreview.innerHTML = ''
      const imagePreview = document.getElementById('building-image-preview')
      if (imagePreview) imagePreview.innerHTML = ''
      
      loadBuildings()
    } catch (error: any) {
      alert('Ошибка: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpdateBuilding = async (id: string, data: any) => {
    try {
      const formData = new FormData()
      formData.append('type', data.type)
      formData.append('name', data.name)
      formData.append('basePrice', data.basePrice.toString())
      formData.append('baseIncomePerHour', data.baseIncomePerHour.toString())
      formData.append('maxAccumulation', data.maxAccumulation.toString())
      formData.append('maxLevel', data.maxLevel.toString())
      
      const iconFile = (document.getElementById('edit-building-icon-file') as HTMLInputElement)?.files?.[0]
      if (iconFile) {
        formData.append('icon', iconFile)
      }
      
      const imageFile = (document.getElementById('edit-building-image-file') as HTMLInputElement)?.files?.[0]
      if (imageFile) {
        formData.append('image', imageFile)
      }
      
      await apiClient.put(`/admin/buildings/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
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
          onClick={() => {
            setActiveTab('academy')
            loadOnboardingTasks()
          }}
        >
          Обучение
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'city' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('city')
            loadBuildings()
            loadDistricts()
          }}
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
        <button
          className={`admin-tab-btn ${activeTab === 'progression' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('progression')
            loadProgressionConfig()
          }}
        >
          Прогрессия
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('payments')
            loadPaymentStats()
            loadSystemSettings()
          }}
        >
          Платежи
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('prices')
            loadSubscriptionPrices()
            loadNarCoinPrices()
          }}
        >
          Цены
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'system-settings' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('system-settings')
            loadSystemSettings()
          }}
        >
          Настройки
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'stats' && (
          stats ? (
            <div className="admin-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Пользователи</h3>
                <div className="stat-value">{stats?.users?.total || 0}</div>
                <div className="stat-details">
                  <div>Активных: {stats?.users?.active || 0}</div>
                  <div>Забанено: {stats?.users?.banned || 0}</div>
                  <div>Админов: {stats?.users?.admins || 0}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Игры</h3>
                <div className="stat-value">{stats?.games?.total || 0}</div>
                <div className="stat-details">
                  <div>Завершено: {stats?.games?.finished || 0}</div>
                  <div>В процессе: {stats?.games?.inProgress || 0}</div>
                  <div>Всего ходов: {stats?.games?.totalMoves || 0}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Турниры</h3>
                <div className="stat-value">{stats?.tournaments?.total || 0}</div>
                <div className="stat-details">
                  <div>Активных: {stats?.tournaments?.active || 0}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Квесты</h3>
                <div className="stat-value">{stats?.quests?.total || 0}</div>
                <div className="stat-details">
                  <div>Активных: {stats?.quests?.active || 0}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Скины</h3>
                <div className="stat-value">{stats?.skins?.total || 0}</div>
              </div>

              <div className="stat-card">
                <h3>Транзакции</h3>
                <div className="stat-value">{stats?.transactions?.total || 0}</div>
                <div className="stat-details">
                  <div>Завершено: {stats?.transactions?.completed || 0}</div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Экономика</h3>
                <div className="stat-value">{Number(stats?.economy?.totalNarCoin || 0).toLocaleString()} NAR</div>
                <div className="stat-details">
                  <div>Всего XP: {Number(stats?.economy?.totalXp || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="stats-chart">
              <h3>Распределение по уровням</h3>
              <div className="level-chart">
                {stats?.users?.levelDistribution && stats.users.levelDistribution.length > 0 ? (
                  stats.users.levelDistribution.map((item) => (
                    <div key={item.level} className="level-bar">
                      <div className="level-label">Уровень {item.level}</div>
                      <div className="level-progress">
                        <div
                          className="level-fill"
                          style={{
                            width: `${stats?.users?.total ? (Number(item.count) / (stats.users.total || 1)) * 100 : 0}%`,
                          }}
                        >
                          {item.count}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#aaaaaa' }}>
                    Нет данных
                  </div>
                )}
              </div>
            </div>

            <div className="stats-chart">
              <h3>Игры за последние 7 дней</h3>
              <div className="games-chart">
                {stats?.games?.last7Days && stats.games.last7Days.length > 0 ? (
                  stats.games.last7Days.map((item) => (
                    <div key={item.date} className="games-bar">
                      <div className="games-date">
                        {item.date ? new Date(item.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : 'N/A'}
                      </div>
                      <div className="games-count">{item.count}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#aaaaaa' }}>
                    Нет данных
                  </div>
                )}
              </div>
            </div>
          </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
              Загрузка статистики...
            </div>
          )
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
                                onClick={() => {
                                  setEditingUser(user)
                                }}
                                style={{ padding: '4px 8px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Редактировать
                              </button>
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
                            </>
                          )}
                          {user.isAdmin && (
                            <button
                              onClick={() => {
                                setEditingUser(user)
                              }}
                              style={{ padding: '4px 8px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Редактировать
                            </button>
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
                          const narCoinEl = document.getElementById('edit-narcoin') as HTMLInputElement
                          const xpEl = document.getElementById('edit-xp') as HTMLInputElement
                          const levelEl = document.getElementById('edit-level') as HTMLInputElement
                          const isAdminEl = document.getElementById('edit-admin') as HTMLInputElement
                          
                          const narCoin = narCoinEl ? parseInt(narCoinEl.value || '0') : 0
                          const xp = xpEl ? parseInt(xpEl.value || '0') : 0
                          const level = levelEl ? parseInt(levelEl.value || '1') : 1
                          const isAdmin = isAdminEl ? isAdminEl.checked : false
                          
                          const referralPercentEl = document.getElementById('edit-referral-percent') as HTMLInputElement
                          const referralBaseBonusEl = document.getElementById('edit-referral-base-bonus') as HTMLInputElement
                          const referralPercent = referralPercentEl ? parseInt(referralPercentEl.value || '5') : 5
                          const referralBaseBonus = referralBaseBonusEl ? parseInt(referralBaseBonusEl.value || '100') : 100

                          // Валидация
                          if (isNaN(narCoin) || narCoin < 0) {
                            alert('Некорректное значение NAR-coin')
                            return
                          }
                          if (isNaN(xp) || xp < 0) {
                            alert('Некорректное значение XP')
                            return
                          }
                          if (isNaN(level) || level < 1 || level > 50) {
                            alert('Некорректное значение уровня (должно быть от 1 до 50)')
                            return
                          }

                          // Выполняем все запросы последовательно с обработкой ошибок
                          try {
                            await apiClient.put(`/admin/users/${selectedUser.id}/balance`, { narCoin, xp })
                          } catch (err: any) {
                            throw new Error(`Ошибка обновления баланса: ${err.response?.data?.message || err.message}`)
                          }
                          
                          try {
                            await apiClient.put(`/admin/users/${selectedUser.id}/level`, { level })
                          } catch (err: any) {
                            throw new Error(`Ошибка обновления уровня: ${err.response?.data?.message || err.message}`)
                          }
                          
                          try {
                            await apiClient.put(`/admin/users/${selectedUser.id}/role`, { isAdmin, isTrainer: false })
                          } catch (err: any) {
                            throw new Error(`Ошибка обновления роли: ${err.response?.data?.message || err.message}`)
                          }
                          
                          try {
                            await apiClient.put(`/admin/users/${selectedUser.id}/referral-settings`, { referralPercent, referralBaseBonus })
                          } catch (err: any) {
                            throw new Error(`Ошибка обновления реферальных настроек: ${err.response?.data?.message || err.message}`)
                          }

                          alert('Все изменения сохранены')
                          loadStats()
                          setSelectedUser(null)
                        } catch (err: any) {
                          alert('Ошибка: ' + (err.message || err.response?.data?.message || 'Неизвестная ошибка'))
                          console.error('Ошибка сохранения пользователя:', err)
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
                          <button                           onClick={async () => {
                            try {
                              // Загружаем полные данные реплея через админский эндпоинт
                              const replayResponse = await apiClient.get(`/admin/games/${game.id}/replay`, { params: { step: 0 } })
                              if (!replayResponse.data) {
                                alert('Реплей недоступен для этой игры')
                                return
                              }
                              setSelectedGame(game)
                              setGameReplay(replayResponse.data)
                              setReplayStep(0)
                            } catch (error: any) {
                              console.error('Replay error:', error)
                              alert('Ошибка загрузки реплея: ' + (error.response?.data?.message || error.message || 'Неизвестная ошибка'))
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
                  className="btn btn-danger"
                  onClick={async () => {
                    if (confirm('Удалить все сообщения бота? Это действие необратимо!')) {
                      try {
                        await apiClient.delete('/admin/notifications/bot/all')
                        alert('Все сообщения бота удалены')
                        loadStats()
                      } catch (error: any) {
                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                      }
                    }
                  }}
                >
                  Удалить все сообщения бота
                </button>
                <button
                  className="btn btn-warning"
                  onClick={async () => {
                    if (confirm('Удалить последнее сообщение бота у каждого пользователя? Это действие необратимо!')) {
                      try {
                        await apiClient.delete('/admin/notifications/bot/last')
                        alert('Последние сообщения бота удалены')
                        loadStats()
                      } catch (error: any) {
                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                      }
                    }
                  }}
                >
                  Удалить последнее
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
                <label>Игрок 1 (UUID, ник в тг, nickname или userId)</label>
                <input
                  type="text"
                  value={newGame.player1Id}
                  onChange={(e) => setNewGame({ ...newGame, player1Id: e.target.value })}
                  placeholder="UUID, username, nickname или telegramId"
                />
              </div>
              <div className="form-group">
                <label>Игрок 2 (опционально, если пусто - игра с ботом)</label>
                <input
                  type="text"
                  value={newGame.player2Id}
                  onChange={(e) => setNewGame({ ...newGame, player2Id: e.target.value })}
                  placeholder="UUID, username, nickname или telegramId"
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
              <div className="form-group">
                <label>Ставка (NAR-coin, 0 = без ставки)</label>
                <input
                  type="number"
                  value={newGame.stake}
                  onChange={(e) => setNewGame({ ...newGame, stake: parseInt(e.target.value) || 0 })}
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label>Длительность хода (секунды)</label>
                <input
                  type="number"
                  value={newGame.moveTimeout}
                  onChange={(e) => setNewGame({ ...newGame, moveTimeout: parseInt(e.target.value) || 60 })}
                  min="10"
                  max="3600"
                  placeholder="60"
                />
              </div>
              {newGame.type === 'tournament' && (
                <div className="form-group">
                  <label>ID турнира (опционально)</label>
                  <input
                    type="text"
                    value={newGame.tournamentId}
                    onChange={(e) => setNewGame({ ...newGame, tournamentId: e.target.value })}
                    placeholder="UUID турнира"
                  />
                </div>
              )}
              <button onClick={async () => {
                try {
                  const res = await apiClient.post('/admin/games/create', {
                    ...newGame,
                    stake: newGame.stake || undefined,
                    moveTimeout: newGame.moveTimeout || undefined,
                    tournamentId: newGame.tournamentId || undefined,
                  })
                  alert(`Игра создана! ID: ${res.data.id}`)
                  setNewGame({ 
                    player1Id: '', 
                    player2Id: '', 
                    mode: 'short', 
                    type: 'vs_player',
                    stake: 0,
                    moveTimeout: 60,
                    tournamentId: '',
                  })
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
              <div className="form-group">
                <label>Награды (JSON, например: {'{"1": {"narCoin": 1000, "xp": 500}, "2": {"narCoin": 500, "xp": 250}, "3": {"narCoin": 250, "xp": 100}}'})</label>
                <textarea
                  value={newTournament.prizes}
                  onChange={(e) => setNewTournament({ ...newTournament, prizes: e.target.value })}
                  rows={4}
                  placeholder='{"1": {"narCoin": 1000, "xp": 500}, "2": {"narCoin": 500, "xp": 250}}'
                  style={{ width: '100%', padding: '8px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff', fontFamily: 'monospace' }}
                />
              </div>
              <button onClick={async () => {
                try {
                  if (!newTournament.registrationStart || !newTournament.registrationEnd || !newTournament.startDate) {
                    alert('Заполните все даты!')
                    return
                  }
                  
                  let prizes = null;
                  if (newTournament.prizes && newTournament.prizes.trim()) {
                    try {
                      prizes = JSON.parse(newTournament.prizes);
                    } catch (e) {
                      alert('Ошибка в формате наград. Используйте валидный JSON.');
                      return;
                    }
                  }

                  await apiClient.post('/admin/tournaments/create', {
                    ...newTournament,
                    registrationStart: new Date(newTournament.registrationStart).toISOString(),
                    registrationEnd: new Date(newTournament.registrationEnd).toISOString(),
                    startDate: new Date(newTournament.startDate).toISOString(),
                    status: 'registration',
                    prizes: prizes,
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
                    entryFee: 0,
                    prizes: '',
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
              <div className="form-group">
                <label>Награды (JSON, может быть несколько, например: [{'{"narCoin": 1000, "xp": 500}'}, {'{"skinId": "uuid", "narCoin": 500}'}])</label>
                <textarea
                  value={newArticle.rewards}
                  onChange={(e) => setNewArticle({ ...newArticle, rewards: e.target.value })}
                  rows={4}
                  placeholder='[{"narCoin": 1000, "xp": 500}, {"skinId": "uuid", "narCoin": 500}]'
                  style={{ width: '100%', padding: '8px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff', fontFamily: 'monospace' }}
                />
              </div>
              <button onClick={async () => {
                try {
                  let rewards = null;
                  if (newArticle.rewards && newArticle.rewards.trim()) {
                    try {
                      rewards = JSON.parse(newArticle.rewards);
                    } catch (e) {
                      alert('Ошибка в формате наград. Используйте валидный JSON.');
                      return;
                    }
                  }

                  await apiClient.post('/admin/academy/create', {
                    ...newArticle,
                    type: 'course', // Курсы создаются только админами
                    authorId: null, // null означает, что это курс от админа
                    isVerified: true, // Курсы от админов сразу верифицированы
                    rewards: rewards, // Награды (может быть массив)
                  })
                  alert('Курс создан!')
                  setNewArticle({ 
                    title: '', 
                    content: '', 
                    type: 'course', 
                    isPaid: false, 
                    price: 0,
                    rewards: '',
                  })
                  // Перезагружаем данные
                  const response = await apiClient.get('/admin/academy')
                  setArticles(response.data || [])
                  loadStats()
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}>Создать курс</button>
            </div>

            {/* Онбординговые задания */}
            <div className="create-form" style={{ marginTop: '32px' }}>
              <h3>Онбординговые задания</h3>
              <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>
                Онбординговые задания доступны сразу без покупок и идут в "Мои материалы" автоматически.
              </p>
              <div className="form-group">
                <label>Тип задания</label>
                <select
                  value={newOnboardingTask.type}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, type: e.target.value })}
                >
                  <option value="train_with_bot">Тренировка с ботом</option>
                  <option value="online_match">Онлайн-партия</option>
                  <option value="view_city">Просмотр города</option>
                  <option value="play_short_match">Быстрая партия</option>
                  <option value="play_long_match">Длинная партия</option>
                  <option value="win_match">Победа в матче</option>
                  <option value="complete_training_position">Тренировочная позиция</option>
                  <option value="join_clan">Вступить в клан</option>
                  <option value="purchase_building">Купить строение</option>
                  <option value="upgrade_building">Улучшить строение</option>
                  <option value="custom">Кастомное</option>
                </select>
              </div>
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text"
                  value={newOnboardingTask.title}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, title: e.target.value })}
                  placeholder="Название задания"
                />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={newOnboardingTask.description}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, description: e.target.value })}
                  rows={3}
                  placeholder="Описание задания"
                />
              </div>
              <div className="form-group">
                <label>Порядок</label>
                <input
                  type="number"
                  value={newOnboardingTask.order}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, order: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Награда NAR-coin</label>
                <input
                  type="number"
                  value={newOnboardingTask.rewardNarCoin}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, rewardNarCoin: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Награда XP</label>
                <input
                  type="number"
                  value={newOnboardingTask.rewardXP}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, rewardXP: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newOnboardingTask.isRequired}
                    onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, isRequired: e.target.checked })}
                  />
                  Обязательное задание
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newOnboardingTask.isActive}
                    onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, isActive: e.target.checked })}
                  />
                  Активно
                </label>
              </div>
              <button onClick={handleCreateOnboardingTask} className="btn btn-primary">Создать задание</button>
            </div>

            <div style={{ marginTop: '32px' }}>
              <h3>Список онбординговых заданий</h3>
              <div className="admin-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Порядок</th>
                      <th>Название</th>
                      <th>Тип</th>
                      <th>Награда NAR</th>
                      <th>Награда XP</th>
                      <th>Обязательное</th>
                      <th>Активно</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboardingTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.order}</td>
                        <td>{task.title}</td>
                        <td>{task.type}</td>
                        <td>{Number(task.rewardNarCoin || 0).toLocaleString()}</td>
                        <td>{task.rewardXP || 0}</td>
                        <td>{task.isRequired ? 'Да' : 'Нет'}</td>
                        <td>{task.isActive ? 'Да' : 'Нет'}</td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingOnboardingTask({ ...task })}>Редактировать</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOnboardingTask(task.id)}>Удалить</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editingOnboardingTask && (
              <div className="admin-modal-overlay" onClick={() => setEditingOnboardingTask(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h3>Редактировать онбординговое задание</h3>
                    <button className="admin-modal-close" onClick={() => setEditingOnboardingTask(null)}>×</button>
                  </div>
                  <div className="admin-modal-content">
                    <div className="form-group">
                      <label>Название</label>
                      <input
                        type="text"
                        value={editingOnboardingTask.title}
                        onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, title: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Описание</label>
                      <textarea
                        value={editingOnboardingTask.description || ''}
                        onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="form-group">
                      <label>Порядок</label>
                      <input
                        type="number"
                        value={editingOnboardingTask.order}
                        onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, order: parseInt(e.target.value) || 1 })}
                        min="1"
                      />
                    </div>
                    <div className="form-group">
                      <label>Награда NAR-coin</label>
                      <input
                        type="number"
                        value={editingOnboardingTask.rewardNarCoin || 0}
                        onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, rewardNarCoin: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Награда XP</label>
                      <input
                        type="number"
                        value={editingOnboardingTask.rewardXP || 0}
                        onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, rewardXP: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingOnboardingTask.isRequired}
                          onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, isRequired: e.target.checked })}
                        />
                        Обязательное
                      </label>
                    </div>
                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingOnboardingTask.isActive}
                          onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, isActive: e.target.checked })}
                        />
                        Активно
                      </label>
                    </div>
                    <div className="edit-form-actions">
                      <button className="btn btn-primary" onClick={() => handleUpdateOnboardingTask(editingOnboardingTask.id, editingOnboardingTask)}>Сохранить</button>
                      <button className="btn btn-secondary" onClick={() => setEditingOnboardingTask(null)}>Отмена</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="articles-list">
              <h3>Все материалы (Курсы и Статьи)</h3>
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
                          <button 
                            onClick={() => setEditingArticle({ ...a })}
                            style={{
                              padding: '4px 8px',
                              background: '#4a9eff',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Редактировать
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
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            // Парсим JSON конфиги если они пришли как строки
                            const parsedSkin = {
                              ...skin,
                              boardConfig: typeof skin.boardConfig === 'string' ? JSON.parse(skin.boardConfig) : (skin.boardConfig || {}),
                              diceConfig: typeof skin.diceConfig === 'string' ? JSON.parse(skin.diceConfig) : (skin.diceConfig || {}),
                              checkersConfig: typeof skin.checkersConfig === 'string' ? JSON.parse(skin.checkersConfig) : (skin.checkersConfig || {}),
                            }
                            setEditingSkin(parsedSkin)
                          }}>Полное редактирование</button>
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
                {/* Поля для конфигураций материалов */}
                {selectedSkin.type === 'board' && (
                  <div className="form-group">
                    <label>Конфигурация доски (цвета материалов):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Фон доски:</label>
                        <input 
                          type="color" 
                          id="edit-skin-board-background-color" 
                          defaultValue={selectedSkin.boardConfig?.backgroundColor || '#8B4513'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Светлый треугольник:</label>
                        <input 
                          type="color" 
                          id="edit-skin-board-triangle-color-1" 
                          defaultValue={selectedSkin.boardConfig?.triangleColor1 || '#D4A574'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Темный треугольник:</label>
                        <input 
                          type="color" 
                          id="edit-skin-board-triangle-color-2" 
                          defaultValue={selectedSkin.boardConfig?.triangleColor2 || '#8B4513'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет границы:</label>
                        <input 
                          type="color" 
                          id="edit-skin-board-border-color" 
                          defaultValue={selectedSkin.boardConfig?.borderColor || '#5c3a21'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет оконтовки (бар):</label>
                        <input 
                          type="color" 
                          id="edit-skin-board-outline-color" 
                          defaultValue={selectedSkin.boardConfig?.outlineColor || '#654321'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                    </div>
                    <span className="field-hint">Цвета для отрисовки доски из материалов</span>
                  </div>
                )}
                {selectedSkin.type === 'dice' && (
                  <div className="form-group">
                    <label>Конфигурация кубиков (цвет материалов):</label>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет кубика:</label>
                      <input 
                        type="color" 
                        id="edit-skin-dice-color" 
                        defaultValue={selectedSkin.diceConfig?.color || '#FFFFFF'} 
                        style={{ width: '100%', height: '40px' }} 
                      />
                    </div>
                    <span className="field-hint">Цвет кубика. Цифры 1-6 будут рисоваться поверх</span>
                  </div>
                )}
                {selectedSkin.type === 'checkers' && (
                  <div className="form-group">
                    <label>Конфигурация шашек (цвета материалов):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет белых шашек:</label>
                        <input 
                          type="color" 
                          id="edit-skin-checkers-white-color" 
                          defaultValue={selectedSkin.checkersConfig?.whiteColor || '#F0F0F0'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет черных шашек:</label>
                        <input 
                          type="color" 
                          id="edit-skin-checkers-black-color" 
                          defaultValue={selectedSkin.checkersConfig?.blackColor || '#333333'} 
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                    </div>
                    <span className="field-hint">Цвета для отрисовки шашек из материалов</span>
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
                      
                      // Добавляем конфиги в зависимости от типа
                      if (selectedSkin.type === 'board') {
                        updateData.boardConfig = {
                          backgroundColor: (document.getElementById('edit-skin-board-background-color') as HTMLInputElement).value,
                          triangleColor1: (document.getElementById('edit-skin-board-triangle-color-1') as HTMLInputElement).value,
                          triangleColor2: (document.getElementById('edit-skin-board-triangle-color-2') as HTMLInputElement).value,
                          borderColor: (document.getElementById('edit-skin-board-border-color') as HTMLInputElement).value,
                          outlineColor: (document.getElementById('edit-skin-board-outline-color') as HTMLInputElement).value,
                        }
                      } else if (selectedSkin.type === 'dice') {
                        updateData.diceConfig = {
                          color: (document.getElementById('edit-skin-dice-color') as HTMLInputElement).value,
                        }
                      } else if (selectedSkin.type === 'checkers') {
                        updateData.checkersConfig = {
                          whiteColor: (document.getElementById('edit-skin-checkers-white-color') as HTMLInputElement).value,
                          blackColor: (document.getElementById('edit-skin-checkers-black-color') as HTMLInputElement).value,
                        }
                      }
                      
                      await apiClient.put(`/admin/skins/${selectedSkin.id}`, updateData)
                      
                      // Изображения больше не используются - только материалы (цвета)
                      
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
              {/* Поля для загрузки изображений удалены - скины теперь только на материалах (цветах) */}
              {/* Поля для загрузки текстур удалены - теперь используются только материалы (цвета) */}
              {/* Поля для конфигураций материалов */}
              <div className="form-group" id="skin-config-board" style={{ display: 'none' }}>
                <label>Конфигурация доски (цвета материалов):</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Фон доски:</label>
                    <input type="color" id="skin-board-background-color" defaultValue="#8B4513" style={{ width: '100%', height: '40px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Светлый треугольник:</label>
                    <input type="color" id="skin-board-triangle-color-1" defaultValue="#D4A574" style={{ width: '100%', height: '40px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Темный треугольник:</label>
                    <input type="color" id="skin-board-triangle-color-2" defaultValue="#8B4513" style={{ width: '100%', height: '40px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет границы:</label>
                    <input type="color" id="skin-board-border-color" defaultValue="#5c3a21" style={{ width: '100%', height: '40px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет оконтовки (бар):</label>
                    <input type="color" id="skin-board-outline-color" defaultValue="#654321" style={{ width: '100%', height: '40px' }} />
                  </div>
                </div>
                <span className="field-hint">Цвета для отрисовки доски из материалов</span>
              </div>
              <div className="form-group" id="skin-config-dice" style={{ display: 'none' }}>
                <label>Конфигурация кубиков (цвет материалов):</label>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет кубика:</label>
                  <input type="color" id="skin-dice-color" defaultValue="#FFFFFF" style={{ width: '100%', height: '40px' }} />
                </div>
                <span className="field-hint">Цвет кубика. Цифры 1-6 будут рисоваться поверх</span>
              </div>
              <div className="form-group" id="skin-config-checkers" style={{ display: 'none' }}>
                <label>Конфигурация шашек (цвета материалов):</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет белых шашек:</label>
                    <input type="color" id="skin-checkers-white-color" defaultValue="#F0F0F0" style={{ width: '100%', height: '40px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет черных шашек:</label>
                    <input type="color" id="skin-checkers-black-color" defaultValue="#333333" style={{ width: '100%', height: '40px' }} />
                  </div>
                </div>
                <span className="field-hint">Цвета для отрисовки шашек из материалов</span>
              </div>
              <script dangerouslySetInnerHTML={{__html: `
                document.getElementById('skin-type').addEventListener('change', function() {
                  const type = this.value;
                  const configBoard = document.getElementById('skin-config-board');
                  const configDice = document.getElementById('skin-config-dice');
                  const configCheckers = document.getElementById('skin-config-checkers');
                  
                  if (type === 'board') {
                      if (configBoard) configBoard.style.display = 'block';
                      if (configDice) configDice.style.display = 'none';
                      if (configCheckers) configCheckers.style.display = 'none';
                    } else if (type === 'dice') {
                      if (configBoard) configBoard.style.display = 'none';
                      if (configDice) configDice.style.display = 'block';
                      if (configCheckers) configCheckers.style.display = 'none';
                    } else if (type === 'checkers') {
                      if (configBoard) configBoard.style.display = 'none';
                      if (configDice) configDice.style.display = 'none';
                      if (configCheckers) configCheckers.style.display = 'block';
                    } else {
                      if (configBoard) configBoard.style.display = 'none';
                      if (configDice) configDice.style.display = 'none';
                      if (configCheckers) configCheckers.style.display = 'none';
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
                
                // Добавляем конфиги в зависимости от типа
                if (skinType === 'board') {
                  const boardConfig = {
                    backgroundColor: (document.getElementById('skin-board-background-color') as HTMLInputElement).value,
                    triangleColor1: (document.getElementById('skin-board-triangle-color-1') as HTMLInputElement).value,
                    triangleColor2: (document.getElementById('skin-board-triangle-color-2') as HTMLInputElement).value,
                    borderColor: (document.getElementById('skin-board-border-color') as HTMLInputElement).value,
                    outlineColor: (document.getElementById('skin-board-outline-color') as HTMLInputElement).value,
                  }
                  formData.append('boardConfig', JSON.stringify(boardConfig))
                } else if (skinType === 'dice') {
                  const diceConfig = {
                    color: (document.getElementById('skin-dice-color') as HTMLInputElement).value,
                  }
                  formData.append('diceConfig', JSON.stringify(diceConfig))
                } else if (skinType === 'checkers') {
                  const checkersConfig = {
                    whiteColor: (document.getElementById('skin-checkers-white-color') as HTMLInputElement).value,
                    blackColor: (document.getElementById('skin-checkers-black-color') as HTMLInputElement).value,
                  }
                  formData.append('checkersConfig', JSON.stringify(checkersConfig))
                }
                
                // Изображения больше не используются - только материалы (цвета)
                
                // Текстуры больше не используются - только материалы (цвета)

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
                  // Очистить поля конфигураций
                  const configBoard = document.getElementById('skin-config-board') as HTMLElement
                  const configDice = document.getElementById('skin-config-dice') as HTMLElement
                  const configCheckers = document.getElementById('skin-config-checkers') as HTMLElement
                  if (configBoard) configBoard.style.display = 'none'
                  if (configDice) configDice.style.display = 'none'
                  if (configCheckers) configCheckers.style.display = 'none'
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
                        <div className="btn-group">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingQuest({ ...quest })}
                          >
                            Редактировать
                          </button>
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
                        </div>
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
                  <label>Тип квеста:</label>
                  <select id="quest-type">
                    <option value="daily">Ежедневный</option>
                    <option value="weekly">Еженедельный</option>
                    <option value="special">Особый</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Категория (для мини-квестов с текстом):</label>
                  <select id="quest-category">
                    <option value="">Обычный квест</option>
                    <option value="course">Курс (мини-квест с текстом)</option>
                    <option value="onboarding">Онбординг (мини-квест с текстом)</option>
                  </select>
                  <small style={{ color: '#999', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    Мини-квесты с текстом - это квесты с описанием, которые можно привязать к курсу или онбордингу
                  </small>
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
                <div className="form-group">
                  <label>Награда - ID скина (опционально):</label>
                  <input type="text" placeholder="UUID скина" id="quest-reward-skin" />
                  <small style={{ color: '#999', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    Можно указать ID скина из раздела "Скины" для награды скином
                  </small>
                </div>
                <div className="form-group">
                  <label>Награда - ID статьи (опционально):</label>
                  <input type="text" placeholder="UUID статьи" id="quest-reward-article" />
                  <small style={{ color: '#999', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    Можно указать ID статьи из раздела "Обучение" для награды статьей
                  </small>
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

                    // Если указана награда скином, добавляем rewardSkin
                    const rewardSkinId = (document.getElementById('quest-reward-skin') as HTMLInputElement).value
                    if (rewardSkinId && rewardSkinId.trim()) {
                      questData.rewardSkin = { id: rewardSkinId.trim() }
                    }

                    // Если указана награда статьей, добавляем rewardArticle
                    const rewardArticleId = (document.getElementById('quest-reward-article') as HTMLInputElement).value
                    if (rewardArticleId && rewardArticleId.trim()) {
                      questData.rewardArticle = { id: rewardArticleId.trim() }
                    }

                    // Добавляем категорию (для мини-квестов с текстом)
                    const category = (document.getElementById('quest-category') as HTMLSelectElement).value
                    if (category) {
                      questData.category = category
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


            {/* Управление районами */}
            <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '2px solid #3a3a3a' }}>
              <h3>Управление районами</h3>
              
              {/* Форма создания нового района */}
              <div style={{
                background: '#2a2a2a',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
              }}>
                <h4 style={{ marginTop: 0, color: '#fff' }}>Создать новый район</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Название района</label>
                    <input
                      type="text"
                      placeholder="Название района"
                      id="new-district-name"
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
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Доступ с уровня</label>
                    <input
                      type="number"
                      placeholder="1"
                      id="new-district-required-level"
                      defaultValue={1}
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
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Описание района</label>
                    <textarea
                      placeholder="Описание района"
                      id="new-district-description"
                      rows={3}
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
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Фото района (URL)</label>
                    <input
                      type="text"
                      placeholder="/img/district_default.jpg"
                      id="new-district-image"
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
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Код района (уникальный)</label>
                    <input
                      type="text"
                      placeholder="district_1"
                      id="new-district-code"
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
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Порядок отображения</label>
                    <input
                      type="number"
                      placeholder="1"
                      id="new-district-order"
                      defaultValue={1}
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
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Доход района в день (NAR)</label>
                    <input
                      type="number"
                      placeholder="0"
                      id="new-district-income"
                      defaultValue={0}
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
                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>
                      <input type="checkbox" id="new-district-active" defaultChecked style={{ marginRight: '8px' }} />
                      Активен
                    </label>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const code = (document.getElementById('new-district-code') as HTMLInputElement).value
                      const name = (document.getElementById('new-district-name') as HTMLInputElement).value
                      if (!code || !name) {
                        alert('Заполните код и название района')
                        return
                      }
                      
                      await apiClient.post('/admin/districts', {
                        code,
                        name,
                        description: (document.getElementById('new-district-description') as HTMLTextAreaElement).value || '',
                        image: (document.getElementById('new-district-image') as HTMLInputElement).value || '',
                        order: parseInt((document.getElementById('new-district-order') as HTMLInputElement).value) || 1,
                        requiredLevel: parseInt((document.getElementById('new-district-required-level') as HTMLInputElement).value) || 1,
                        baseIncomePerDay: parseInt((document.getElementById('new-district-income') as HTMLInputElement).value) || 0,
                        isActive: (document.getElementById('new-district-active') as HTMLInputElement).checked,
                      })
                      
                      alert('Район создан!')
                      loadDistricts()
                      // Очищаем форму
                      ;(document.getElementById('new-district-code') as HTMLInputElement).value = ''
                      ;(document.getElementById('new-district-name') as HTMLInputElement).value = ''
                      ;(document.getElementById('new-district-description') as HTMLTextAreaElement).value = ''
                      ;(document.getElementById('new-district-order') as HTMLInputElement).value = '1'
                      ;(document.getElementById('new-district-required-level') as HTMLInputElement).value = '1'
                      ;(document.getElementById('new-district-income') as HTMLInputElement).value = '0'
                      ;(document.getElementById('new-district-image') as HTMLInputElement).value = ''
                      ;(document.getElementById('new-district-active') as HTMLInputElement).checked = true
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
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
                  Создать район
                </button>
              </div>

              {/* Список районов */}
              <div style={{ display: 'grid', gap: '12px' }}>
                {districts.map((district) => (
                  <div
                    key={district.id}
                    style={{
                      background: '#2a2a2a',
                      padding: '16px',
                      borderRadius: '8px',
                      border: editingDistrict?.id === district.id ? '2px solid #4a90e2' : '1px solid #3a3a3a',
                    }}
                  >
                    {editingDistrict?.id === district.id ? (
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Код</label>
                            <input
                              type="text"
                              value={editingDistrict.code}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, code: e.target.value })}
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
                              value={editingDistrict.name}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, name: e.target.value })}
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
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Описание</label>
                            <textarea
                              value={editingDistrict.description || ''}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, description: e.target.value })}
                              rows={3}
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
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Порядок</label>
                            <input
                              type="number"
                              value={editingDistrict.order}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, order: parseInt(e.target.value) || 0 })}
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
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Требуемый уровень</label>
                            <input
                              type="number"
                              value={editingDistrict.requiredLevel || 1}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, requiredLevel: parseInt(e.target.value) || 1 })}
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
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Фото (URL)</label>
                            <input
                              type="text"
                              value={editingDistrict.image || ''}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, image: e.target.value })}
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
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>Доход в день (NAR)</label>
                            <input
                              type="number"
                              value={editingDistrict.baseIncomePerDay || 0}
                              onChange={(e) => setEditingDistrict({ ...editingDistrict, baseIncomePerDay: parseInt(e.target.value) || 0 })}
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
                            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc' }}>
                              <input
                                type="checkbox"
                                checked={editingDistrict.isActive}
                                onChange={(e) => setEditingDistrict({ ...editingDistrict, isActive: e.target.checked })}
                                style={{ marginRight: '8px' }}
                              />
                              Активен
                            </label>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={async () => {
                              try {
                                await apiClient.put(`/admin/districts/${district.id}`, {
                                  code: editingDistrict.code,
                                  name: editingDistrict.name,
                                  description: editingDistrict.description,
                                  order: editingDistrict.order,
                                  requiredLevel: editingDistrict.requiredLevel,
                                  baseIncomePerDay: editingDistrict.baseIncomePerDay,
                                  isActive: editingDistrict.isActive,
                                })
                                alert('Район обновлен!')
                                setEditingDistrict(null)
                                loadDistricts()
                              } catch (error: any) {
                                alert('Ошибка: ' + (error.response?.data?.message || error.message))
                              }
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
                            Сохранить
                          </button>
                          <button
                            onClick={() => setEditingDistrict(null)}
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
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                              <h4 style={{ margin: 0, color: '#fff' }}>{district.name}</h4>
                              <span style={{
                                padding: '2px 8px',
                                background: '#4a90e2',
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: '#fff',
                              }}>
                                {district.code}
                              </span>
                              {!district.isActive && (
                                <span style={{
                                  padding: '2px 8px',
                                  background: '#666',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  color: '#fff',
                                }}>
                                  Неактивен
                                </span>
                              )}
                            </div>
                            <div style={{ color: '#999', fontSize: '14px' }}>
                              {district.description && <div style={{ marginBottom: '4px' }}>{district.description}</div>}
                              <div>Порядок: {district.order} | Уровень: {district.requiredLevel || 1} | Доход: {Number(district.baseIncomePerDay || 0).toLocaleString()} NAR/день</div>
                            </div>
                            {/* Строения в этом районе */}
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #3a3a3a' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h5 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>Строения в районе:</h5>
                                <button
                                  onClick={() => {
                                    setNewBuilding({
                                      type: '',
                                      name: '',
                                      icon: '',
                                      image: '',
                                      basePrice: 0,
                                      baseIncomePerHour: 0,
                                      maxAccumulation: 0,
                                      maxLevel: 10,
                                      districtId: district.id,
                                    })
                                    const formId = `district-${district.id}-building-form`
                                    const form = document.getElementById(formId)
                                    if (form) {
                                      form.style.display = form.style.display === 'none' ? 'block' : 'none'
                                    }
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#4CAF50',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                  }}
                                >
                                  + Добавить строение
                                </button>
                              </div>
                              {/* Форма создания строения внутри района */}
                              <div id={`district-${district.id}-building-form`} style={{ display: 'none', marginBottom: '16px', padding: '12px', background: '#1a1a1a', borderRadius: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Название (города)</label>
                                    <input
                                      type="text"
                                      placeholder="Название города"
                                      id={`district-${district.id}-building-name`}
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Тип (shop, factory, etc.)</label>
                                    <input
                                      type="text"
                                      placeholder="shop, factory, etc."
                                      id={`district-${district.id}-building-type`}
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Иконка (города) URL</label>
                                    <input
                                      type="text"
                                      id={`district-${district.id}-building-icon`}
                                      placeholder="/img/building_icon.png"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Доход в час (NAR)</label>
                                    <input
                                      type="number"
                                      id={`district-${district.id}-building-income`}
                                      min="0"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Макс. накопление (NAR)</label>
                                    <input
                                      type="number"
                                      id={`district-${district.id}-building-accumulation`}
                                      min="0"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Макс. уровень</label>
                                    <input
                                      type="number"
                                      id={`district-${district.id}-building-maxlevel`}
                                      min="1"
                                      defaultValue="10"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Базовая цена (NAR)</label>
                                    <input
                                      type="number"
                                      id={`district-${district.id}-building-price`}
                                      min="0"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '12px' }}>Фото строения (URL)</label>
                                    <input
                                      type="text"
                                      id={`district-${district.id}-building-image`}
                                      placeholder="/img/building_image.jpg"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2a2a2a',
                                        border: '1px solid #444',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontSize: '12px',
                                      }}
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const type = (document.getElementById(`district-${district.id}-building-type`) as HTMLInputElement).value
                                        const name = (document.getElementById(`district-${district.id}-building-name`) as HTMLInputElement).value
                                        const price = parseInt((document.getElementById(`district-${district.id}-building-price`) as HTMLInputElement).value || '0')
                                        const income = parseInt((document.getElementById(`district-${district.id}-building-income`) as HTMLInputElement).value || '0')
                                        const accumulation = parseInt((document.getElementById(`district-${district.id}-building-accumulation`) as HTMLInputElement).value || '0')
                                        const maxLevel = parseInt((document.getElementById(`district-${district.id}-building-maxlevel`) as HTMLInputElement).value || '10')
                                        const icon = (document.getElementById(`district-${district.id}-building-icon`) as HTMLInputElement).value || ''
                                        const image = (document.getElementById(`district-${district.id}-building-image`) as HTMLInputElement).value || ''

                                        if (!type || !name) {
                                          alert('Заполните тип и название строения')
                                          return
                                        }

                                        await apiClient.post('/admin/buildings', {
                                          type,
                                          name,
                                          basePrice: price,
                                          baseIncomePerHour: income,
                                          maxAccumulation: accumulation,
                                          maxLevel,
                                          icon,
                                          image,
                                          districtId: district.id,
                                        })

                                        alert('Строение создано в районе!')
                                        loadBuildings()
                                        loadDistricts()
                                        // Скрываем форму
                                        const form = document.getElementById(`district-${district.id}-building-form`)
                                        if (form) form.style.display = 'none'
                                        // Очищаем поля
                                        ;(document.getElementById(`district-${district.id}-building-type`) as HTMLInputElement).value = ''
                                        ;(document.getElementById(`district-${district.id}-building-name`) as HTMLInputElement).value = ''
                                        ;(document.getElementById(`district-${district.id}-building-price`) as HTMLInputElement).value = ''
                                        ;(document.getElementById(`district-${district.id}-building-income`) as HTMLInputElement).value = ''
                                        ;(document.getElementById(`district-${district.id}-building-accumulation`) as HTMLInputElement).value = ''
                                        ;(document.getElementById(`district-${district.id}-building-maxlevel`) as HTMLInputElement).value = '10'
                                        ;(document.getElementById(`district-${district.id}-building-icon`) as HTMLInputElement).value = ''
                                        ;(document.getElementById(`district-${district.id}-building-image`) as HTMLInputElement).value = ''
                                      } catch (error: any) {
                                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                                      }
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#4CAF50',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                    }}
                                  >
                                    Создать строение
                                  </button>
                                  <button
                                    onClick={() => {
                                      const form = document.getElementById(`district-${district.id}-building-form`)
                                      if (form) form.style.display = 'none'
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#666',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                    }}
                                  >
                                    Отмена
                                  </button>
                                </div>
                              </div>
                              {/* Список строений в этом районе */}
                              <div>
                                {buildings.filter(b => b.districtId === district.id).length === 0 ? (
                                  <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>Нет строений в этом районе</div>
                                ) : (
                                  <div style={{ display: 'grid', gap: '8px' }}>
                                    {buildings.filter(b => b.districtId === district.id).map((building) => (
                                      <div key={building.id} style={{ padding: '8px', background: '#2a2a2a', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                          <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{building.name} ({building.type})</div>
                                          <div style={{ color: '#999', fontSize: '11px' }}>
                                            Цена: {Number(building.basePrice).toLocaleString()} NAR | Доход: {Number(building.baseIncomePerHour).toLocaleString()} NAR/час
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => setSelectedBuilding(building)}
                                          style={{
                                            padding: '4px 8px',
                                            background: '#4a90e2',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                          }}
                                        >
                                          Редактировать
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => setEditingDistrict({ ...district })}
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
                              onClick={async () => {
                                if (confirm(`Удалить район "${district.name}"?`)) {
                                  try {
                                    await apiClient.delete(`/admin/districts/${district.id}`)
                                    alert('Район удален!')
                                    loadDistricts()
                                  } catch (error: any) {
                                    alert('Ошибка: ' + (error.response?.data?.message || error.message))
                                  }
                                }
                              }}
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
                      </div>
                    )}
                  </div>
                ))}
                {districts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Нет районов</div>
                )}
              </div>
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
                  
                  // points должен быть массивом чисел (положительные = белые, отрицательные = черные)
                  let points = gameState.points || []
                  
                  // Если points это массив объектов, преобразуем в массив чисел
                  if (Array.isArray(points) && points.length > 0 && typeof points[0] === 'object') {
                    points = points.map((point: any) => {
                      if (typeof point === 'number') return point
                      // Если это объект с checkers или value
                      if (point.checkers && Array.isArray(point.checkers)) {
                        const count = point.checkers.length
                        return point.color === 'white' || point.checkers[0] === 0 ? count : -count
                      }
                      if (typeof point.value === 'number') return point.value
                      return 0
                    })
                  }
                  
                  // Убеждаемся, что points это массив из 24 элементов
                  if (!Array.isArray(points) || points.length !== 24) {
                    points = new Array(24).fill(0)
                  }
                  
                  // Нормализуем bar и bearOff
                  let bar = { white: 0, black: 0 }
                  if (Array.isArray(gameState.bar)) {
                    bar = { white: gameState.bar[0] || 0, black: gameState.bar[1] || 0 }
                  } else if (gameState.bar && typeof gameState.bar === 'object') {
                    bar = { white: gameState.bar.white || 0, black: gameState.bar.black || 0 }
                  }
                  
                  let bearOff = { white: 0, black: 0 }
                  if (Array.isArray(gameState.borneOff)) {
                    bearOff = { white: gameState.borneOff[0] || 0, black: gameState.borneOff[1] || 0 }
                  } else if (Array.isArray(gameState.bearOff)) {
                    bearOff = { white: gameState.bearOff[0] || 0, black: gameState.bearOff[1] || 0 }
                  } else if (gameState.bearOff && typeof gameState.bearOff === 'object') {
                    bearOff = { white: gameState.bearOff.white || 0, black: gameState.bearOff.black || 0 }
                  } else if (gameState.borneOff && typeof gameState.borneOff === 'object') {
                    bearOff = { white: gameState.borneOff.white || 0, black: gameState.borneOff.black || 0 }
                  }
                  
                  return {
                    ...gameState,
                    points,
                    bar,
                    bearOff,
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

      {/* РАЗДЕЛ ЦЕН */}
      {activeTab === 'prices' && (
        <div className="admin-section">
          <h2>Управление ценами</h2>
          
          {/* Цены подписок */}
          <div style={{ marginBottom: '32px' }}>
            <h3>Цены подписок (TON)</h3>
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>1 месяц</label>
                <input
                  type="number"
                  value={subscriptionPrices.month_1}
                  onChange={(e) => setSubscriptionPrices({ ...subscriptionPrices, month_1: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>3 месяца</label>
                <input
                  type="number"
                  value={subscriptionPrices.month_3}
                  onChange={(e) => setSubscriptionPrices({ ...subscriptionPrices, month_3: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>12 месяцев</label>
                <input
                  type="number"
                  value={subscriptionPrices.month_12}
                  onChange={(e) => setSubscriptionPrices({ ...subscriptionPrices, month_12: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                />
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await apiClient.put('/admin/prices/subscription', subscriptionPrices)
                  alert('Цены подписок обновлены')
                } catch (error: any) {
                  alert('Ошибка: ' + (error.response?.data?.message || error.message))
                }
              }}
              style={{ marginTop: '16px', padding: '10px 20px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Сохранить цены подписок
            </button>
          </div>

          {/* Пакеты NAR-coin */}
          <div>
            <h3>Пакеты NAR-coin</h3>
            <div style={{ marginBottom: '16px' }}>
              {narCoinPackages.map((pkg, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Количество NAR"
                    value={pkg.amount}
                    onChange={(e) => {
                      const newPackages = [...narCoinPackages]
                      newPackages[idx].amount = parseFloat(e.target.value) || 0
                      setNarCoinPackages(newPackages)
                    }}
                    style={{ flex: 1, padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                  <input
                    type="number"
                    placeholder="Цена TON"
                    value={pkg.price}
                    onChange={(e) => {
                      const newPackages = [...narCoinPackages]
                      newPackages[idx].price = parseFloat(e.target.value) || 0
                      setNarCoinPackages(newPackages)
                    }}
                    style={{ flex: 1, padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                  <button
                    onClick={() => {
                      setNarCoinPackages(narCoinPackages.filter((_, i) => i !== idx))
                    }}
                    style={{ padding: '8px 16px', background: '#ff3333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNarCoinPackages([...narCoinPackages, { amount: 0, price: 0 }])}
                style={{ padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
              >
                + Добавить пакет
              </button>
              <button
                onClick={async () => {
                  try {
                    await apiClient.put('/admin/prices/nar-coin', { packages: narCoinPackages })
                    alert('Пакеты NAR-coin обновлены')
                  } catch (error: any) {
                    alert('Ошибка: ' + (error.response?.data?.message || error.message))
                  }
                }}
                style={{ padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Сохранить пакеты
              </button>
            </div>
          </div>
        </div>
      )}

      {/* РАЗДЕЛ СИСТЕМНЫХ НАСТРОЕК */}
      {activeTab === 'system-settings' && (
        <div className="admin-section">
          <h2>Системные настройки</h2>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {Object.entries(systemSettings).map(([key, value]) => (
              <div key={key} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 600 }}>{key}</label>
                {typeof value === 'object' ? (
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setSystemSettings({ ...systemSettings, [key]: parsed })
                      } catch {
                        // Игнорируем ошибки парсинга
                      }
                    }}
                    style={{ width: '100%', minHeight: '100px', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff', fontFamily: 'monospace' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                )}
                <button
                  onClick={async () => {
                    try {
                      await apiClient.put('/admin/system-settings', { [key]: systemSettings[key] })
                      await loadSystemSettings()
                      alert('Настройка сохранена')
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
                  style={{ marginTop: '8px', padding: '6px 12px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Сохранить
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px' }}>
            <h3>Добавить новую настройку</h3>
            {editingSetting ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Ключ настройки"
                  value={editingSetting.key}
                  onChange={(e) => setEditingSetting({ ...editingSetting, key: e.target.value })}
                  style={{ flex: 1, padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                />
                <input
                  type="text"
                  placeholder="Значение"
                  value={editingSetting.value}
                  onChange={(e) => setEditingSetting({ ...editingSetting, value: e.target.value })}
                  style={{ flex: 1, padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                />
                <button
                  onClick={async () => {
                    try {
                      await apiClient.put('/admin/system-settings', { [editingSetting.key]: editingSetting.value })
                      await loadSystemSettings()
                      setEditingSetting(null)
                      alert('Настройка добавлена')
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
                  style={{ padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setEditingSetting(null)}
                  style={{ padding: '8px 16px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingSetting({ key: '', value: '' })}
                style={{ padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Добавить настройку
              </button>
            )}
          </div>
        </div>
      )}

      {/* РАЗДЕЛ ПРОГРЕССИИ */}
      {activeTab === 'progression' && progressionConfig && (
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2>Настройки прогрессии</h2>
            <button 
              className="admin-btn primary"
              onClick={handleSaveProgressionConfig}
              disabled={isSavingProgression}
            >
              {isSavingProgression ? 'Сохранение...' : '💾 Сохранить все настройки'}
            </button>
          </div>

          <div style={{ display: 'grid', gap: '32px' }}>
            {/* XP и уровни */}
            <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ color: '#4a9eff', marginBottom: '20px' }}>XP и Уровни</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <h4 style={{ marginBottom: '12px' }}>Параметры XP-кривой</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Коэффициент A (для уровня 1-5)</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xpCurve?.A || 350} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xpCurve: { ...progressionConfig.xpCurve, A: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Максимальный уровень</label>
                    <input 
                      type="number" 
                      value={progressionConfig.maxLevel || 50} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        maxLevel: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '12px' }}>Базовый XP</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>PvP рейтинговый</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xp.baseXp.pvpRanked} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, baseXp: { ...progressionConfig.xp.baseXp, pvpRanked: parseInt(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>PvP Баталия (на NAR)</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xp.baseXp.pvpBatalia} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, baseXp: { ...progressionConfig.xp.baseXp, pvpBatalia: parseInt(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Турнир</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xp.baseXp.tournament} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, baseXp: { ...progressionConfig.xp.baseXp, tournament: parseInt(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Дружеский матч</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xp.baseXp.friendly} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, baseXp: { ...progressionConfig.xp.baseXp, friendly: parseInt(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>vs AI</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xp.baseXp.ai} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, baseXp: { ...progressionConfig.xp.baseXp, ai: parseInt(e.target.value) || 0 } }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '12px' }}>Множители</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Победа</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.multipliers.win} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, win: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Поражение</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.multipliers.loss} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, loss: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Марс (разгром)</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.multipliers.marsWin} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, marsWin: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Кап XP (множитель от базы)</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.caps.maxMatchXpMult} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, caps: { ...progressionConfig.xp.caps, maxMatchXpMult: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '12px' }}>Анти-фарм (повторы)</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {progressionConfig.xp.multipliers.repeatOpponent.map((mult: number, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '12px', color: '#aaa', minWidth: '60px' }}>Игра {idx + 1}</label>
                        <input 
                          type="number" step="0.01"
                          value={mult} 
                          style={{ flex: 1, padding: '4px' }}
                          onChange={(e) => {
                            const newRepeat = [...progressionConfig.xp.multipliers.repeatOpponent];
                            newRepeat[idx] = parseFloat(e.target.value) || 0;
                            setProgressionConfig({
                              ...progressionConfig,
                              xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, repeatOpponent: newRepeat } }
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '12px' }}>Skill Points (SP)</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>За уровни 2-5</label>
                    <input 
                      type="number" 
                      value={progressionConfig.skillPoints.levels2To5} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        skillPoints: { ...progressionConfig.skillPoints, levels2To5: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>За уровни 6-50</label>
                    <input 
                      type="number" 
                      value={progressionConfig.skillPoints.levels6To50} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        skillPoints: { ...progressionConfig.skillPoints, levels6To50: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '32px' }}>
                <h4 style={{ marginBottom: '16px' }}>Пороги XP для уровней (Total XP)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                  {Object.entries(progressionConfig.xp.thresholds).map(([level, xp]: [any, any]) => (
                    <div key={level}>
                      <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Уровень {level}</label>
                      <input 
                        type="number" 
                        value={xp} 
                        style={{ width: '100%', fontSize: '13px', padding: '6px' }}
                        onChange={(e) => {
                          const newThresholds = { ...progressionConfig.xp.thresholds };
                          newThresholds[level] = parseInt(e.target.value) || 0;
                          setProgressionConfig({
                            ...progressionConfig,
                            xp: { ...progressionConfig.xp, thresholds: newThresholds }
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '32px' }}>
                <h4 style={{ marginBottom: '16px' }}>Награды NAR за повышение уровня</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                  {progressionConfig.levelRewards && Object.entries(progressionConfig.levelRewards).map(([level, reward]: [any, any]) => (
                    <div key={level}>
                      <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Уровень {level}</label>
                      <input 
                        type="number" 
                        value={reward} 
                        style={{ width: '100%', fontSize: '13px', padding: '6px' }}
                        onChange={(e) => {
                          const newRewards = { ...progressionConfig.levelRewards };
                          newRewards[level] = parseInt(e.target.value) || 0;
                          setProgressionConfig({
                            ...progressionConfig,
                            levelRewards: newRewards
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ветки прокачки */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Экономика */}
              <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
                <h3 style={{ color: '#4caf50', marginBottom: '20px' }}>Ветка: Экономика</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Шаг 1 (SP)</label>
                      <input type="number" value={progressionConfig.economyBranch.step1Sp} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, step1Sp: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. 1</label>
                      <input type="number" step="0.0001" value={progressionConfig.economyBranch.step1K} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, step1K: parseFloat(e.target.value) || 0 }})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Шаг 2 (SP)</label>
                      <input type="number" value={progressionConfig.economyBranch.step2Sp} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, step2Sp: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. 2</label>
                      <input type="number" step="0.0001" value={progressionConfig.economyBranch.step2K} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, step2K: parseFloat(e.target.value) || 0 }})} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Макс. снижение комиссии (0.08 = 8%)</label>
                    <input type="number" step="0.01" value={progressionConfig.economyBranch.reductionCap} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, reductionCap: parseFloat(e.target.value) || 0 }})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. пассива</label>
                      <input type="number" step="0.001" value={progressionConfig.economyBranch.passiveK} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, passiveK: parseFloat(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Кап пассива (SP)</label>
                      <input type="number" value={progressionConfig.economyBranch.passiveSpCap} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, economyBranch: { ...progressionConfig.economyBranch, passiveSpCap: parseInt(e.target.value) || 0 }})} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Энергия */}
              <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
                <h3 style={{ color: '#ffeb3b', marginBottom: '20px' }}>Ветка: Энергия</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>База макс</label>
                      <input type="number" value={progressionConfig.energyBranch.baseMax} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, baseMax: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Шаг 1 (SP)</label>
                      <input type="number" value={progressionConfig.energyBranch.maxStep1Sp} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, maxStep1Sp: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. 1</label>
                      <input type="number" value={progressionConfig.energyBranch.maxStep1K} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, maxStep1K: parseInt(e.target.value) || 0 }})} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. 2 (после шага 1)</label>
                    <input type="number" value={progressionConfig.energyBranch.maxStep2K} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, maxStep2K: parseInt(e.target.value) || 0 }})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Реген база/ч</label>
                      <input type="number" value={progressionConfig.energyBranch.regenBasePerH} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, regenBasePerH: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Реген Шаг 1</label>
                      <input type="number" value={progressionConfig.energyBranch.regenStep1Sp} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, regenStep1Sp: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Реген Коэф 1</label>
                      <input type="number" step="0.1" value={progressionConfig.energyBranch.regenStep1K} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, regenStep1K: parseFloat(e.target.value) || 0 }})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Восполнение</label>
                      <input type="number" value={progressionConfig.energyBranch.refill.amount} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, refill: { ...progressionConfig.energyBranch.refill, amount: parseInt(e.target.value) || 0 } }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Баз. цена (NAR)</label>
                      <input type="number" value={progressionConfig.energyBranch.refill.baseCostNar} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, refill: { ...progressionConfig.energyBranch.refill, baseCostNar: parseInt(e.target.value) || 0 } }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Рост цены</label>
                      <input type="number" step="0.01" value={progressionConfig.energyBranch.refill.growth} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, energyBranch: { ...progressionConfig.energyBranch, refill: { ...progressionConfig.energyBranch.refill, growth: parseFloat(e.target.value) || 0 } }})} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Жизни */}
              <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
                <h3 style={{ color: '#f44336', marginBottom: '20px' }}>Ветка: Жизни</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>База макс</label>
                      <input type="number" value={progressionConfig.livesBranch.baseMax} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, baseMax: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Шаг 1 (SP)</label>
                      <input type="number" value={progressionConfig.livesBranch.maxStep1Sp} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, maxStep1Sp: parseInt(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. 1</label>
                      <input type="number" value={progressionConfig.livesBranch.maxStep1K} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, maxStep1K: parseInt(e.target.value) || 0 }})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Защита кап (%)</label>
                      <input type="number" step="0.01" value={progressionConfig.livesBranch.lifeLossProtectCap} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, lifeLossProtectCap: parseFloat(e.target.value) || 0 }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Защита кап (SP)</label>
                      <input type="number" value={progressionConfig.livesBranch.lifeLossProtectSpCap} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, lifeLossProtectSpCap: parseInt(e.target.value) || 0 }})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Восполнение</label>
                      <input type="number" value={progressionConfig.livesBranch.refill.amount} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, refill: { ...progressionConfig.livesBranch.refill, amount: parseInt(e.target.value) || 0 } }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Баз. цена (NAR)</label>
                      <input type="number" value={progressionConfig.livesBranch.refill.baseCostNar} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, refill: { ...progressionConfig.livesBranch.refill, baseCostNar: parseInt(e.target.value) || 0 } }})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', color: '#aaa' }}>Рост цены</label>
                      <input type="number" step="0.01" value={progressionConfig.livesBranch.refill.growth} 
                        onChange={(e) => setProgressionConfig({...progressionConfig, livesBranch: { ...progressionConfig.livesBranch, refill: { ...progressionConfig.livesBranch.refill, growth: parseFloat(e.target.value) || 0 } }})} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Сила */}
              <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
                <h3 style={{ color: '#9c27b0', marginBottom: '20px' }}>Ветка: Сила</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Базовый вес</label>
                    <input type="number" value={progressionConfig.powerBranch.weightBase} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, powerBranch: { ...progressionConfig.powerBranch, weightBase: parseInt(e.target.value) || 0 }})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Коэф. веса (на SP)</label>
                    <input type="number" step="0.1" value={progressionConfig.powerBranch.weightK} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, powerBranch: { ...progressionConfig.powerBranch, weightK: parseFloat(e.target.value) || 0 }})} />
                  </div>
                </div>
              </div>
            </div>

            {/* Прочее */}
            <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ color: '#aaa', marginBottom: '20px' }}>Прочие параметры</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '12px' }}>Лицензия предпринимателя</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Требуемый уровень</label>
                    <input type="number" value={progressionConfig.license.requiredLevel} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, license: { ...progressionConfig.license, requiredLevel: parseInt(e.target.value) || 0 }})} />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Стоимость (NAR)</label>
                    <input type="number" value={progressionConfig.license.costNar} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, license: { ...progressionConfig.license, costNar: parseInt(e.target.value) || 0 }})} />
                  </div>
                </div>
                <div>
                  <h4 style={{ marginBottom: '12px' }}>Комиссия системы</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Базовая комиссия (0.15 = 15%)</label>
                    <input type="number" step="0.01" value={progressionConfig.commission.base} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, commission: { ...progressionConfig.commission, base: parseFloat(e.target.value) || 0 }})} />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Абсолютный минимум (0.05 = 5%)</label>
                    <input type="number" step="0.01" value={progressionConfig.commission.min} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, commission: { ...progressionConfig.commission, min: parseFloat(e.target.value) || 0 }})} />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Мин. от статов (0.07 = 7%)</label>
                    <input type="number" step="0.01" value={progressionConfig.commission.statsMin} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, commission: { ...progressionConfig.commission, statsMin: parseFloat(e.target.value) || 0 }})} />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Кап бонуса вещей (0.02 = 2%)</label>
                    <input type="number" step="0.01" value={progressionConfig.commission.gearBonusCap} 
                      onChange={(e) => setProgressionConfig({...progressionConfig, commission: { ...progressionConfig.commission, gearBonusCap: parseFloat(e.target.value) || 0 }})} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && paymentStats && (
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2>Статистика платежей</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#2a2a2a', padding: '12px 20px', borderRadius: '12px' }}>
              <label style={{ color: '#aaa', fontSize: '14px' }}>Курс 1 TON =</label>
              <input 
                type="number" 
                value={systemSettings.ton_exchange_rate || 1000} 
                style={{ width: '100px', textAlign: 'center' }}
                onChange={(e) => {
                  setSystemSettings({ ...systemSettings, ton_exchange_rate: parseInt(e.target.value) || 0 })
                }}
              />
              <span style={{ color: '#aaa', fontSize: '14px' }}>NAR</span>
              <button 
                className="admin-btn primary" 
                style={{ marginLeft: '12px' }}
                onClick={() => handleUpdateSystemSettings({ ton_exchange_rate: systemSettings.ton_exchange_rate })}
              >
                💾
              </button>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: '32px' }}>
            <div className="stat-card">
              <h3>Итоги (Completed)</h3>
              <div className="stat-value">
                {paymentStats.summary
                  .filter((s: any) => s.status === 'completed')
                  .reduce((acc: number, s: any) => acc + s.totalAmount, 0)
                  .toFixed(2)} TON
              </div>
              <div className="stat-details">
                {paymentStats.summary.map((s: any) => (
                  <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.status.toUpperCase()}:</span>
                    <span>{s.count} ({s.totalAmount.toFixed(2)} TON)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="stat-card">
              <h3>По методам</h3>
              <div className="stat-details">
                {paymentStats.byMethod.map((m: any) => (
                  <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{m.method.toUpperCase()}:</span>
                    <span>{m.count} транз. ({m.totalAmount.toFixed(2)} {m.method.toUpperCase()})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="stat-card">
              <h3>По типам</h3>
              <div className="stat-details">
                {paymentStats.byType.map((t: any) => (
                  <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{t.type === 'nar_coin' ? 'Покупка NAR' : 'Подписка'}:</span>
                    <span>{t.count} транз. ({t.totalAmount.toFixed(2)} TON)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px', marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '20px' }}>Статистика по кошелькам получателям</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Адрес кошелька</th>
                    <th>Кол-во транзакций</th>
                    <th>Сумма (TON)</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentStats.byWallet.map((w: any) => (
                    <tr key={w.address}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{w.address}</td>
                      <td>{w.count}</td>
                      <td style={{ fontWeight: 'bold', color: '#4caf50' }}>{w.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '20px' }}>Последние 50 транзакций</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID / Дата</th>
                    <th>Пользователь</th>
                    <th>Тип / Метод</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentStats.transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>{tx.id.substring(0, 8)}...</div>
                        <div>{new Date(tx.createdAt).toLocaleString()}</div>
                      </td>
                      <td>
                        {tx.user ? (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{tx.user.nickname || tx.user.username}</div>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>{tx.user.id.substring(0, 8)}...</div>
                          </>
                        ) : (
                          <span style={{ color: '#666' }}>Удален</span>
                        )}
                      </td>
                      <td>
                        <div>{tx.type === 'nar_coin' ? '💰 NAR' : '💎 Sub'}</div>
                        <div style={{ fontSize: '12px', color: '#aaa' }}>{tx.method.toUpperCase()}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 'bold', color: tx.status === 'completed' ? '#4caf50' : '#aaa' }}>
                          {tx.amount.toFixed(2)} {tx.method.toUpperCase()}
                        </div>
                        {tx.type === 'nar_coin' && tx.metadata?.narAmount && (
                          <div style={{ fontSize: '11px', color: '#aaa' }}>
                            ≈ {tx.metadata.narAmount.toLocaleString()} NAR
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${tx.status}`}>
                          {tx.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <div><span style={{ color: '#aaa' }}>To:</span> {tx.toAddress.substring(0, 8)}...</div>
                          {tx.txHash && <div><span style={{ color: '#aaa' }}>Hash:</span> {tx.txHash.substring(0, 8)}...</div>}
                          {tx.comment && <div><span style={{ color: '#aaa' }}>Comm:</span> {tx.comment}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЯ */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Редактирование пользователя: {editingUser.nickname || editingUser.username}</h3>
              <button className="admin-modal-close" onClick={() => setEditingUser(null)}>×</button>
            </div>
            <div className="admin-modal-content">
              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div>
                  <label>NAR-coin</label>
                  <input
                    type="number"
                    value={Number(editingUser.narCoin || 0)}
                    onChange={(e) => setEditingUser({ ...editingUser, narCoin: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>XP</label>
                  <input
                    type="number"
                    value={Number(editingUser.xp || 0)}
                    onChange={(e) => setEditingUser({ ...editingUser, xp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Уровень</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editingUser.level || 1}
                    onChange={(e) => setEditingUser({ ...editingUser, level: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label>Энергия</label>
                  <input
                    type="number"
                    value={editingUser.energy || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, energy: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Макс. энергия</label>
                  <input
                    type="number"
                    value={editingUser.maxEnergy || 100}
                    onChange={(e) => setEditingUser({ ...editingUser, maxEnergy: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div>
                  <label>Жизни</label>
                  <input
                    type="number"
                    value={editingUser.lives || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, lives: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Макс. жизни</label>
                  <input
                    type="number"
                    value={editingUser.maxLives || 100}
                    onChange={(e) => setEditingUser({ ...editingUser, maxLives: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div>
                  <label>Skill Points (всего)</label>
                  <input
                    type="number"
                    value={editingUser.skillPoints || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, skillPoints: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Свободные SP</label>
                  <input
                    type="number"
                    value={editingUser.freeSkillPoints || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, freeSkillPoints: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>SP Экономика</label>
                  <input
                    type="number"
                    value={editingUser.economySp || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, economySp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>SP Энергия</label>
                  <input
                    type="number"
                    value={editingUser.energySp || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, energySp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>SP Жизни</label>
                  <input
                    type="number"
                    value={editingUser.livesSp || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, livesSp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>SP Сила</label>
                  <input
                    type="number"
                    value={editingUser.powerSp || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, powerSp: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={editingUser.hasBusinessLicense || false}
                      onChange={(e) => setEditingUser({ ...editingUser, hasBusinessLicense: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    Лицензия предпринимателя
                  </label>
                </div>
                <div>
                  <label>Реферальный процент (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingUser.referralPercent || 5}
                    onChange={(e) => setEditingUser({ ...editingUser, referralPercent: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <div>
                  <label>Базовый реферальный бонус (NAR)</label>
                  <input
                    type="number"
                    min="0"
                    value={Number(editingUser.referralBaseBonus || 100)}
                    onChange={(e) => setEditingUser({ ...editingUser, referralBaseBonus: parseInt(e.target.value) || 100 })}
                  />
                </div>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingUser(null)}
                  style={{ padding: '10px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Используем отдельные эндпоинты для каждого раздела
                      const promises = []

                      // Экономика (NAR, XP, Level) - проверяем что значение изменилось или определено
                      const economyData: any = {}
                      if (editingUser.narCoin !== undefined) economyData.narCoin = Number(editingUser.narCoin)
                      if (editingUser.xp !== undefined) economyData.xp = Number(editingUser.xp)
                      if (editingUser.level !== undefined) economyData.level = editingUser.level
                      if (Object.keys(economyData).length > 0) {
                        promises.push(
                          apiClient.put(`/admin/users/${editingUser.id}/economy`, economyData)
                            .catch(err => ({ error: err.response?.data?.message || err.message, section: 'economy' }))
                        )
                      }

                      // Энергия
                      const energyData: any = {}
                      if (editingUser.energy !== undefined) energyData.energy = editingUser.energy
                      if (editingUser.maxEnergy !== undefined) energyData.maxEnergy = editingUser.maxEnergy
                      if (Object.keys(energyData).length > 0) {
                        promises.push(
                          apiClient.put(`/admin/users/${editingUser.id}/energy`, energyData)
                            .catch(err => ({ error: err.response?.data?.message || err.message, section: 'energy' }))
                        )
                      }

                      // Жизни
                      const livesData: any = {}
                      if (editingUser.lives !== undefined) livesData.lives = editingUser.lives
                      if (editingUser.maxLives !== undefined) livesData.maxLives = editingUser.maxLives
                      if (Object.keys(livesData).length > 0) {
                        promises.push(
                          apiClient.put(`/admin/users/${editingUser.id}/lives`, livesData)
                            .catch(err => ({ error: err.response?.data?.message || err.message, section: 'lives' }))
                        )
                      }

                      // Skill Points
                      const skillPointsData: any = {}
                      if (editingUser.skillPoints !== undefined) skillPointsData.skillPoints = editingUser.skillPoints
                      if (editingUser.freeSkillPoints !== undefined) skillPointsData.freeSkillPoints = editingUser.freeSkillPoints
                      if (editingUser.economySp !== undefined) skillPointsData.economySp = editingUser.economySp
                      if (editingUser.energySp !== undefined) skillPointsData.energySp = editingUser.energySp
                      if (editingUser.livesSp !== undefined) skillPointsData.livesSp = editingUser.livesSp
                      if (editingUser.powerSp !== undefined) skillPointsData.powerSp = editingUser.powerSp
                      if (Object.keys(skillPointsData).length > 0) {
                        promises.push(
                          apiClient.put(`/admin/users/${editingUser.id}/skill-points`, skillPointsData)
                            .catch(err => ({ error: err.response?.data?.message || err.message, section: 'skill-points' }))
                        )
                      }

                      // Лицензия
                      if (editingUser.hasBusinessLicense !== undefined) {
                        promises.push(
                          apiClient.put(`/admin/users/${editingUser.id}/business-license`, {
                            hasBusinessLicense: editingUser.hasBusinessLicense,
                          }).catch(err => ({ error: err.response?.data?.message || err.message, section: 'business-license' }))
                        )
                      }

                      // Реферальная программа
                      const referralData: any = {}
                      if (editingUser.referralPercent !== undefined) referralData.referralPercent = editingUser.referralPercent
                      if (editingUser.referralBaseBonus !== undefined) referralData.referralBaseBonus = Number(editingUser.referralBaseBonus)
                      if (Object.keys(referralData).length > 0) {
                        promises.push(
                          apiClient.put(`/admin/users/${editingUser.id}/referral`, referralData)
                            .catch(err => ({ error: err.response?.data?.message || err.message, section: 'referral' }))
                        )
                      }

                      // Выполняем все запросы параллельно
                      const results = await Promise.all(promises)
                      
                      // Проверяем ошибки
                      const errors = results.filter(r => r && r.error)
                      if (errors.length > 0) {
                        const errorMessages = errors.map(e => `${e.section}: ${e.error}`).join('\n')
                        alert('Ошибки при сохранении:\n' + errorMessages)
                        return
                      }

                      alert('Пользователь обновлен')
                      setEditingUser(null)
                      await loadStats()
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
                  style={{ padding: '10px 20px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Сохранить все изменения
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ СКИНА */}
      {editingSkin && (
        <div className="admin-modal-overlay" onClick={() => setEditingSkin(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="admin-modal-header">
              <h3>Редактирование скина: {editingSkin.name}</h3>
              <button className="admin-modal-close" onClick={() => setEditingSkin(null)}>×</button>
            </div>
            <div className="admin-modal-content">
              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div>
                  <label>Название</label>
                  <input
                    type="text"
                    value={editingSkin.name || ''}
                    onChange={(e) => setEditingSkin({ ...editingSkin, name: e.target.value })}
                  />
                </div>
                <div>
                  <label>Тип (нельзя изменить)</label>
                  <input
                    type="text"
                    value={editingSkin.type || ''}
                    disabled
                    style={{ opacity: 0.5 }}
                  />
                </div>
                <div>
                  <label>Тема</label>
                  <input
                    type="text"
                    value={editingSkin.theme || ''}
                    onChange={(e) => setEditingSkin({ ...editingSkin, theme: e.target.value })}
                  />
                </div>
                <div>
                  <label>Описание</label>
                  <input
                    type="text"
                    value={editingSkin.description || ''}
                    onChange={(e) => setEditingSkin({ ...editingSkin, description: e.target.value })}
                  />
                </div>
                <div>
                  <label>Цена (NAR-coin, 0 = бесплатно)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSkin.price || 0}
                    onChange={(e) => setEditingSkin({ ...editingSkin, price: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Вес</label>
                  <input
                    type="number"
                    min="1"
                    value={editingSkin.weight || 1}
                    onChange={(e) => setEditingSkin({ ...editingSkin, weight: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label>Редкость</label>
                  <select
                    value={editingSkin.rarity || 'common'}
                    onChange={(e) => setEditingSkin({ ...editingSkin, rarity: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  >
                    <option value="common">Обычный</option>
                    <option value="rare">Редкий</option>
                    <option value="epic">Эпический</option>
                    <option value="legendary">Легендарный</option>
                  </select>
                </div>
                <div>
                  <label>Макс. прочность</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSkin.maxDurability || 100}
                    onChange={(e) => setEditingSkin({ ...editingSkin, maxDurability: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div>
                  <label>Бонус XP (%)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSkin.xpBonusPercent || 0}
                    onChange={(e) => setEditingSkin({ ...editingSkin, xpBonusPercent: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Бонус денег (%)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSkin.moneyBonusPercent || 0}
                    onChange={(e) => setEditingSkin({ ...editingSkin, moneyBonusPercent: parseInt(e.target.value) || 0 })}
                  />
                </div>
                {/* Поля для конфигураций материалов (цветов) */}
                {editingSkin.type === 'board' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ marginBottom: '8px', display: 'block', fontSize: '14px', fontWeight: 'bold' }}>Конфигурация доски (цвета материалов):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Фон доски:</label>
                        <input 
                          type="color" 
                          value={editingSkin.boardConfig?.backgroundColor || '#8B4513'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            boardConfig: { 
                              ...(editingSkin.boardConfig || {}), 
                              backgroundColor: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Светлый треугольник:</label>
                        <input 
                          type="color" 
                          value={editingSkin.boardConfig?.triangleColor1 || '#D4A574'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            boardConfig: { 
                              ...(editingSkin.boardConfig || {}), 
                              triangleColor1: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Темный треугольник:</label>
                        <input 
                          type="color" 
                          value={editingSkin.boardConfig?.triangleColor2 || '#8B4513'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            boardConfig: { 
                              ...(editingSkin.boardConfig || {}), 
                              triangleColor2: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет границы:</label>
                        <input 
                          type="color" 
                          value={editingSkin.boardConfig?.borderColor || '#5c3a21'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            boardConfig: { 
                              ...(editingSkin.boardConfig || {}), 
                              borderColor: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет оконтовки (бар):</label>
                        <input 
                          type="color" 
                          value={editingSkin.boardConfig?.outlineColor || '#654321'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            boardConfig: { 
                              ...(editingSkin.boardConfig || {}), 
                              outlineColor: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
                {editingSkin.type === 'dice' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ marginBottom: '8px', display: 'block', fontSize: '14px', fontWeight: 'bold' }}>Конфигурация кубиков (цвет материалов):</label>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет кубика:</label>
                      <input 
                        type="color" 
                        value={editingSkin.diceConfig?.color || '#FFFFFF'}
                        onChange={(e) => setEditingSkin({ 
                          ...editingSkin, 
                          diceConfig: { 
                            ...(editingSkin.diceConfig || {}), 
                            color: e.target.value 
                          } 
                        })}
                        style={{ width: '100%', height: '40px' }} 
                      />
                    </div>
                  </div>
                )}
                {editingSkin.type === 'checkers' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ marginBottom: '8px', display: 'block', fontSize: '14px', fontWeight: 'bold' }}>Конфигурация шашек (цвета материалов):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет белых шашек:</label>
                        <input 
                          type="color" 
                          value={editingSkin.checkersConfig?.whiteColor || '#F0F0F0'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            checkersConfig: { 
                              ...(editingSkin.checkersConfig || {}), 
                              whiteColor: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет черных шашек:</label>
                        <input 
                          type="color" 
                          value={editingSkin.checkersConfig?.blackColor || '#333333'}
                          onChange={(e) => setEditingSkin({ 
                            ...editingSkin, 
                            checkersConfig: { 
                              ...(editingSkin.checkersConfig || {}), 
                              blackColor: e.target.value 
                            } 
                          })}
                          style={{ width: '100%', height: '40px' }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={editingSkin.isPremium || false}
                      onChange={(e) => setEditingSkin({ ...editingSkin, isPremium: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    Премиум
                  </label>
                </div>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={editingSkin.isDefault || false}
                      onChange={(e) => setEditingSkin({ ...editingSkin, isDefault: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    По умолчанию
                  </label>
                </div>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingSkin(null)}
                  style={{ padding: '10px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    try {
                      await apiClient.put(`/admin/skins/${editingSkin.id}`, editingSkin)
                      alert('Скин обновлен')
                      setEditingSkin(null)
                      await loadStats()
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
                  style={{ padding: '10px 20px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ СТРОЕНИЯ */}
      {selectedBuilding && (
        <div className="admin-modal-overlay" onClick={() => setSelectedBuilding(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Редактирование строения: {selectedBuilding.name}</h3>
              <button className="admin-modal-close" onClick={() => setSelectedBuilding(null)}>×</button>
            </div>
            <div className="admin-modal-content">
              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div>
                  <label>Название</label>
                  <input
                    type="text"
                    value={selectedBuilding.name || ''}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, name: e.target.value })}
                  />
                </div>
                <div>
                  <label>Тип (shop, factory, etc.)</label>
                  <input
                    type="text"
                    value={selectedBuilding.type || ''}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, type: e.target.value })}
                  />
                </div>
                <div>
                  <label>Доход в час (NAR)</label>
                  <input
                    type="number"
                    value={selectedBuilding.baseIncomePerHour || 0}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, baseIncomePerHour: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Базовая цена (NAR)</label>
                  <input
                    type="number"
                    value={selectedBuilding.basePrice || 0}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, basePrice: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Макс. накопление (NAR)</label>
                  <input
                    type="number"
                    value={selectedBuilding.maxAccumulation || 0}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, maxAccumulation: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Макс. уровень</label>
                  <input
                    type="number"
                    value={selectedBuilding.maxLevel || 10}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, maxLevel: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div>
                  <label>Множитель улучшения</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedBuilding.upgradeMultiplier || 1.4}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, upgradeMultiplier: parseFloat(e.target.value) || 1.4 })}
                  />
                </div>
                <div>
                  <label>Район (ID)</label>
                  <select
                    value={selectedBuilding.districtId || ''}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, districtId: e.target.value })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  >
                    <option value="">Без района</option>
                    {districts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Иконка (URL)</label>
                  <input
                    type="text"
                    value={selectedBuilding.icon || ''}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, icon: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Фото строения (URL)</label>
                  <input
                    type="text"
                    value={selectedBuilding.image || ''}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, image: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (confirm(`Удалить конфигурацию строения "${selectedBuilding.name}"? Это удалит все такие строения у игроков!`)) {
                      try {
                        await apiClient.delete(`/admin/buildings/${selectedBuilding.id}`)
                        alert('Конфигурация удалена')
                        setSelectedBuilding(null)
                        loadBuildings()
                        loadDistricts()
                      } catch (error: any) {
                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                      }
                    }
                  }}
                  style={{ marginRight: 'auto' }}
                >
                  Удалить
                </button>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  style={{ padding: '10px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    try {
                      await apiClient.put(`/admin/buildings/${selectedBuilding.id}`, {
                        ...selectedBuilding,
                        basePrice: Number(selectedBuilding.basePrice),
                        baseIncomePerHour: Number(selectedBuilding.baseIncomePerHour),
                        maxAccumulation: Number(selectedBuilding.maxAccumulation),
                      })
                      alert('Строение обновлено')
                      setSelectedBuilding(null)
                      loadBuildings()
                      loadDistricts()
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
                  style={{ padding: '10px 20px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ КВЕСТА */}
      {editingQuest && (
        <div className="admin-modal-overlay" onClick={() => setEditingQuest(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="admin-modal-header">
              <h3>Редактирование квеста: {editingQuest.name}</h3>
              <button className="admin-modal-close" onClick={() => setEditingQuest(null)}>×</button>
            </div>
            <div className="admin-modal-content">
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label>Название</label>
                  <input
                    type="text"
                    value={editingQuest.name || ''}
                    onChange={(e) => setEditingQuest({ ...editingQuest, name: e.target.value })}
                  />
                </div>
                <div>
                  <label>Описание</label>
                  <textarea
                    value={editingQuest.description || ''}
                    onChange={(e) => setEditingQuest({ ...editingQuest, description: e.target.value })}
                    style={{ minHeight: '80px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label>Тип</label>
                    <select
                      value={editingQuest.type || 'daily'}
                      onChange={(e) => setEditingQuest({ ...editingQuest, type: e.target.value })}
                      style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                    >
                      <option value="daily">Ежедневный</option>
                      <option value="weekly">Еженедельный</option>
                      <option value="special">Особый</option>
                    </select>
                  </div>
                  <div>
                    <label>Цель</label>
                    <select
                      value={editingQuest.target || 'play_matches'}
                      onChange={(e) => setEditingQuest({ ...editingQuest, target: e.target.value })}
                      style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                    >
                      <option value="play_matches">Играть матчи</option>
                      <option value="win_streak">Серия побед</option>
                      <option value="collect_income">Собрать доход</option>
                      <option value="tournament">Турнир</option>
                      <option value="subscribe_channel">Подписка на канал</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label>Целевое значение</label>
                    <input
                      type="number"
                      min="1"
                      value={editingQuest.targetValue || 1}
                      onChange={(e) => setEditingQuest({ ...editingQuest, targetValue: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label>Канал (username, например @channel)</label>
                    <input
                      type="text"
                      value={editingQuest.channelUsername || ''}
                      onChange={(e) => setEditingQuest({ ...editingQuest, channelUsername: e.target.value })}
                      placeholder="@channelname"
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label>Награда NAR-coin</label>
                    <input
                      type="number"
                      min="0"
                      value={Number(editingQuest.rewardNarCoin || 0)}
                      onChange={(e) => setEditingQuest({ ...editingQuest, rewardNarCoin: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label>Награда XP</label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuest.rewardXP || 0}
                      onChange={(e) => setEditingQuest({ ...editingQuest, rewardXP: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label>Награда: ID скина (опционально)</label>
                    <input
                      type="text"
                      value={typeof editingQuest.rewardSkin === 'object' && editingQuest.rewardSkin?.id ? editingQuest.rewardSkin.id : (editingQuest.rewardSkin || '')}
                      onChange={(e) => setEditingQuest({ ...editingQuest, rewardSkin: e.target.value || null })}
                      placeholder="UUID скина"
                    />
                  </div>
                  <div>
                    <label>Награда: Билеты на турнир</label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuest.rewardTickets || 0}
                      onChange={(e) => setEditingQuest({ ...editingQuest, rewardTickets: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label>Дата начала</label>
                    <input
                      type="datetime-local"
                      value={editingQuest.startDate ? new Date(editingQuest.startDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditingQuest({ ...editingQuest, startDate: new Date(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label>Дата окончания</label>
                    <input
                      type="datetime-local"
                      value={editingQuest.endDate ? new Date(editingQuest.endDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditingQuest({ ...editingQuest, endDate: new Date(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={editingQuest.isPremium || false}
                      onChange={(e) => setEditingQuest({ ...editingQuest, isPremium: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    Только для премиум пользователей
                  </label>
                </div>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingQuest(null)}
                  style={{ padding: '10px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    try {
                      await apiClient.put(`/admin/quests/${editingQuest.id}`, {
                        ...editingQuest,
                        rewardNarCoin: String(editingQuest.rewardNarCoin),
                      })
                      alert('Квест обновлен')
                      setEditingQuest(null)
                      await loadStats()
                    } catch (error: any) {
                      alert('Ошибка: ' + (error.response?.data?.message || error.message))
                    }
                  }}
                  style={{ padding: '10px 20px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

