import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient, { getImageUrl } from '../api/client'
import BackgammonBoard from '../components/BackgammonBoard'
import './Admin.css'

interface Prize {
  place: number
  type: 'nar' | 'usd' | 'skin' | 'xp' | 'ticket'
  amount?: number
  skinId?: string
}

const normalizePrizes = (prizesData: any): Prize[] => {
  if (!prizesData) return [];
  if (Array.isArray(prizesData)) return prizesData;
  if (typeof prizesData === 'object') {
    return Object.entries(prizesData).map(([key, value]: [string, any]) => ({
      place: parseInt(key),
      ...value
    }));
  }
  return [];
}

const PrizeEditor = ({ prizes, onChange, skins = [] }: { prizes: Prize[], onChange: (prizes: Prize[]) => void, skins: any[] }) => {
  const addPrize = () => {
    onChange([...prizes, { place: prizes.length + 1, type: 'nar', amount: 0 }])
  }

  const removePrize = (index: number) => {
    const newPrizes = [...prizes]
    newPrizes.splice(index, 1)
    onChange(newPrizes)
  }

  const updatePrize = (index: number, field: keyof Prize, value: any) => {
    const newPrizes = [...prizes]
    newPrizes[index] = { ...newPrizes[index], [field]: value }
    onChange(newPrizes)
  }

  return (
    <div className="prize-editor">
      {prizes.map((prize, index) => (
        <div key={index} className="prize-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <div style={{ width: '60px' }}>
            <label style={{ fontSize: '10px', color: '#999' }}>Место</label>
            <input 
              type="number" 
              value={prize.place} 
              onChange={(e) => updatePrize(index, 'place', parseInt(e.target.value))}
              style={{ width: '100%', padding: '4px', background: '#333', border: '1px solid #444', color: '#fff' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '10px', color: '#999' }}>Тип</label>
            <select 
              value={prize.type} 
              onChange={(e) => updatePrize(index, 'type', e.target.value)}
              style={{ width: '100%', padding: '4px', background: '#333', border: '1px solid #444', color: '#fff' }}
            >
              <option value="nar">NAR Coin</option>
              <option value="usd">USD</option>
              <option value="xp">XP</option>
              <option value="skin">Скин</option>
              <option value="ticket">Билет</option>
            </select>
          </div>
          
          {prize.type === 'skin' ? (
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '10px', color: '#999' }}>Скин</label>
              <select 
                value={prize.skinId || ''} 
                onChange={(e) => updatePrize(index, 'skinId', e.target.value)}
                style={{ width: '100%', padding: '4px', background: '#333', border: '1px solid #444', color: '#fff' }}
              >
                <option value="">Выберите скин</option>
                {skins.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '10px', color: '#999' }}>Количество</label>
              <input 
                type="number" 
                value={prize.amount || 0} 
                onChange={(e) => updatePrize(index, 'amount', parseInt(e.target.value))}
                style={{ width: '100%', padding: '4px', background: '#333', border: '1px solid #444', color: '#fff' }}
              />
            </div>
          )}
          
          <button 
            onClick={() => removePrize(index)}
            style={{ marginTop: '14px', background: '#f44336', border: 'none', color: '#fff', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      ))}
      <button 
        onClick={addPrize} 
        style={{ marginTop: '8px', padding: '4px 8px', background: '#444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
      >
        + Добавить приз
      </button>
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'games' | 'notifications' | 'create-game' | 'tournaments' | 'academy' | 'city' | 'skins' | 'quests' | 'clans' | 'policy' | 'prices' | 'system-settings' | 'progression' | 'payments' | 'equipment-config' | 'business'>('stats')
  const [onboardingTasks, setOnboardingTasks] = useState<any[]>([])
  const [onboardingStats, setOnboardingStats] = useState<any>(null)
  const [selectedSkinType, setSelectedSkinType] = useState<string>('')
  const [progressionConfig, setProgressionConfig] = useState<any>(null)
  const [paymentStats, setPaymentStats] = useState<any>(null)
  const [wallets, setWallets] = useState<any[]>([])
  const [systemSettings, setSystemSettings] = useState<any>({})
  const [walletPrivateKeyModal, setWalletPrivateKeyModal] = useState<{ wallet: any; privateKey: string; address: string } | null>(null)
  const [isSavingProgression, setIsSavingProgression] = useState(false)
  const [editingOnboardingTask, setEditingOnboardingTask] = useState<any>(null)
  const [newOnboardingTask, setNewOnboardingTask] = useState({
    type: 'train_with_bot',
    title: '',
    description: '',
    order: 1,
    requirements: {},
    target: '', // Целевое действие (как в квестах)
    targetValue: 0, // Целевое значение (как в квестах)
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
    upgradeMultiplier: 1.15,
    incomeMultiplier: 0.07,
    districtId: '',
  })
  const [skins, setSkins] = useState<any[]>([])
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [gameReplay, setGameReplay] = useState<any>(null)
  const [replayStep, setReplayStep] = useState(0)
  const [showCreateTournamentModal, setShowCreateTournamentModal] = useState(false)
  const [showCreateDistrictModal, setShowCreateDistrictModal] = useState(false)
  const [showCreateBuildingModal, setShowCreateBuildingModal] = useState(false)
  
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
  const [courseTasks, setCourseTasks] = useState<any[]>([])
  const [newCourseTask, setNewCourseTask] = useState({
    type: 'train_with_bot',
    title: '',
    description: '',
    order: 1,
    rewardNarCoin: 0,
    rewardXP: 0,
    isRequired: true,
  })
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [subscriptionPrices, setSubscriptionPrices] = useState<{ 
    month_1?: { tribute?: number; stars?: number; tributeLink?: string }; 
    month_3?: { tribute?: number; stars?: number; tributeLink?: string }; 
    month_12?: { tribute?: number; stars?: number; tributeLink?: string } 
  } | null>(null)
  const [narCoinPackages, setNarCoinPackages] = useState<Array<{ amount: number; priceTon?: number; priceUsdt?: number; priceStars?: number; tributeLink?: string }>>([])
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
    prizes: [] as Prize[] // Массив с наградами
  })
  const [newArticle, setNewArticle] = useState({ 
    title: '', 
    content: '', 
    type: 'course', 
    isPaid: false, 
    price: 0,
    rewards: '', // JSON строка с наградами (может быть несколько)
    gameMode: 'long',
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
        target: '',
        targetValue: 0,
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

  const [businessData, setBusinessData] = useState<any>({
    districts: [],
    businesses: [],
    materials: [],
    licenses: [],
  })

  const loadBusinessData = async () => {
    try {
      const [districtsRes, businessesRes, materialsRes, licensesRes] = await Promise.all([
        apiClient.get('/admin/business/districts').catch(() => ({ data: [] })),
        apiClient.get('/admin/business/businesses').catch(() => ({ data: [] })),
        apiClient.get('/admin/business/materials').catch(() => ({ data: [] })),
        apiClient.get('/admin/business/licenses').catch(() => ({ data: [] })),
      ])
      setBusinessData({
        districts: districtsRes.data || [],
        businesses: businessesRes.data || [],
        materials: materialsRes.data || [],
        licenses: licensesRes.data || [],
      })
    } catch (error) {
      console.error('Failed to load business data:', error)
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

  const loadWallets = async () => {
    try {
      const response = await apiClient.get('/admin/wallets')
      setWallets(response.data || [])
    } catch (error) {
      console.error('Failed to load wallets:', error)
      setWallets([])
    }
  }

  const loadSubscriptionPrices = async () => {
    try {
      const response = await apiClient.get('/admin/prices/subscription')
      const prices = response.data
      // Нормализуем данные для поддержки старого формата
      if (prices.month_1 && typeof prices.month_1 === 'number') {
        setSubscriptionPrices({
          month_1: { tribute: prices.month_1, stars: prices.month_1 },
          month_3: { tribute: prices.month_3, stars: prices.month_3 },
          month_12: { tribute: prices.month_12, stars: prices.month_12 },
        })
      } else {
        setSubscriptionPrices(prices)
      }
    } catch (error) {
      console.error('Failed to load subscription prices:', error)
    }
  }

  const loadNarCoinPrices = async () => {
    try {
      const response = await apiClient.get('/admin/prices/nar-coin')
      const packages = response.data
      console.log('📥 Загружены пакеты NAR-coin:', JSON.stringify(packages, null, 2))
      // Нормализуем данные для поддержки старого формата
      const normalized = packages.map((pkg: any) => ({
        amount: pkg.amount || 0,
        priceStars: pkg.priceStars || pkg.price || 0,
        tributeLink: pkg.tributeLink || '',
      }))
      console.log('📦 Нормализованные пакеты:', JSON.stringify(normalized, null, 2))
      setNarCoinPackages(normalized)
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
                    upgradeMultiplier: 1.15,
                    incomeMultiplier: 0.07,
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
          История платежей
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'equipment-config' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('equipment-config')
            loadProgressionConfig()
          }}
        >
          Экипировка (v2.0)
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'business' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('business')
            loadBusinessData()
          }}
        >
          Бизнес
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
                      <td>{user.id ? `${user.id.substring(0, 8)}...` : 'N/A'}</td>
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
                      <td>{game.id ? `${game.id.substring(0, 8)}...` : 'N/A'}</td>
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
          <div className="admin-tournaments-v2">
            <div className="admin-section-header">
              <h3>Управление турнирами</h3>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setNewTournament({ 
                    name: '', 
                    mode: 'short', 
                    format: 'bracket', 
                    startDate: '', 
                    registrationStart: '',
                    registrationEnd: '',
                    maxParticipants: 16, 
                    entryFee: 0,
                    prizes: [],
                  })
                  setShowCreateTournamentModal(true)
                }}
              >
                + Создать турнир
              </button>
            </div>

            <div className="admin-filters-bar">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Поиск турнира..."
                  value={tournamentFilters.search}
                  onChange={(e) => setTournamentFilters({ ...tournamentFilters, search: e.target.value })}
                />
              </div>
              <div className="status-filter">
                <select
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
            </div>

            <div className="tournaments-grid-v2">
              {tournaments.filter((t) => {
                if (tournamentFilters.search && !t.name.toLowerCase().includes(tournamentFilters.search.toLowerCase())) return false
                if (tournamentFilters.status && t.status !== tournamentFilters.status) return false
                return true
              }).map((t) => {
                const entryFee = typeof t.entryFee === 'string' ? Number(t.entryFee) : (t.entryFee || 0)
                const prizePool = entryFee * (t.currentParticipants || 0)
                const statusInfo = {
                  registration: { label: 'Регистрация', class: 'status-registration' },
                  upcoming: { label: 'Предстоящий', class: 'status-upcoming' },
                  in_progress: { label: 'В процессе', class: 'status-inprogress' },
                  finished: { label: 'Завершен', class: 'status-finished' },
                  cancelled: { label: 'Отменен', class: 'status-cancelled' },
                }[t.status as string] || { label: t.status, class: 'status-default' }

                return (
                  <div key={t.id} className="admin-tournament-card">
                    <div className="tournament-card-header">
                      <div className="tournament-name-group">
                        <div className="tournament-name">{t.name}</div>
                        <div className={`tournament-status-badge ${statusInfo.class}`}>{statusInfo.label}</div>
                      </div>
                      <div className="tournament-mode-tag">
                        {t.mode === 'short' ? 'Короткие' : 'Длинные'} • {t.format === 'bracket' ? 'Олимпийская' : 'Круговой'}
                      </div>
                    </div>
                    
                    <div className="tournament-card-stats">
                      <div className="stat-item">
                        <span className="label">Участники</span>
                        <span className="value">{t.currentParticipants || 0} / {t.maxParticipants}</span>
                      </div>
                      <div className="stat-item">
                        <span className="label">Взнос</span>
                        <span className="value">{entryFee} NAR</span>
                      </div>
                      <div className="stat-item">
                        <span className="label">Призовой фонд</span>
                        <span className="value highlighted">{prizePool.toLocaleString()} NAR</span>
                      </div>
                    </div>

                    <div className="tournament-card-dates">
                      <div className="date-item">
                        <span className="label">Регистрация:</span>
                        <span className="value">{t.registrationStart ? new Date(t.registrationStart).toLocaleDateString() : '-'} - {t.registrationEnd ? new Date(t.registrationEnd).toLocaleDateString() : '-'}</span>
                      </div>
                      <div className="date-item">
                        <span className="label">Старт:</span>
                        <span className="value">{t.startDate ? new Date(t.startDate).toLocaleString() : '-'}</span>
                      </div>
                    </div>

                    <div className="tournament-card-actions">
                      <button 
                        className="btn-card-edit"
                        onClick={() => setSelectedTournament(t)}
                      >
                        📝 Редактировать
                      </button>
                      <button 
                        className="btn-card-delete"
                        onClick={async () => {
                          if (confirm('Удалить турнир?')) {
                            try {
                              await apiClient.delete(`/admin/tournaments/${t.id}`)
                              alert('Турнир удален')
                              loadStats()
                            } catch (error: any) {
                              alert('Ошибка: ' + (error.response?.data?.message || error.message))
                            }
                          }
                        }}
                      >
                        🗑️ Удалить
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Модалка создания турнира */}
            {showCreateTournamentModal && (
              <div className="admin-modal-overlay" onClick={() => setShowCreateTournamentModal(false)}>
                <div className="admin-modal-content-v2" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header-v2">
                    <h4>Новый турнир</h4>
                    <button className="close-btn" onClick={() => setShowCreateTournamentModal(false)}>×</button>
                  </div>
                  <div className="modal-body-v2">
                    <div className="form-grid-v2">
                      <div className="form-group">
                        <label>Название</label>
                        <input
                          type="text"
                          value={newTournament.name}
                          onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                          placeholder="Название турнира"
                        />
                      </div>
                      <div className="form-row-v2">
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
                      </div>
                      <div className="form-row-v2">
                        <div className="form-group">
                          <label>Начало регистрации</label>
                          <input
                            type="datetime-local"
                            value={newTournament.registrationStart}
                            onChange={(e) => setNewTournament({ ...newTournament, registrationStart: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Конец регистрации</label>
                          <input
                            type="datetime-local"
                            value={newTournament.registrationEnd}
                            onChange={(e) => setNewTournament({ ...newTournament, registrationEnd: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-row-v2">
                        <div className="form-group">
                          <label>Дата начала турнира</label>
                          <input
                            type="datetime-local"
                            value={newTournament.startDate}
                            onChange={(e) => setNewTournament({ ...newTournament, startDate: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Макс. участников</label>
                          <input
                            type="number"
                            value={newTournament.maxParticipants}
                            onChange={(e) => setNewTournament({ ...newTournament, maxParticipants: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Взнос (NAR)</label>
                        <input
                          type="number"
                          value={newTournament.entryFee}
                          onChange={(e) => setNewTournament({ ...newTournament, entryFee: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Награды</label>
                        <PrizeEditor 
                          prizes={newTournament.prizes} 
                          onChange={(prizes) => setNewTournament({ ...newTournament, prizes })} 
                          skins={skins}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer-v2">
                    <button className="btn btn-secondary" onClick={() => setShowCreateTournamentModal(false)}>Отмена</button>
                    <button className="btn btn-primary" onClick={async () => {
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
                          prizes: newTournament.prizes,
                        })
                        alert('Турнир создан!')
                        setShowCreateTournamentModal(false)
                        loadStats()
                      } catch (error: any) {
                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                      }
                    }}>Создать</button>
                  </div>
                </div>
              </div>
            )}
            
            {selectedTournament && (
              <div className="admin-modal-overlay" onClick={() => setSelectedTournament(null)}>
                <div className="admin-modal-content-v2" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header-v2">
                    <h4>Редактировать: {selectedTournament.name}</h4>
                    <button className="close-btn" onClick={() => setSelectedTournament(null)}>×</button>
                  </div>
                  <div className="modal-body-v2">
                    <div className="form-grid-v2">
                      <div className="form-group">
                        <label>Название</label>
                        <input
                          type="text"
                          value={selectedTournament.name}
                          onChange={(e) => setSelectedTournament({ ...selectedTournament, name: e.target.value })}
                        />
                      </div>
                      <div className="form-row-v2">
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
                      <div className="form-row-v2">
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
                      </div>
                      <div className="form-row-v2">
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
                      </div>
                      <div className="form-group">
                        <label>Дата начала</label>
                        <input
                          type="datetime-local"
                          value={selectedTournament.startDate ? new Date(selectedTournament.startDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setSelectedTournament({ ...selectedTournament, startDate: new Date(e.target.value).toISOString() })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Награды</label>
                        <PrizeEditor 
                          prizes={normalizePrizes(selectedTournament.prizes)} 
                          onChange={(prizes) => setSelectedTournament({ ...selectedTournament, prizes })} 
                          skins={skins}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer-v2">
                    <button className="btn btn-secondary" onClick={() => setSelectedTournament(null)}>Отмена</button>
                    <button className="btn btn-primary" onClick={async () => {
                      try {
                        const { id, ...data } = selectedTournament
                        await apiClient.put(`/admin/tournaments/${id}`, data)
                        alert('Турнир обновлен!')
                        setSelectedTournament(null)
                        loadStats()
                      } catch (error: any) {
                        alert('Ошибка: ' + (error.response?.data?.message || error.message))
                      }
                    }}>Сохранить</button>
                  </div>
                </div>
              </div>
            )}
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
                  <option value="article">Статья</option>
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
                <label>Тип нард (Длинные/Короткие)</label>
                <select
                  value={newArticle.gameMode}
                  onChange={(e) => setNewArticle({ ...newArticle, gameMode: e.target.value })}
                  style={{ width: '100%', padding: '8px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                >
                  <option value="long">Длинные</option>
                  <option value="short">Короткие</option>
                </select>
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
                    authorId: null, // null означает, что это материал от админа
                    isVerified: true, // Материалы от админов сразу верифицированы (и курсы, и статьи)
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
                    gameMode: 'long',
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
                <label>Целевое действие (как в квестах)</label>
                <select
                  value={newOnboardingTask.target}
                  onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, target: e.target.value })}
                >
                  <option value="">Не выбрано</option>
                  <option value="play_matches">Сыграть матчей</option>
                  <option value="win_streak">Побед подряд</option>
                  <option value="collect_income">Собрать дохода</option>
                  <option value="tournament">Участие в турнире</option>
                  <option value="subscribe_channel">Подписаться на канал</option>
                </select>
              </div>
              {newOnboardingTask.target && (
                <div className="form-group">
                  <label>Целевое значение (например, количество матчей, побед и т.д.)</label>
                  <input
                    type="number"
                    value={newOnboardingTask.targetValue}
                    onChange={(e) => setNewOnboardingTask({ ...newOnboardingTask, targetValue: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              )}
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
                      <label>Целевое действие (как в квестах)</label>
                      <select
                        value={editingOnboardingTask.target || ''}
                        onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, target: e.target.value })}
                      >
                        <option value="">Не выбрано</option>
                        <option value="play_matches">Сыграть матчей</option>
                        <option value="win_streak">Побед подряд</option>
                        <option value="collect_income">Собрать дохода</option>
                        <option value="tournament">Участие в турнире</option>
                        <option value="subscribe_channel">Подписаться на канал</option>
                      </select>
                    </div>
                    {editingOnboardingTask.target && (
                      <div className="form-group">
                        <label>Целевое значение (например, количество матчей, побед и т.д.)</label>
                        <input
                          type="number"
                          value={editingOnboardingTask.targetValue || 0}
                          onChange={(e) => setEditingOnboardingTask({ ...editingOnboardingTask, targetValue: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      </div>
                    )}
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
                            onClick={async () => {
                              setSelectedArticle(a)
                              // Загружаем задания курса, если это курс
                              if (a.type === 'course') {
                                try {
                                  const tasksRes = await apiClient.get(`/academy/courses/${a.id}/tasks`)
                                  setCourseTasks(tasksRes.data || [])
                                } catch (error) {
                                  console.error('Failed to load course tasks:', error)
                                  setCourseTasks([])
                                }
                              }
                            }}
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
                onClick={() => {
                  setSelectedArticle(null)
                  setCourseTasks([])
                }}
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

                  {selectedArticle.type === 'course' && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ color: '#FFF', fontSize: '18px', marginBottom: '12px' }}>Задания курса:</h3>
                      <div style={{ marginBottom: '16px', background: '#2a2a2a', padding: '16px', borderRadius: '8px', border: '1px solid #3a3a3a' }}>
                        <h4 style={{ color: '#FFF', fontSize: '14px', marginBottom: '12px' }}>Создать новое задание:</h4>
                        <div className="form-group">
                          <label style={{ color: '#B6B6B6', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Тип задания</label>
                          <select
                            value={newCourseTask.type}
                            onChange={(e) => setNewCourseTask({ ...newCourseTask, type: e.target.value })}
                            style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#FFF' }}
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
                          <label style={{ color: '#B6B6B6', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Название</label>
                          <input
                            type="text"
                            value={newCourseTask.title}
                            onChange={(e) => setNewCourseTask({ ...newCourseTask, title: e.target.value })}
                            placeholder="Название задания"
                            style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#FFF' }}
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ color: '#B6B6B6', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Описание</label>
                          <textarea
                            value={newCourseTask.description}
                            onChange={(e) => setNewCourseTask({ ...newCourseTask, description: e.target.value })}
                            rows={2}
                            placeholder="Описание задания"
                            style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#FFF' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div className="form-group">
                            <label style={{ color: '#B6B6B6', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Порядок</label>
                            <input
                              type="number"
                              value={newCourseTask.order}
                              onChange={(e) => setNewCourseTask({ ...newCourseTask, order: parseInt(e.target.value) || 1 })}
                              min="1"
                              style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#FFF' }}
                            />
                          </div>
                          <div className="form-group">
                            <label style={{ color: '#B6B6B6', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Награда NAR</label>
                            <input
                              type="number"
                              value={newCourseTask.rewardNarCoin}
                              onChange={(e) => setNewCourseTask({ ...newCourseTask, rewardNarCoin: parseInt(e.target.value) || 0 })}
                              min="0"
                              style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#FFF' }}
                            />
                          </div>
                          <div className="form-group">
                            <label style={{ color: '#B6B6B6', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Награда XP</label>
                            <input
                              type="number"
                              value={newCourseTask.rewardXP}
                              onChange={(e) => setNewCourseTask({ ...newCourseTask, rewardXP: parseInt(e.target.value) || 0 })}
                              min="0"
                              style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#FFF' }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await apiClient.post(`/academy/courses/${selectedArticle.id}/tasks`, newCourseTask)
                              alert('Задание создано!')
                              setNewCourseTask({
                                type: 'train_with_bot',
                                title: '',
                                description: '',
                                order: courseTasks.length + 1,
                                rewardNarCoin: 0,
                                rewardXP: 0,
                                isRequired: true,
                              })
                              // Загружаем задания курса
                              const tasksRes = await apiClient.get(`/academy/courses/${selectedArticle.id}/tasks`)
                              setCourseTasks(tasksRes.data || [])
                            } catch (error: any) {
                              alert('Ошибка: ' + (error.response?.data?.message || error.message))
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(180deg, #4CAF50 -144.23%, #2E7D32 105.77%)',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                          }}
                        >
                          Создать задание
                        </button>
                      </div>
                      {courseTasks.length > 0 && (
                        <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px', border: '1px solid #3a3a3a' }}>
                          <h4 style={{ color: '#FFF', fontSize: '14px', marginBottom: '12px' }}>Существующие задания:</h4>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#B6B6B6', fontSize: '12px' }}>Порядок</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#B6B6B6', fontSize: '12px' }}>Название</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#B6B6B6', fontSize: '12px' }}>Тип</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#B6B6B6', fontSize: '12px' }}>Награда NAR</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: '#B6B6B6', fontSize: '12px' }}>Награда XP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {courseTasks.map((task) => (
                                <tr key={task.id} style={{ borderBottom: '1px solid #3a3a3a' }}>
                                  <td style={{ padding: '8px', color: '#FFF', fontSize: '12px' }}>{task.order}</td>
                                  <td style={{ padding: '8px', color: '#FFF', fontSize: '12px' }}>{task.title}</td>
                                  <td style={{ padding: '8px', color: '#FFF', fontSize: '12px' }}>{task.type}</td>
                                  <td style={{ padding: '8px', color: '#FFF', fontSize: '12px' }}>{Number(task.rewardNarCoin || 0).toLocaleString()}</td>
                                  <td style={{ padding: '8px', color: '#FFF', fontSize: '12px' }}>{task.rewardXP || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

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

            {/* Модальное окно редактирования материала */}
            {editingArticle && (
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
                onClick={() => setEditingArticle(null)}
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
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 style={{ color: '#FFF', marginBottom: '20px' }}>Редактирование материала</h2>
                  
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#B6B6B6', display: 'block', marginBottom: '8px' }}>Название</label>
                    <input
                      type="text"
                      value={editingArticle.title}
                      onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#FFF' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#B6B6B6', display: 'block', marginBottom: '8px' }}>Тип нард</label>
                    <select
                      value={editingArticle.gameMode || 'long'}
                      onChange={(e) => setEditingArticle({ ...editingArticle, gameMode: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#FFF' }}
                    >
                      <option value="long">Длинные</option>
                      <option value="short">Короткие</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#B6B6B6', display: 'block', marginBottom: '8px' }}>Контент (HTML)</label>
                    <textarea
                      value={editingArticle.content}
                      onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                      rows={10}
                      style={{ width: '100%', padding: '10px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#FFF', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button
                      onClick={async () => {
                        try {
                          await apiClient.put(`/admin/academy/${editingArticle.id}`, editingArticle)
                          alert('Материал обновлен!')
                          setEditingArticle(null)
                          loadStats()
                        } catch (error: any) {
                          alert('Ошибка при обновлении: ' + (error.response?.data?.message || error.message))
                        }
                      }}
                      style={{
                        padding: '10px 24px',
                        background: 'linear-gradient(180deg, #4a9eff 0%, #2196F3 100%)',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditingArticle(null)}
                      style={{
                        padding: '10px 24px',
                        background: '#3a3a3a',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      Отмена
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
                <div className="form-row-v2">
                  <div className="form-group">
                    <label>Слот экипировки:</label>
                    <select id="edit-skin-slot" defaultValue={selectedSkin.slot || 'BOARD'}>
                      <option value="BOARD">Доска (BOARD)</option>
                      <option value="DIE_1">Кубик 1 (DIE_1)</option>
                      <option value="DIE_2">Кубик 2 (DIE_2)</option>
                      <option value="CHECKERS">Шашки (CHECKERS)</option>
                      <option value="AVATAR_FRAME">Рамка аватара (AVATAR_FRAME)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Режим износа:</label>
                    <select id="edit-skin-wear-mode" defaultValue={selectedSkin.wear_mode || 'PER_MATCH'}>
                      <option value="PER_MATCH">За матч (PER_MATCH)</option>
                      <option value="PER_ROLL">За бросок (PER_ROLL)</option>
                      <option value="NONE">Нет износа (NONE)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-v2">
                  <div className="form-group">
                    <label>Износ за ед. (wear_amount):</label>
                    <input 
                      type="number" 
                      id="edit-skin-wear-amount" 
                      step="0.01"
                      defaultValue={selectedSkin.wear_amount || 1}
                    />
                  </div>
                  <div className="form-group">
                    <label>Множитель в турнирах:</label>
                    <input 
                      type="number" 
                      id="edit-skin-tournament-wear-mult" 
                      step="0.1"
                      defaultValue={selectedSkin.tournament_wear_mult || 2.0}
                    />
                  </div>
                </div>

                <div className="form-row-v2">
                  <div className="form-group">
                    <label>Валюта ремонта:</label>
                    <select id="edit-skin-repair-currency" defaultValue={selectedSkin.repair_currency || 'NAR'}>
                      <option value="NAR">NAR</option>
                      <option value="TON">TON</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Базовая цена ремонта:</label>
                    <input 
                      type="number" 
                      id="edit-skin-repair-base-cost" 
                      defaultValue={selectedSkin.repair_base_cost || 100}
                    />
                  </div>
                </div>

                <div className="form-row-v2">
                  <div className="form-group">
                    <label>Требуемый уровень:</label>
                    <input 
                      type="number" 
                      id="edit-skin-required-level" 
                      defaultValue={selectedSkin.required_level || 1}
                    />
                  </div>
                  <div className="form-group">
                    <label>Требуемая Сила (power_sp):</label>
                    <input 
                      type="number" 
                      id="edit-skin-required-power-sp" 
                      defaultValue={selectedSkin.required_power_sp || 0}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Бонусы (JSON):</label>
                  <textarea 
                    id="edit-skin-bonuses" 
                    rows={4}
                    defaultValue={JSON.stringify(selectedSkin.bonuses || { xpMult: 0, moneyMult: 0, commissionReduction: 0 }, null, 2)}
                  ></textarea>
                  <span className="field-hint">Пример: {"{ \"xpMult\": 0.05, \"commissionReduction\": 0.01 }"}</span>
                </div>

                <div className="form-row-v2">
                  <div className="form-group">
                    <label>Макс. прочность:</label>
                    <input 
                      type="number" 
                      id="edit-skin-max-durability" 
                      min="1" 
                      defaultValue={selectedSkin.maxDurability || 100}
                    />
                  </div>
                  <div className="form-group">
                    <label>Бонус XP (%): [Legacy]</label>
                    <input 
                      type="number" 
                      id="edit-skin-xp-bonus" 
                      min="0" 
                      defaultValue={selectedSkin.xpBonusPercent || 0}
                    />
                  </div>
                  <div className="form-group">
                    <label>Бонус денег (%): [Legacy]</label>
                    <input 
                      type="number" 
                      id="edit-skin-money-bonus" 
                      min="0" 
                      defaultValue={selectedSkin.moneyBonusPercent || 0}
                    />
                  </div>
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
                        maxDurability: parseInt((document.getElementById('edit-skin-max-durability') as HTMLInputElement).value) || 100,
                        xpBonusPercent: parseInt((document.getElementById('edit-skin-xp-bonus') as HTMLInputElement).value) || 0,
                        moneyBonusPercent: parseInt((document.getElementById('edit-skin-money-bonus') as HTMLInputElement).value) || 0,
                        rarity: (document.getElementById('edit-skin-rarity') as HTMLSelectElement).value,
                        isPremium: (document.getElementById('edit-skin-premium') as HTMLInputElement).checked,
                        isDefault: (document.getElementById('edit-skin-default') as HTMLInputElement).checked,
                        
                        // New fields v2.0
                        slot: (document.getElementById('edit-skin-slot') as HTMLSelectElement).value,
                        wear_mode: (document.getElementById('edit-skin-wear-mode') as HTMLSelectElement).value,
                        wear_amount: parseFloat((document.getElementById('edit-skin-wear-amount') as HTMLInputElement).value) || 1,
                        tournament_wear_mult: parseFloat((document.getElementById('edit-skin-tournament-wear-mult') as HTMLInputElement).value) || 2.0,
                        repair_currency: (document.getElementById('edit-skin-repair-currency') as HTMLSelectElement).value,
                        repair_base_cost: parseInt((document.getElementById('edit-skin-repair-base-cost') as HTMLInputElement).value) || 100,
                        required_level: parseInt((document.getElementById('edit-skin-required-level') as HTMLInputElement).value) || 1,
                        required_power_sp: parseInt((document.getElementById('edit-skin-required-power-sp') as HTMLInputElement).value) || 0,
                      }

                      try {
                        updateData.bonuses = JSON.parse((document.getElementById('edit-skin-bonuses') as HTMLTextAreaElement).value)
                      } catch (e) {
                        alert('Ошибка в формате JSON бонусов!')
                        return
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
                <select 
                  id="skin-type" 
                  required
                  value={selectedSkinType}
                  onChange={(e) => setSelectedSkinType(e.target.value)}
                >
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
              <div className="form-row-v2">
                <div className="form-group">
                  <label>Слот экипировки:</label>
                  <select id="skin-slot" defaultValue="BOARD">
                    <option value="BOARD">Доска (BOARD)</option>
                    <option value="DIE_1">Кубик 1 (DIE_1)</option>
                    <option value="DIE_2">Кубик 2 (DIE_2)</option>
                    <option value="CHECKERS">Шашки (CHECKERS)</option>
                    <option value="AVATAR_FRAME">Рамка аватара (AVATAR_FRAME)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Режим износа:</label>
                  <select id="skin-wear-mode" defaultValue="PER_MATCH">
                    <option value="PER_MATCH">За матч (PER_MATCH)</option>
                    <option value="PER_ROLL">За бросок (PER_ROLL)</option>
                    <option value="NONE">Нет износа (NONE)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-v2">
                <div className="form-group">
                  <label>Износ за ед. (wear_amount):</label>
                  <input 
                    type="number" 
                    id="skin-wear-amount" 
                    step="0.01"
                    defaultValue="1"
                  />
                </div>
                <div className="form-group">
                  <label>Множитель в турнирах:</label>
                  <input 
                    type="number" 
                    id="skin-tournament-wear-mult" 
                    step="0.1"
                    defaultValue="2.0"
                  />
                </div>
              </div>

              <div className="form-row-v2">
                <div className="form-group">
                  <label>Валюта ремонта:</label>
                  <select id="skin-repair-currency" defaultValue="NAR">
                    <option value="NAR">NAR</option>
                    <option value="TON">TON</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Базовая цена ремонта:</label>
                  <input 
                    type="number" 
                    id="skin-repair-base-cost" 
                    defaultValue="100"
                  />
                </div>
              </div>

              <div className="form-row-v2">
                <div className="form-group">
                  <label>Требуемый уровень:</label>
                  <input 
                    type="number" 
                    id="skin-required-level" 
                    defaultValue="1"
                  />
                </div>
                <div className="form-group">
                  <label>Требуемая Сила (power_sp):</label>
                  <input 
                    type="number" 
                    id="skin-required-power-sp" 
                    defaultValue="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Бонусы (JSON):</label>
                <textarea 
                  id="skin-bonuses" 
                  rows={4}
                  defaultValue={JSON.stringify({ xpMult: 0, moneyMult: 0, commissionReduction: 0 }, null, 2)}
                ></textarea>
                <span className="field-hint">Пример: {"{ \"xpMult\": 0.05, \"commissionReduction\": 0.01 }"}</span>
              </div>

              <div className="form-row-v2">
                <div className="form-group">
                  <label>Макс. прочность:</label>
                  <input type="number" id="skin-max-durability" min="1" defaultValue="100" />
                </div>
                <div className="form-group">
                  <label>Бонус XP (%): [Legacy]</label>
                  <input type="number" id="skin-xp-bonus" min="0" defaultValue="0" />
                </div>
                <div className="form-group">
                  <label>Бонус денег (%): [Legacy]</label>
                  <input type="number" id="skin-money-bonus" min="0" defaultValue="0" />
                </div>
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
              <div className="form-group" id="skin-config-board" style={{ display: selectedSkinType === 'board' ? 'block' : 'none' }}>
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
              <div className="form-group" id="skin-config-dice" style={{ display: selectedSkinType === 'dice' ? 'block' : 'none' }}>
                <label>Конфигурация кубиков (цвет материалов):</label>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Цвет кубика:</label>
                  <input type="color" id="skin-dice-color" defaultValue="#FFFFFF" style={{ width: '100%', height: '40px' }} />
                </div>
                <span className="field-hint">Цвет кубика. Цифры 1-6 будут рисоваться поверх</span>
              </div>
              <div className="form-group" id="skin-config-checkers" style={{ display: selectedSkinType === 'checkers' ? 'block' : 'none' }}>
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
              <button className="btn btn-primary" onClick={async () => {
                if (!selectedSkinType) {
                  alert('Выберите тип скина!')
                  return
                }

                const name = (document.getElementById('skin-name') as HTMLInputElement).value
                if (!name) {
                  alert('Введите название скина!')
                  return
                }

                const skinData: any = {
                  type: selectedSkinType,
                  name: name,
                  theme: (document.getElementById('skin-theme') as HTMLInputElement).value || selectedSkinType,
                  weight: parseInt((document.getElementById('skin-weight') as HTMLInputElement).value || '1'),
                  maxDurability: parseInt((document.getElementById('skin-max-durability') as HTMLInputElement).value || '100'),
                  xpBonusPercent: parseInt((document.getElementById('skin-xp-bonus') as HTMLInputElement).value || '0'),
                  moneyBonusPercent: parseInt((document.getElementById('skin-money-bonus') as HTMLInputElement).value || '0'),
                  rarity: (document.getElementById('skin-rarity') as HTMLSelectElement).value,
                  isPremium: (document.getElementById('skin-premium') as HTMLInputElement).checked,
                  isDefault: (document.getElementById('skin-default') as HTMLInputElement).checked,
                  
                  // New fields v2.0
                  slot: (document.getElementById('skin-slot') as HTMLSelectElement).value,
                  wear_mode: (document.getElementById('skin-wear-mode') as HTMLSelectElement).value,
                  wear_amount: parseFloat((document.getElementById('skin-wear-amount') as HTMLInputElement).value) || 1,
                  tournament_wear_mult: parseFloat((document.getElementById('skin-tournament-wear-mult') as HTMLInputElement).value) || 2.0,
                  repair_currency: (document.getElementById('skin-repair-currency') as HTMLSelectElement).value,
                  repair_base_cost: parseInt((document.getElementById('skin-repair-base-cost') as HTMLInputElement).value) || 100,
                  required_level: parseInt((document.getElementById('skin-required-level') as HTMLInputElement).value) || 1,
                  required_power_sp: parseInt((document.getElementById('skin-required-power-sp') as HTMLInputElement).value) || 0,
                }
                
                try {
                  skinData.bonuses = JSON.parse((document.getElementById('skin-bonuses') as HTMLTextAreaElement).value)
                } catch (e) {
                  alert('Ошибка в формате JSON бонусов!')
                  return
                }
                
                const priceValue = (document.getElementById('skin-price') as HTMLInputElement).value
                if (priceValue) {
                  skinData.price = parseFloat(priceValue)
                }
                
                // Добавляем конфиги в зависимости от типа
                if (selectedSkinType === 'board') {
                  skinData.boardConfig = {
                    backgroundColor: (document.getElementById('skin-board-background-color') as HTMLInputElement).value,
                    triangleColor1: (document.getElementById('skin-board-triangle-color-1') as HTMLInputElement).value,
                    triangleColor2: (document.getElementById('skin-board-triangle-color-2') as HTMLInputElement).value,
                    borderColor: (document.getElementById('skin-board-border-color') as HTMLInputElement).value,
                    outlineColor: (document.getElementById('skin-board-outline-color') as HTMLInputElement).value,
                  }
                } else if (selectedSkinType === 'dice') {
                  skinData.diceConfig = {
                    color: (document.getElementById('skin-dice-color') as HTMLInputElement).value,
                  }
                } else if (selectedSkinType === 'checkers') {
                  skinData.checkersConfig = {
                    whiteColor: (document.getElementById('skin-checkers-white-color') as HTMLInputElement).value,
                    blackColor: (document.getElementById('skin-checkers-black-color') as HTMLInputElement).value,
                  }
                }

                try {
                  await apiClient.post('/admin/skins', skinData)
                  alert('Скин создан!')
                  loadStats()
                  // Очистить форму
                  setSelectedSkinType('')
                  ;(document.getElementById('skin-name') as HTMLInputElement).value = ''
                  ;(document.getElementById('skin-theme') as HTMLInputElement).value = ''
                  ;(document.getElementById('skin-price') as HTMLInputElement).value = ''
                  ;(document.getElementById('skin-weight') as HTMLInputElement).value = '1'
                  ;(document.getElementById('skin-max-durability') as HTMLInputElement).value = '100'
                  ;(document.getElementById('skin-xp-bonus') as HTMLInputElement).value = '0'
                  ;(document.getElementById('skin-money-bonus') as HTMLInputElement).value = '0'
                  ;(document.getElementById('skin-premium') as HTMLInputElement).checked = false
                  ;(document.getElementById('skin-default') as HTMLInputElement).checked = false
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
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <button className="btn btn-secondary" onClick={() => {
                const standardPolicy = `Политика в отношении обработки персональных данных
1. Общие положения
Настоящая политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006. № 152-ФЗ "О персональных данных" (далее — Закон о персональных данных) и определяет порядок обработки персональных данных и меры по обеспечению безопасности персональных данных. Предпринимает их Общероссийская общественная организация «Федерация Нард России» (далее — Оператор).
1.1. Оператор ставит своей важнейшей целью и условием осуществления своей деятельности соблюдение прав и свобод человека и гражданина при обработке его персональных данных, в том числе защиты прав на неприкосновенность частной жизни, личную и семейную тайну.
1.2. Настоящая политика Оператора в отношении обработки персональных данных (далее — Политика) применяется ко всей информации, которую Оператор может получить о посетителях приложения ФНР.
2. Основные понятия, используемые в Политике
2.1. Автоматизированная обработка персональных данных — обработка персональных данных с помощью средств вычислительной техники.
2.2. Блокирование персональных данных — временное прекращение обработки персональных данных (за исключением случаев, если обработка необходима для уточнения персональных данных).
2.3. Приложение — совокупность графических и информационных материалов, а также программ для ЭВМ и баз данных, обеспечивающих их доступность в мобильном приложении.
2.4. Информационная система персональных данных — совокупность содержащихся в базах данных персональных данных и обеспечивающих их обработку информационных технологий и технических средств.
2.5. Обезличивание персональных данных — действия, в результате которых невозможно определить без использования дополнительной информации принадлежность персональных данных конкретному Пользователю или иному субъекту персональных данных.
2.6. Обработка персональных данных — любое действие (операция) или совокупность действий (операций), совершаемых с использованием средств автоматизации или без использования таких средств с персональными данными, включая сбор, запись, систематизацию, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передачу (распространение, предоставление, доступ), обезличивание, блокирование, удаление, уничтожение персональных данных.
2.7. Оператор — государственный орган, муниципальный орган, юридическое или физическое лицо, самостоятельно или совместно с другими лицами организующие и/или осуществляющие обработку персональных данных, а также определяющие цели обработки персональных данных, состав персональных данных, подлежащих обработке, действия (операции), совершаемые с персональными данными.
2.8. Персональные данные — любая информация, относящаяся прямо или косвенно к определенному или определяемому Пользователю приложения ФНР.
2.9. Персональные данные, разрешенные субъектом персональных данных для распространения, — персональные данные, доступ неограниченного круга лиц к которым предоставлен субъектом персональных данных путем дачи согласия на обработку персональных данных, разрешенных субъектом персональных данных для распространения в порядке, предусмотренном Законом о персональных данных (далее — персональные данные, разрешенные для распространения).
2.10. Пользователь — любой посетитель приложения ФНР.
2.11. Предоставление персональных данных — действия, направленные на раскрытие персональных данных определенному лицу или определенному кругу лиц.
2.12. Распространение персональных данных — любые действия, направленные на раскрытие персональных данных неопределенному кругу лиц (передача персональных данных) или на ознакомление с персональными данными неограниченного круга лиц, в том числе обнародование персональных данных в средствах массовой информации, размещение в информационно-телекоммуникационных сетях или предоставление доступа к персональным данным каким-либо иным способом.
2.13. Трансграничная передача персональных данных — передача персональных данных на территорию иностранного государства органу власти иностранного государства, иностранному физическому или иностранному юридическому лицу.
2.14. Уничтожение персональных данных — любые действия, в результате которых персональные данные уничтожаются безвозвратно с невозможностью дальнейшего восстановления содержания персональных данных в информационной системе персональных данных и/или уничтожаются материальные носители персональных данных.
3. Основные права и обязанности Оператора
3.1. Оператор имеет право:
— получать от субъекта персональных данных достоверные информацию и/или документы, содержащие персональные данные;
— в случае отзыва субъектом персональных данных согласия на обработку персональных данных, а также, направления обращения с требованием о прекращении обработки персональных данных, Оператор вправе продолжить обработку персональных данных без согласия субъекта персональных данных при наличии оснований, указанных в Законе о персональных данных;
— самостоятельно определять состав и перечень мер, необходимых и достаточных для обеспечения выполнения обязанностей, предусмотренных Законом о персональных данных и принятыми в соответствии с ним нормативными правовыми актами, если иное не предусмотрено Законом о персональных данных или другими федеральными законами.
3.2. Оператор обязан:
— предоставлять субъекту персональных данных по его просьбе информацию, касающуюся обработки его персональных данных;
— организовывать обработку персональных данных в порядке, установленном действующим законодательством РФ;
— отвечать на обращения и запросы субъектов персональных данных и их законных представителей в соответствии с требованиями Закона о персональных данных;
— сообщать в уполномоченный орган по защите прав субъектов персональных данных по запросу этого органа необходимую информацию в течение 10 дней с даты получения такого запроса;
— публиковать или иным образом обеспечивать неограниченный доступ к настоящей Политике в отношении обработки персональных данных;
— принимать правовые, организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа к ним, уничтожения, изменения, блокирования, копирования, предоставления, распространения персональных данных, а также от иных неправомерных действий в отношении персональных данных;
— прекратить передачу (распространение, предоставление, доступ) персональных данных, прекратить обработку и уничтожить персональные данные в порядке и случаях, предусмотренных Законом о персональных данных;
— исполнять иные обязанности, предусмотренные Законом о персональных данных.
4. Основные права и обязанности субъектов персональных данных
4.1. Субъекты персональных данных имеют право:
— получать информацию, касающуюся обработки его персональных данных, за исключением случаев, предусмотренных федеральными законами. Сведения предоставляются субъекту персональных данных Оператором в доступной форме, и в них не должны содержаться персональные данные, относящиеся к другим субъектам персональных данных, за исключением случаев, когда имеются законные основания для раскрытия таких персональных данных. Перечень информации и порядок ее получения установлен Законом о персональных данных;
— требовать от оператора уточнения его персональных данных, их блокирования или уничтожения в случае, если персональные данные являются неполными, устаревшими, неточными, незаконно полученными или не являются необходимыми для заявленной цели обработки, а также принимать предусмотренные законом меры по защите своих прав;
— выдвигать условие предварительного согласия при обработке персональных данных в целях продвижения на рынке товаров, работ и услуг;
— на отзыв согласия на обработку персональных данных, а также, на направление требования о прекращении обработки персональных данных;
— обжаловать в уполномоченный орган по защите прав субъектов персональных данных или в судебном порядке неправомерные действия или бездействие Оператора при обработке его персональных данных;
— на осуществление иных прав, предусмотренных законодательством РФ.
4.2. Субъекты персональных данных обязаны:
— предоставлять Оператору достоверные данные о себе;
— сообщать Оператору об уточнении (обновлении, изменении) своих персональных данных.
4.3. Лица, передавшие Оператору недостоверные сведения о себе, либо сведения о другом субъекте персональных данных без согласия последнего, несут ответственность в соответствии с законодательством РФ.
5. Принципы обработки персональных данных
5.1. Обработка персональных данных осуществляется на законной и справедливой основе.
5.2. Обработка персональных данных ограничивается достижением конкретных, заранее определенных и законных целей. Не допускается обработка персональных данных, несовместимая с целями сбора персональных данных.
5.3. Не допускается объединение баз данных, содержащих персональные данные, обработка которых осуществляется в целях, несовместимых между собой.
5.4. Обработке подлежат только персональные данные, которые отвечают целям их обработки.
5.5. Содержание и объем обрабатываемых персональных данных соответствуют заявленным целям обработки. Не допускается избыточность обрабатываемых персональных данных по отношению к заявленным целям их обработки.
5.6. При обработке персональных данных обеспечивается точность персональных данных, их достаточность, а в необходимых случаях и актуальность по отношению к целям обработки персональных данных. Оператор принимает необходимые меры и/или обеспечивает их принятие по удалению или уточнению неполных или неточных данных.
5.7. Хранение персональных данных осуществляется в форме, позволяющей определить субъекта персональных данных, не дольше, чем этого требуют цели обработки персональных данных, если срок хранения персональных данных не установлен федеральным законом, договором, стороной которого, выгодоприобретателем или поручителем, по которому является субъект персональных данных. Обрабатываемые персональные данные уничтожаются либо обезличиваются по достижении целей обработки или в случае утраты необходимости в достижении этих целей, если иное не предусмотрено федеральным законом.
6. Условия обработки персональных данных
6.1. Обработка персональных данных осуществляется с согласия субъекта персональных данных на обработку его персональных данных.
6.2. Обработка персональных данных необходима для достижения целей, предусмотренных международным договором Российской Федерации или законом, для осуществления возложенных законодательством Российской Федерации на оператора функций, полномочий и обязанностей.
6.3. Обработка персональных данных необходима для осуществления правосудия, исполнения судебного акта, акта другого органа или должностного лица, подлежащих исполнению в соответствии с законодательством Российской Федерации об исполнительном производстве.
6.4. Обработка персональных данных необходима для исполнения договора, стороной которого либо выгодоприобретателем или поручителем, по которому является субъект персональных данных, а также для заключения договора по инициативе субъекта персональных данных или договора, по которому субъект персональных данных будет являться выгодоприобретателем или поручителем.
6.5. Обработка персональных данных необходима для осуществления прав и законных интересов оператора или третьих лиц либо для достижения общественно значимых целей при условии, что при этом не нарушаются права и свободы субъекта персональных данных.
6.6. Осуществляется обработка персональных данных, доступ неограниченного круга лиц к которым предоставлен субъектом персональных данных либо по его просьбе (далее — общедоступные персональные данные).
6.7. Осуществляется обработка персональных данных, подлежащих опубликованию или обязательному раскрытию в соответствии с федеральным законом.
7. Порядок сбора, хранения, передачи и других видов обработки персональных данных
7.1. Безопасность персональных данных, которые обрабатываются Оператором, обеспечивается путем реализации правовых, организационных и технических мер, необходимых для выполнения в полном объеме требований действующего законодательства в области защиты персональных данных.
7.2. Оператор обеспечивает сохранность персональных данных и принимает все возможные меры, исключающие доступ к персональным данным неуполномоченных лиц.
7.3. Персональные данные Пользователя никогда, ни при каких условиях не будут переданы третьим лицам, за исключением случаев, связанных с исполнением действующего законодательства либо в случае, если субъектом персональных данных дано согласие Оператору на передачу данных третьему лицу для исполнения обязательств по гражданско-правовому договору.
7.4. В случае выявления неточностей в персональных данных, Пользователь может актуализировать их самостоятельно, путем направления Оператору уведомление на адрес электронной почты Оператора info@sportnardy.ru с пометкой "Актуализация персональных данных".
7.5. Срок обработки персональных данных определяется достижением целей, для которых были собраны персональные данные, если иной срок не предусмотрен договором или действующим законодательством.
7.6. Пользователь может в любой момент отозвать свое согласие на обработку персональных данных, направив Оператору уведомление посредством электронной почты на электронный адрес Оператора info@sportnardy.ru с пометкой "Отзыв согласия на обработку персональных данных".
7.7. Вся информация, которая собирается сторонними сервисами, в том числе платежными системами, средствами связи и другими поставщиками услуг, хранится и обрабатывается указанными лицами (Операторами) в соответствии с их Пользовательским соглашением и Политикой конфиденциальности. Субъект персональных данных и/или с указанными документами. Оператор не несет ответственность за действия третьих лиц, в том числе указанных в настоящем пункте поставщиков услуг.
7.8. Установленные субъектом персональных данных запреты на передачу (кроме предоставления доступа), а также на обработку или условия обработки (кроме получения доступа) персональных данных, разрешенных для распространения, не действуют в случаях обработки персональных данных в государственных, общественных и иных публичных интересах, определенных законодательством РФ.
7.9. Оператор при обработке персональных данных обеспечивает конфиденциальность персональных данных.
7.10. Оператор осуществляет хранение персональных данных в форме, позволяющей определить субъекта персональных данных, не дольше, чем этого требуют цели обработки персональных данных, если срок хранения персональных данных не установлен федеральным законом, договором, стороной которого, выгодоприобретателем или поручителем, по которому является субъект персональных данных.
7.11. Условием прекращения обработки персональных данных может являться достижение целей обработки персональных данных, истечение срока действия согласия субъекта персональных данных, отзыв согласия субъектом персональных данных или требование о прекращении обработки персональных данных, а также выявление неправомерной обработки персональных данных.
8. Перечень действий, производимых Оператором с полученными персональными данными
8.1. Оператор осуществляет сбор, запись, систематизацию, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передачу (распространение, предоставление, доступ), обезличивание, блокирование, удаление и уничтожение персональных данных.
8.2. Оператор осуществляет автоматизированную обработку персональных данных с получением и/или передачей полученной информации по информационно-телекоммуникационным сетям или без таковой.
9. Трансграничная передача персональных данных
9.1. Оператор до начала осуществления деятельности по трансграничной передаче персональных данных обязан уведомить уполномоченный орган по защите прав субъектов персональных данных о своем намерении осуществлять трансграничную передачу персональных данных (такое уведомление направляется отдельно от уведомления о намерении осуществлять обработку персональных данных).
9.2. Оператор до подачи вышеуказанного уведомления, обязан получить от органов власти иностранного государства, иностранных физических лиц, иностранных юридических лиц, которым планируется трансграничная передача персональных данных, соответствующие сведения.
10. Конфиденциальность персональных данных
Оператор и иные лица, получившие доступ к персональным данным, обязаны не раскрывать третьим лицам и не распространять персональные данные без согласия субъекта персональных данных, если иное не предусмотрено федеральным законом.
11. Заключительные положения
11.1. Пользователь может получить любые разъяснения по интересующим вопросам, касающимся обработки его персональных данных, обратившись к Оператору с помощью электронной почты info@sportnardy.ru .
11.2. В данном документе будут отражены любые изменения политики обработки персональных данных Оператором. Политика действует бессрочно до замены ее новой версией.
11.3. Актуальная версия Политики в свободном доступе расположена в приложении ФНР.`;
                setPolicyContent(standardPolicy);
                setEditingPolicy('privacy');
              }}>
                Загрузить стандартную политику ФНР
              </button>
            </div>
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
          <div className="admin-city-v2">
            <div className="admin-section-header">
              <h3>Управление городом</h3>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => setShowCreateDistrictModal(true)}>+ Новый район</button>
                <button className="btn btn-secondary" onClick={loadBuildings}>🔄 Обновить данные</button>
              </div>
            </div>

            <div className="admin-districts-grid">
              {districts.map((district) => (
                <div key={district.id} className="admin-district-card">
                  <div className="district-card-header">
                    <div className="district-info">
                      <div className="district-name">{district.name}</div>
                      <div className="district-code">{district.code}</div>
                    </div>
                    <div className={`status-badge ${district.isActive ? 'active' : 'inactive'}`}>
                      {district.isActive ? 'Активен' : 'Неактивен'}
                    </div>
                  </div>
                  
                  <div className="district-card-stats">
                    <div className="stat-item"><span className="label">Lvl</span><span className="value">{district.requiredLevel || 1}</span></div>
                    <div className="stat-item"><span className="label">Доход</span><span className="value">{Number(district.baseIncomePerDay || 0).toLocaleString()} NAR</span></div>
                    <div className="stat-item"><span className="label">Порядок</span><span className="value">#{district.order}</span></div>
                  </div>

                  <div className="district-buildings-section">
                    <div className="section-header">
                      <h5>Строения ({buildings.filter(b => b.districtId === district.id).length})</h5>
                      <button className="btn-add-mini" onClick={() => {
                        setNewBuilding({ type: 'shop', name: '', icon: '', image: '', basePrice: 0, baseIncomePerHour: 0, maxAccumulation: 0, maxLevel: 10, upgradeMultiplier: 1.15, incomeMultiplier: 0.07, districtId: district.id })
                        setShowCreateBuildingModal(true)
                      }}>+</button>
                    </div>
                    <div className="mini-buildings-list">
                      {buildings.filter(b => b.districtId === district.id).slice(0, 3).map(b => (
                        <div key={b.id} className="mini-building-item" onClick={() => setSelectedBuilding(b)}>
                          <span className="b-name">{b.name}</span>
                          <span className="b-price">{Number(b.basePrice).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="district-card-actions">
                    <button className="btn-edit" onClick={() => setEditingDistrict(district)}>📝</button>
                    <button className="btn-delete" onClick={async () => {
                      if (confirm(`Удалить район "${district.name}"?`)) {
                        try {
                          await apiClient.delete(`/admin/districts/${district.id}`)
                          alert('Район удален!')
                          loadDistricts()
                        } catch (e: any) { alert(e.message) }
                      }
                    }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Модалки */}
            {showCreateDistrictModal && (
              <div className="admin-modal-overlay" onClick={() => setShowCreateDistrictModal(false)}>
                <div className="admin-modal-content-v2" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-v2"><h4>Новый район</h4><button className="close-btn" onClick={() => setShowCreateDistrictModal(false)}>×</button></div>
                  <div className="modal-body-v2">
                    <div className="form-grid-v2">
                      <div className="form-group"><label>Название</label><input type="text" id="new-district-name" /></div>
                      <div className="form-group"><label>Код</label><input type="text" id="new-district-code" /></div>
                      <div className="form-row-v2">
                        <div className="form-group"><label>Lvl</label><input type="number" id="new-district-level" defaultValue={1} /></div>
                        <div className="form-group"><label>Порядок</label><input type="number" id="new-district-order" defaultValue={1} /></div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer-v2">
                    <button className="btn btn-secondary" onClick={() => setShowCreateDistrictModal(false)}>Отмена</button>
                    <button className="btn btn-primary" onClick={async () => {
                      const name = (document.getElementById('new-district-name') as HTMLInputElement).value
                      const code = (document.getElementById('new-district-code') as HTMLInputElement).value
                      try {
                        await apiClient.post('/admin/districts', {
                          name, code,
                          requiredLevel: parseInt((document.getElementById('new-district-level') as HTMLInputElement).value),
                          order: parseInt((document.getElementById('new-district-order') as HTMLInputElement).value),
                          isActive: true
                        })
                        setShowCreateDistrictModal(false); loadDistricts()
                      } catch (e: any) { alert(e.message) }
                    }}>Создать</button>
                  </div>
                </div>
              </div>
            )}

            {editingDistrict && (
              <div className="admin-modal-overlay" onClick={() => setEditingDistrict(null)}>
                <div className="admin-modal-content-v2" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-v2"><h4>Изменить район</h4><button className="close-btn" onClick={() => setEditingDistrict(null)}>×</button></div>
                  <div className="modal-body-v2">
                    <div className="form-grid-v2">
                      <div className="form-group"><label>Название</label><input type="text" value={editingDistrict.name} onChange={e => setEditingDistrict({...editingDistrict, name: e.target.value})} /></div>
                      <div className="form-row-v2">
                        <div className="form-group"><label>Lvl</label><input type="number" value={editingDistrict.requiredLevel} onChange={e => setEditingDistrict({...editingDistrict, requiredLevel: parseInt(e.target.value)})} /></div>
                        <div className="form-group"><label>Доход</label><input type="number" value={editingDistrict.baseIncomePerDay} onChange={e => setEditingDistrict({...editingDistrict, baseIncomePerDay: parseInt(e.target.value)})} /></div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer-v2">
                    <button className="btn btn-secondary" onClick={() => setEditingDistrict(null)}>Отмена</button>
                    <button className="btn btn-primary" onClick={async () => {
                      try {
                        const { id, ...data } = editingDistrict
                        await apiClient.put(`/admin/districts/${id}`, data)
                        setEditingDistrict(null); loadDistricts()
                      } catch (e: any) { alert(e.message) }
                    }}>Сохранить</button>
                  </div>
                </div>
              </div>
            )}

            {(showCreateBuildingModal || selectedBuilding) && (
              <div className="admin-modal-overlay" onClick={() => { 
                setShowCreateBuildingModal(false); 
                setSelectedBuilding(null);
                setNewBuilding({ type: '', name: '', icon: '', image: '', basePrice: 0, baseIncomePerHour: 0, maxAccumulation: 0, maxLevel: 10, upgradeMultiplier: 1.15, incomeMultiplier: 0.07, districtId: '' });
              }}>
                <div className="admin-modal-content-v2" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-v2"><h4>{selectedBuilding ? 'Редактировать строение' : 'Новое строение'}</h4><button className="close-btn" onClick={() => { 
                    setShowCreateBuildingModal(false); 
                    setSelectedBuilding(null);
                    setNewBuilding({ type: '', name: '', icon: '', image: '', basePrice: 0, baseIncomePerHour: 0, maxAccumulation: 0, maxLevel: 10, upgradeMultiplier: 1.15, incomeMultiplier: 0.07, districtId: '' });
                  }}>×</button></div>
                  <div className="modal-body-v2">
                    {(() => {
                      const b = selectedBuilding || newBuilding
                      const setB = selectedBuilding ? setSelectedBuilding : setNewBuilding
                      return (
                        <div className="form-grid-v2">
                          <div className="form-group">
                            <label>Название</label>
                            <input 
                              type="text" 
                              value={b.name || ''} 
                              onChange={e => setB({...b, name: e.target.value})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Тип (shop, factory, etc.)</label>
                            <input 
                              type="text" 
                              value={b.type || ''} 
                              onChange={e => setB({...b, type: e.target.value})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Доход в час (NAR)</label>
                            <input 
                              type="number" 
                              value={b.baseIncomePerHour || 0} 
                              onChange={e => setB({...b, baseIncomePerHour: parseInt(e.target.value) || 0})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Базовая цена (NAR)</label>
                            <input 
                              type="number" 
                              value={b.basePrice || 0} 
                              onChange={e => setB({...b, basePrice: parseInt(e.target.value) || 0})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Макс. накопление (NAR)</label>
                            <input 
                              type="number" 
                              value={b.maxAccumulation || 0} 
                              onChange={e => setB({...b, maxAccumulation: parseInt(e.target.value) || 0})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Макс. уровень</label>
                            <input 
                              type="number" 
                              value={b.maxLevel || 10} 
                              onChange={e => setB({...b, maxLevel: parseInt(e.target.value) || 10})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Множитель улучшения</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={b.upgradeMultiplier || 1.15} 
                              onChange={e => setB({...b, upgradeMultiplier: parseFloat(e.target.value) || 1.15})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Множитель дохода за уровень</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={b.incomeMultiplier || 0.07} 
                              onChange={e => setB({...b, incomeMultiplier: parseFloat(e.target.value) || 0.07})} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Район (ID)</label>
                            <select
                              value={b.districtId || ''}
                              onChange={e => setB({...b, districtId: e.target.value})}
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
                              value={b.icon || ''} 
                              onChange={e => setB({...b, icon: e.target.value})} 
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label>Фото строения (URL)</label>
                            <input 
                              type="text" 
                              value={b.image || ''} 
                              onChange={e => setB({...b, image: e.target.value})} 
                            />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="modal-footer-v2">
                    <button className="btn btn-primary" onClick={async () => {
                      const b = selectedBuilding || newBuilding
                      try {
                        if (selectedBuilding) await apiClient.put(`/admin/buildings/${selectedBuilding.id}`, selectedBuilding)
                        else await apiClient.post('/admin/buildings', b)
                        setShowCreateBuildingModal(false); 
                        setSelectedBuilding(null);
                        setNewBuilding({ type: '', name: '', icon: '', image: '', basePrice: 0, baseIncomePerHour: 0, maxAccumulation: 0, maxLevel: 10, upgradeMultiplier: 1.15, incomeMultiplier: 0.07, districtId: '' });
                        loadBuildings()
                      } catch (e: any) { alert(e.message) }
                    }}>Готово</button>
                  </div>
                </div>
              </div>
            )}
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
            <h3>Цены подписок</h3>
            {subscriptionPrices === null && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#2a2a2a', borderRadius: '8px', color: '#aaa' }}>
                Цены не установлены. Заполните и сохраните цены ниже.
              </div>
            )}
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {/* 1 месяц */}
              <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '12px', color: '#fff', fontWeight: 'bold' }}>1 месяц</label>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена TRIBUTE</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subscriptionPrices?.month_1?.tribute || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_1: { ...(subscriptionPrices?.month_1 || {}), tribute: parseFloat(e.target.value) || 0 } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена STARS ⭐</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subscriptionPrices?.month_1?.stars || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_1: { ...(subscriptionPrices?.month_1 || {}), stars: parseFloat(e.target.value) || 0 } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Ссылка TRIBUTE</label>
                  <input
                    type="text"
                    placeholder="https://t.me/tribute/app?startapp=p123"
                    value={subscriptionPrices?.month_1?.tributeLink || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_1: { ...(subscriptionPrices?.month_1 || {}), tributeLink: e.target.value } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>
              {/* 3 месяца */}
              <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '12px', color: '#fff', fontWeight: 'bold' }}>3 месяца</label>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена TRIBUTE</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subscriptionPrices?.month_3?.tribute || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_3: { ...(subscriptionPrices?.month_3 || {}), tribute: parseFloat(e.target.value) || 0 } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена STARS ⭐</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subscriptionPrices?.month_3?.stars || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_3: { ...(subscriptionPrices?.month_3 || {}), stars: parseFloat(e.target.value) || 0 } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Ссылка TRIBUTE</label>
                  <input
                    type="text"
                    placeholder="https://t.me/tribute/app?startapp=p123"
                    value={subscriptionPrices?.month_3?.tributeLink || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_3: { ...(subscriptionPrices?.month_3 || {}), tributeLink: e.target.value } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>
              {/* 12 месяцев */}
              <div style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '12px', color: '#fff', fontWeight: 'bold' }}>12 месяцев</label>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена TRIBUTE</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subscriptionPrices?.month_12?.tribute || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_12: { ...(subscriptionPrices?.month_12 || {}), tribute: parseFloat(e.target.value) || 0 } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена STARS ⭐</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subscriptionPrices?.month_12?.stars || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_12: { ...(subscriptionPrices?.month_12 || {}), stars: parseFloat(e.target.value) || 0 } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Ссылка TRIBUTE</label>
                  <input
                    type="text"
                    placeholder="https://t.me/tribute/app?startapp=p123"
                    value={subscriptionPrices?.month_12?.tributeLink || ''}
                    onChange={(e) => setSubscriptionPrices({ 
                      ...(subscriptionPrices || {}), 
                      month_12: { ...(subscriptionPrices?.month_12 || {}), tributeLink: e.target.value } 
                    })}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await apiClient.put('/admin/prices/subscription', subscriptionPrices || {})
                  alert('Цены подписок обновлены')
                  await loadSubscriptionPrices()
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
                <div key={idx} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Количество NAR"
                      value={pkg.amount || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value)
                        const newPackages = [...narCoinPackages]
                        newPackages[idx].amount = isNaN(value) ? 0 : value
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
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Цена STARS ⭐</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Цена STARS"
                      value={pkg.priceStars ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value)
                        const newPackages = [...narCoinPackages]
                        newPackages[idx].priceStars = isNaN(value) ? 0 : value
                        setNarCoinPackages(newPackages)
                      }}
                      style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                    />
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '12px' }}>Ссылка TRIBUTE</label>
                    <input
                      type="text"
                      placeholder="https://t.me/tribute/app?startapp=p123"
                      value={pkg.tributeLink || ''}
                      onChange={(e) => {
                        const newPackages = [...narCoinPackages]
                        newPackages[idx].tributeLink = e.target.value
                        setNarCoinPackages(newPackages)
                      }}
                      style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', color: '#fff' }}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => setNarCoinPackages([...narCoinPackages, { amount: 0, priceStars: 0, tributeLink: '' }])}
                style={{ padding: '8px 16px', background: '#4a9eff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
              >
                + Добавить пакет
              </button>
              <button
                onClick={async () => {
                  console.log('📤 Отправка пакетов NAR-coin:', JSON.stringify(narCoinPackages, null, 2))
                  try {
                    const response = await apiClient.put('/admin/prices/nar-coin', { packages: narCoinPackages })
                    console.log('✅ Ответ от сервера:', response.data)
                    alert('Пакеты NAR-coin обновлены')
                    await loadNarCoinPrices()
                  } catch (error: any) {
                    console.error('❌ Ошибка сохранения:', error)
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

                <div>
                  <h4 style={{ marginBottom: '12px' }}>Базовый XP за матч</h4>
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
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Тренировка vs AI</label>
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
                  <h4 style={{ marginBottom: '12px' }}>Множители результата</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Победа</label>
                    <input 
                      type="number" step="0.01"
                      value={progressionConfig.xp.multipliers.win} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, win: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Поражение</label>
                    <input 
                      type="number" step="0.01"
                      value={progressionConfig.xp.multipliers.loss} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, loss: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Марс (разгром)</label>
                    <input 
                      type="number" step="0.01"
                      value={progressionConfig.xp.multipliers.marsWin} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, multipliers: { ...progressionConfig.xp.multipliers, marsWin: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Макс. множитель XP за матч (Gear + Buffs)</label>
                    <input 
                      type="number" step="0.01"
                      value={progressionConfig.xp.caps.maxMatchXpMult} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, caps: { ...progressionConfig.xp.caps, maxMatchXpMult: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '12px' }}>Сила соперника</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Знаменатель (Rating Diff / X)</label>
                    <input 
                      type="number" 
                      value={progressionConfig.xp.opponentMult?.denominator || 2000} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, opponentMult: { ...progressionConfig.xp.opponentMult, denominator: parseInt(e.target.value) || 1 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Мин. множитель</label>
                    <input 
                      type="number" step="0.01"
                      value={progressionConfig.xp.opponentMult?.min || 0.85} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, opponentMult: { ...progressionConfig.xp.opponentMult, min: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Макс. множитель</label>
                    <input 
                      type="number" step="0.01"
                      value={progressionConfig.xp.opponentMult?.max || 1.20} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, opponentMult: { ...progressionConfig.xp.opponentMult, max: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '12px' }}>Clean Play (Античит)</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>High Trust</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.cleanPlayMultipliers?.high || 1.0} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, cleanPlayMultipliers: { ...progressionConfig.xp.cleanPlayMultipliers, high: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Medium Trust</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.cleanPlayMultipliers?.medium || 0.7} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, cleanPlayMultipliers: { ...progressionConfig.xp.cleanPlayMultipliers, medium: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>Low Trust</label>
                    <input 
                      type="number" step="0.1"
                      value={progressionConfig.xp.cleanPlayMultipliers?.low || 0.5} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        xp: { ...progressionConfig.xp, cleanPlayMultipliers: { ...progressionConfig.xp.cleanPlayMultipliers, low: parseFloat(e.target.value) || 0 } }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ marginBottom: '12px' }}>Анти-фарм: множители за повторные матчи (24 часа)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                  {progressionConfig.xp.multipliers.repeatOpponent.map((mult: number, idx: number) => (
                    <div key={idx}>
                      <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Матч {idx + 1}</label>
                      <input 
                        type="number" step="0.01"
                        value={mult} 
                        style={{ width: '100%', padding: '4px' }}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <h4 style={{ marginBottom: '12px' }}>Очки прокачки (Skill Points)</h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', color: '#aaa' }}>За уровни 2-5 (на каждый уровень)</label>
                    <input 
                      type="number" 
                      value={progressionConfig.skillPoints.levels2To5} 
                      onChange={(e) => setProgressionConfig({
                        ...progressionConfig,
                        skillPoints: { ...progressionConfig.skillPoints, levels2To5: parseInt(e.target.value) || 0 }
                      })}
                    />
                    <label style={{ fontSize: '14px', color: '#aaa' }}>За уровни 6-50 (на каждый уровень)</label>
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
                <div>
                  <h4 style={{ marginBottom: '12px' }}>Действия</h4>
                  <button className="btn btn-secondary" onClick={() => {
                    // Генерируем пороги XP по формуле из ТЗ
                    const A = progressionConfig.xpCurve?.A || 350;
                    const maxL = progressionConfig.maxLevel || 50;
                    const thresholds: Record<number, number> = {};
                    const rewards: Record<number, number> = {};
                    
                    // Базовые пороги GWars (примерные для формы)
                    const gwarsBase = [0, 1750, 5250, 12950, 26600, 50050, 76513, 111146, 155133, 223947, 274745];
                    
                    for (let l = 1; l <= maxL; l++) {
                      let factor = A;
                      if (l > 5) {
                        const t = (l - 5) / (maxL - 5);
                        factor = Math.exp(Math.log(A) * (1 - t));
                      }
                      
                      // Награда: 5 уровень - 10000, остальные по 1000 за уровень (пример)
                      rewards[l] = l === 5 ? 10000 : 1000 * l;
                      
                      // Порог: используем упрощенную кубическую зависимость для примера автогенерации
                      // В реальности администратор подправит вручную
                      if (l <= 10) {
                        thresholds[l] = gwarsBase[l] || (l * l * l * 100 * factor / A);
                      } else {
                        thresholds[l] = Math.round(l * l * l * 300 * factor);
                      }
                    }
                    
                    setProgressionConfig({
                      ...progressionConfig,
                      xp: { ...progressionConfig.xp, thresholds },
                      levelRewards: rewards
                    });
                  }}>
                    🔄 Сгенерировать пороги и награды по формуле
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '32px' }}>
                <h4 style={{ marginBottom: '16px' }}>Пороги XP для уровней (Total XP)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                  {Object.entries(progressionConfig.xp.thresholds).sort(([a], [b]) => Number(a) - Number(b)).map(([level, xp]: [any, any]) => (
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
                  {progressionConfig.levelRewards && Object.entries(progressionConfig.levelRewards).sort(([a], [b]) => Number(a) - Number(b)).map(([level, reward]: [any, any]) => (
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
          <h2 style={{ marginBottom: '24px' }}>Статистика платежей</h2>

          <div className="stats-grid" style={{ marginBottom: '32px' }}>
              <div className="stat-card">
                <h3>Итоги (Completed)</h3>
                <div className="stat-value">
                  {paymentStats.summary
                    .filter((s: any) => s.status === 'completed')
                    .reduce((acc: number, s: any) => acc + s.totalAmount, 0)
                    .toFixed(2)} STARS
                </div>
                <div className="stat-details">
                  {paymentStats.summary.map((s: any) => (
                    <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{s.status.toUpperCase()}:</span>
                      <span>{s.count} ({s.totalAmount.toFixed(2)} STARS)</span>
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
                    <span>{t.count} транз. ({t.totalAmount.toFixed(2)} STARS)</span>
                  </div>
                ))}
              </div>
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
                        <div style={{ fontSize: '12px', color: '#aaa' }}>{tx.id ? `${tx.id.substring(0, 8)}...` : 'N/A'}</div>
                        <div>{new Date(tx.createdAt).toLocaleString()}</div>
                      </td>
                      <td>
                        {tx.user ? (
                          <>
                            <div style={{ fontWeight: 'bold' }}>{tx.user.nickname || tx.user.username}</div>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>{tx.user.id ? `${tx.user.id.substring(0, 8)}...` : 'N/A'}</div>
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
                          <div><span style={{ color: '#aaa' }}>To:</span> {tx.toAddress ? `${tx.toAddress.substring(0, 8)}...` : 'N/A'}</div>
                          {tx.txHash && <div><span style={{ color: '#aaa' }}>Hash:</span> {tx.txHash.length > 8 ? `${tx.txHash.substring(0, 8)}...` : tx.txHash}</div>}
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

      {/* РАЗДЕЛ ЭКИПИРОВКИ (V2.0) */}
      {activeTab === 'equipment-config' && progressionConfig && (
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2>Настройки экипировки и износа (v2.0)</h2>
            <button 
              className="admin-btn primary"
              onClick={handleSaveProgressionConfig}
              disabled={isSavingProgression}
            >
              {isSavingProgression ? 'Сохранение...' : '💾 Сохранить настройки экипировки'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Износ */}
            <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ color: '#ff9800', marginBottom: '20px' }}>Износ (Wear)</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="form-group-v2">
                  <label>Множитель в турнирах (tournament_wear_mult)</label>
                  <input type="number" step="0.1" value={progressionConfig.equipment?.wear?.tournamentMult || 2.0} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      equipment: { 
                        ...progressionConfig.equipment, 
                        wear: { ...progressionConfig.equipment?.wear, tournamentMult: parseFloat(e.target.value) || 0 } 
                      }
                    })} />
                </div>
                <div className="form-group-v2">
                  <label>Износ за партию (BOARD/CHECKERS/...)</label>
                  <input type="number" value={progressionConfig.equipment?.wear?.perMatchDefault || 1} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      equipment: { 
                        ...progressionConfig.equipment, 
                        wear: { ...progressionConfig.equipment?.wear, perMatchDefault: parseInt(e.target.value) || 0 } 
                      }
                    })} />
                </div>
                <div className="form-group-v2">
                  <label>Износ за бросок (DIE_1/DIE_2)</label>
                  <input type="number" value={progressionConfig.equipment?.wear?.perRollDefault || 1} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      equipment: { 
                        ...progressionConfig.equipment, 
                        wear: { ...progressionConfig.equipment?.wear, perRollDefault: parseInt(e.target.value) || 0 } 
                      }
                    })} />
                </div>
              </div>
            </div>

            {/* Ремонт */}
            <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ color: '#2196f3', marginBottom: '20px' }}>Ремонт (Repair)</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="form-group-v2">
                  <label>Множитель за уровень игрока (player_level * 0.01)</label>
                  <input type="number" step="0.001" value={progressionConfig.equipment?.repair?.levelMultPerLevel || 0.01} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      equipment: { 
                        ...progressionConfig.equipment, 
                        repair: { ...progressionConfig.equipment?.repair, levelMultPerLevel: parseFloat(e.target.value) || 0 } 
                      }
                    })} />
                </div>
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Множители зон ремонта (repair_zone_mult)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="form-group-v2">
                      <label>Зона A (&gt;50%)</label>
                      <input type="number" step="0.1" value={progressionConfig.equipment?.repair?.zoneMult?.A || 1.0} 
                        onChange={(e) => setProgressionConfig({
                          ...progressionConfig, 
                          equipment: { 
                            ...progressionConfig.equipment, 
                            repair: { 
                              ...progressionConfig.equipment?.repair, 
                              zoneMult: { ...progressionConfig.equipment?.repair?.zoneMult, A: parseFloat(e.target.value) || 0 } 
                            } 
                          }
                        })} />
                    </div>
                    <div className="form-group-v2">
                      <label>Зона B (25-50%)</label>
                      <input type="number" step="0.1" value={progressionConfig.equipment?.repair?.zoneMult?.B || 1.3} 
                        onChange={(e) => setProgressionConfig({
                          ...progressionConfig, 
                          equipment: { 
                            ...progressionConfig.equipment, 
                            repair: { 
                              ...progressionConfig.equipment?.repair, 
                              zoneMult: { ...progressionConfig.equipment?.repair?.zoneMult, B: parseFloat(e.target.value) || 0 } 
                            } 
                          }
                        })} />
                    </div>
                    <div className="form-group-v2">
                      <label>Зона C (&lt;25%)</label>
                      <input type="number" step="0.1" value={progressionConfig.equipment?.repair?.zoneMult?.C || 1.8} 
                        onChange={(e) => setProgressionConfig({
                          ...progressionConfig, 
                          equipment: { 
                            ...progressionConfig.equipment, 
                            repair: { 
                              ...progressionConfig.equipment?.repair, 
                              zoneMult: { ...progressionConfig.equipment?.repair?.zoneMult, C: parseFloat(e.target.value) || 0 } 
                            } 
                          }
                        })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Марс и XP */}
            <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ color: '#f44336', marginBottom: '20px' }}>Бонусы Марса и XP</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="form-group-v2">
                  <label>Кулдаун бонуса Марса (часы)</label>
                  <input type="number" value={progressionConfig.xp?.mars?.cooldownHours || 4} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      xp: { ...progressionConfig.xp, mars: { ...progressionConfig.xp?.mars, cooldownHours: parseInt(e.target.value) || 0 } }
                    })} />
                </div>
                <div className="form-group-v2">
                  <label>Множитель Марса (mars_xp_mult)</label>
                  <input type="number" step="0.1" value={progressionConfig.xp?.mars?.mult || 2.0} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      xp: { ...progressionConfig.xp, mars: { ...progressionConfig.xp?.mars, mult: parseFloat(e.target.value) || 0 } }
                    })} />
                </div>
                <div className="form-group-v2">
                  <label>Кап множителя XP от экипировки (gear_xp_mult_cap)</label>
                  <input type="number" step="0.01" value={progressionConfig.caps?.gearXpMultCap || 1.50} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      caps: { ...progressionConfig.caps, gearXpMultCap: parseFloat(e.target.value) || 0 }
                    })} />
                </div>
              </div>
            </div>

            {/* Комиссии и Лимиты */}
            <div style={{ background: '#2a2a2a', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ color: '#9c27b0', marginBottom: '20px' }}>Комиссии и Лимиты</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="form-group-v2">
                  <label>Базовая комиссия (commission_base)</label>
                  <input type="number" step="0.01" value={progressionConfig.commission?.base || 0.15} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      commission: { ...progressionConfig.commission, base: parseFloat(e.target.value) || 0 }
                    })} />
                </div>
                <div className="form-group-v2">
                  <label>Мин. комиссия от статов (commission_stats_min)</label>
                  <input type="number" step="0.01" value={progressionConfig.commission?.statsMin || 0.10} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      commission: { ...progressionConfig.commission, statsMin: parseFloat(e.target.value) || 0 }
                    })} />
                </div>
                <div className="form-group-v2">
                  <label>Абсолютный минимум комиссии (commission_min)</label>
                  <input type="number" step="0.01" value={progressionConfig.commission?.min || 0.05} 
                    onChange={(e) => setProgressionConfig({
                      ...progressionConfig, 
                      commission: { ...progressionConfig.commission, min: parseFloat(e.target.value) || 0 }
                    })} />
                </div>
              </div>
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
                    value={selectedBuilding.upgradeMultiplier || 1.15}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, upgradeMultiplier: parseFloat(e.target.value) || 1.15 })}
                  />
                </div>
                <div>
                  <label>Множитель дохода за уровень</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedBuilding.incomeMultiplier || 0.07}
                    onChange={(e) => setSelectedBuilding({ ...selectedBuilding, incomeMultiplier: parseFloat(e.target.value) || 0.07 })}
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

      {/* Модальное окно приватного ключа кошелька */}
      {walletPrivateKeyModal && (
        <div className="admin-modal-overlay" onClick={() => setWalletPrivateKeyModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Информация о кошельке</h3>
              <button className="admin-modal-close" onClick={() => setWalletPrivateKeyModal(null)}>×</button>
            </div>
            <div className="admin-modal-content">
              <div className="form-group">
                <label>Адрес кошелька</label>
                <div style={{ 
                  background: '#1a1a1a', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #3a3a3a',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#fff'
                }}>
                  {walletPrivateKeyModal.address}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(walletPrivateKeyModal.address)
                    alert('Адрес скопирован в буфер обмена')
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: '#3a3a3a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Копировать адрес
                </button>
              </div>

              <div className="form-group">
                <label>Приватный ключ</label>
                <div style={{ 
                  background: '#1a1a1a', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #3a3a3a',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#ff6b6b',
                  position: 'relative'
                }}>
                  {walletPrivateKeyModal.privateKey}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(walletPrivateKeyModal.privateKey)
                    alert('Приватный ключ скопирован в буфер обмена')
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    background: '#ff6b6b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Копировать приватный ключ
                </button>
              </div>

              {walletPrivateKeyModal.wallet && (
                <div className="form-group">
                  <label>Дополнительная информация</label>
                  <div style={{ 
                    background: '#1a1a1a', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid #3a3a3a',
                    fontSize: '13px',
                    color: '#B6B6B6'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>ID пользователя:</strong> {walletPrivateKeyModal.wallet.userId || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Тип кошелька:</strong> {walletPrivateKeyModal.wallet.walletType || 'TON'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Баланс:</strong> {typeof walletPrivateKeyModal.wallet.balance === 'number' ? walletPrivateKeyModal.wallet.balance.toFixed(4) : '0.0000'} TON
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Статус:</strong> {walletPrivateKeyModal.wallet.isActive ? 'Активен' : 'Неактивен'}
                    </div>
                    <div>
                      <strong>Создан:</strong> {new Date(walletPrivateKeyModal.wallet.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ 
                marginTop: '20px', 
                padding: '12px', 
                background: 'rgba(255, 107, 107, 0.1)', 
                border: '1px solid rgba(255, 107, 107, 0.3)', 
                borderRadius: '8px',
                fontSize: '12px',
                color: '#ff6b6b'
              }}>
                ⚠️ Внимание! Приватный ключ дает полный доступ к кошельку. Храните его в безопасности и никому не передавайте.
              </div>

              <div className="edit-form-actions" style={{ marginTop: '20px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setWalletPrivateKeyModal(null)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* РАЗДЕЛ БИЗНЕСА */}
      {activeTab === 'business' && (
        <div className="admin-section">
          <h2>Управление бизнесом</h2>
          
          {/* Районы */}
          <div style={{ marginBottom: '32px' }}>
            <h3>Районы</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {businessData.districts.map((district: any) => (
                <div key={district.id} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                  <div><strong>{district.displayName}</strong></div>
                  <div style={{ fontSize: '12px', color: '#B6B6B6' }}>{district.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Бизнесы */}
          <div style={{ marginBottom: '32px' }}>
            <h3>Бизнесы</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {businessData.businesses.map((business: any) => (
                <div key={business.id} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                  <div><strong>{business.name}</strong></div>
                  <div style={{ fontSize: '12px', color: '#B6B6B6' }}>
                    Класс: {business.businessClass} | Район: {business.district?.displayName || business.districtId}
                  </div>
                  <div style={{ fontSize: '12px', color: '#B6B6B6' }}>
                    Мин. уровень: {business.minLevel} | Пакет материалов: {business.materialPackage}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Материалы */}
          <div style={{ marginBottom: '32px' }}>
            <h3>Материалы</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {businessData.materials.map((material: any) => (
                <div key={material.id} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                  <div><strong>{material.name}</strong></div>
                  <div style={{ fontSize: '12px', color: '#B6B6B6' }}>
                    Тип: {material.type} | Сорт: {material.sort}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Лицензии */}
          <div>
            <h3>Лицензии</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {businessData.licenses.map((license: any) => (
                <div key={license.id} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '8px' }}>
                  <div><strong>{license.name}</strong></div>
                  <div style={{ fontSize: '12px', color: '#B6B6B6' }}>
                    Код: {license.code} | Тип: {license.type}
                  </div>
                  <div style={{ fontSize: '12px', color: '#B6B6B6' }}>
                    Мин. уровень: {license.minLevel} | Цена: {license.currency === 'NAR' ? `${license.priceNar} NAR` : `${license.priceUsdt} USDT`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

