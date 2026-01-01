import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api/client'
import './Home.css'

interface Stats {
  narCoin: number
  xp: number
  level: number
  energy: number
  maxEnergy: number
  lives: number
  maxLives: number
  economy: number
  power: number
  incomePerHour: number
}

interface LevelProgress {
  currentLevel: number
  currentXP: number
  xpForCurrentLevel: number
  xpForNextLevel: number
  xpNeededForNextLevel: number
  progress: number
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats>({ 
    narCoin: 0, 
    xp: 0, 
    level: 1, 
    energy: 100, 
    maxEnergy: 100,
    lives: 5,
    maxLives: 5,
    economy: 0,
    power: 0,
    incomePerHour: 0
  })
  const [hasPremium, setHasPremium] = useState(false)
  const [hasNotifications, setHasNotifications] = useState(false)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)

  useEffect(() => {
    if (user) {
      try {
        const narCoin = typeof user.narCoin === 'bigint' ? Number(user.narCoin) : (user.narCoin || 0)
        const xp = typeof user.xp === 'bigint' ? Number(user.xp) : (user.xp || 0)
        setStats({
          narCoin: Number(narCoin) || 0,
          xp: Number(xp) || 0,
          level: user.level || 1,
          energy: user.energy || 100,
          maxEnergy: user.maxEnergy || 100,
          lives: user.lives || 5,
          maxLives: user.maxLives || 5,
          economy: user.economySp || 0,
          power: user.powerSp || 0,
          incomePerHour: 0, // Будет загружено отдельно
        })
        checkPremium()
        checkNotifications()
        loadEnergy()
        loadLevelProgress()
        loadPlayerStats()
      } catch (error) {
        console.error('Ошибка при загрузке статистики:', error)
        setStats({ 
          narCoin: 0, 
          xp: 0, 
          level: 1, 
          energy: 100, 
          maxEnergy: 100,
          lives: 5,
          maxLives: 5,
          economy: 0,
          power: 0,
          incomePerHour: 0
        })
      }
    }
  }, [user])

  const loadEnergy = async () => {
    try {
      const response = await apiClient.get('/progress/energy')
      setStats(prev => ({
        ...prev,
        energy: response.data.energy || prev.energy,
        maxEnergy: response.data.maxEnergy || prev.maxEnergy,
      }))
    } catch (error) {
      // Игнорируем ошибки
    }
  }

  const loadLevelProgress = async () => {
    try {
      const response = await apiClient.get('/progress/level-progress')
      setLevelProgress(response.data)
    } catch (error) {
      // Игнорируем ошибки
    }
  }

  const loadPlayerStats = async () => {
    try {
      // Загружаем доход в час из города
      const cityResponse = await apiClient.get('/city/my-buildings').catch(() => ({ data: [] }))
      const buildings = cityResponse.data || []
      let totalIncome = 0
      buildings.forEach((building: any) => {
        if (building.incomePerHour) {
          totalIncome += Number(building.incomePerHour) || 0
        }
      })
      // Конвертируем в тысячи для отображения
      const incomeInK = totalIncome / 1000
      // Загружаем данные пользователя для получения актуальных значений
      const userResponse = await apiClient.get('/users/me').catch(() => ({ data: user }))
      const currentUser = userResponse.data || user
      setStats(prev => ({ 
        ...prev, 
        incomePerHour: incomeInK,
        economy: currentUser?.economySp || 0,
        power: currentUser?.powerSp || 0,
        lives: currentUser?.lives || 5,
        maxLives: currentUser?.maxLives || 5,
      }))
    } catch (error) {
      // Игнорируем ошибки
    }
  }


  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status')
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }

  const checkNotifications = async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count')
      setHasNotifications((response.data?.count || 0) > 0)
    } catch (error) {
      // Игнорируем ошибки
      setHasNotifications(false)
    }
  }

  if (!user) {
    return null
  }

  const mainMenuItems = [
    { icon: '/img/зарик.png', title: 'Играть', path: '/game/modes' },
    { icon: '/img/шляпа.png', title: 'Курсы', path: '/academy' },
    { icon: '/img/город.png', title: 'Город', path: '/city' },
    { icon: '/img/кланы.png', title: 'Кланы', path: '/clans', disabled: (user?.level || 0) < 10 },
  ]

  return (
    <div className="app-container page-transition">
      {/* Хедер с профилем */}
      <div className="home-header-v2">
        <div className="home-header-left-v2">
          <div className="home-avatar-v2" onClick={() => navigate('/profile')}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} />
            ) : (
              <div className="home-avatar-placeholder-v2">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#B6B6B6"/>
                  <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="#B6B6B6"/>
                </svg>
              </div>
            )}
            {hasNotifications && <div className="home-avatar-notification-v2" />}
          </div>
          <div className="home-user-info-v2">
            <div className="home-username-v2">{user?.nickname || user?.username || 'Игрок'}</div>
            <div className="home-currencies-v2">
              <div className="home-currency-item-v2">
                <span className="home-currency-icon-v2">💰</span>
                <span>{stats.narCoin.toLocaleString()}</span>
              </div>
              <div className="home-currency-item-v2">
                <span className="home-currency-icon-v2" style={{ color: '#4caf50' }}>💎</span>
                <span style={{ color: '#4caf50' }}>{(stats.narCoin / 10).toLocaleString()}</span>
              </div>
            </div>
            <div className="home-level-v2">
              <span>Lvl {stats.level}</span>
              {levelProgress && (
                <div className="home-level-progress-v2">
                  <div className="home-level-progress-bar-v2">
                    <div 
                      className="home-level-progress-fill-v2" 
                      style={{ width: `${levelProgress.progress * 100}%` }}
                    />
                  </div>
                  <span className="home-level-progress-text-v2">
                    {levelProgress.currentXP - levelProgress.xpForCurrentLevel}/{levelProgress.xpNeededForNextLevel}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <button 
          className="home-federations-btn-v2"
          onClick={() => navigate('/clans')}
          disabled={(user?.level || 0) < 10}
        >
          Федерации
        </button>
      </div>

      <div className="home-content-v2">
        {/* Статистика */}
        <div className="home-stats-grid-v2">
          <div className="home-stat-card-v2">
            <div className="home-stat-label-v2">Экономика</div>
            <div className="home-stat-value-v2">{stats.economy}</div>
          </div>
          <div className="home-stat-card-v2">
            <div className="home-stat-label-v2">Сила</div>
            <div className="home-stat-value-v2">{stats.power}</div>
          </div>
          <div className="home-stat-card-v2">
            <div className="home-stat-label-v2">Доход в час</div>
            <div className="home-stat-value-v2">
              <span className="home-stat-icon-v2">💰</span>
              +{stats.incomePerHour.toLocaleString()}K
            </div>
          </div>
          <div className="home-stat-card-v2">
            <div className="home-stat-label-v2">Жизнь</div>
            <div className="home-stat-value-v2">{stats.lives}/{stats.maxLives}</div>
          </div>
          <div className="home-stat-card-v2">
            <div className="home-stat-label-v2">Энергия</div>
            <div className="home-stat-value-v2">{stats.energy}/{stats.maxEnergy}</div>
          </div>
        </div>

        {/* Главное меню */}
        <div className="home-main-menu-v2">
          {mainMenuItems.map((item) => {
            const isDisabled = item.disabled
            return (
              <button
                key={item.path}
                onClick={() => !isDisabled && navigate(item.path)}
                className="home-main-menu-item-v2"
                disabled={isDisabled}
              >
                <img src={item.icon} alt={item.title} className="home-main-menu-icon-v2" />
                <span className="home-main-menu-title-v2">{item.title}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}