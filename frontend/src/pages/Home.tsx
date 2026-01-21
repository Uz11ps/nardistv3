import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api/client'
import BottomNav from '../components/BottomNav'
import { BoxIcon, SettingsIcon, ArrowRightIcon } from '../components/Icons'
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
    level: 0, 
    energy: 0, 
    maxEnergy: 0,
    lives: 0,
    maxLives: 0,
    economy: 0,
    power: 0,
    incomePerHour: 0
  })
  const [hasPremium, setHasPremium] = useState(false)
  const [hasNotifications, setHasNotifications] = useState(false)
  const [hasUnclaimedQuests, setHasUnclaimedQuests] = useState(false)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  const [levelUpNotification, setLevelUpNotification] = useState<{ level: number; reward: number } | null>(null)

  useEffect(() => {
    if (user) {
      try {
        const narCoin = typeof user.narCoin === 'bigint' ? Number(user.narCoin) : (user.narCoin || 0)
        const xp = typeof user.xp === 'bigint' ? Number(user.xp) : (user.xp || 0)
        const currentLevel = user.level !== undefined ? user.level : 0
        
        // Проверяем повышение уровня
        const previousLevel = parseInt(localStorage.getItem('previousLevel') || '0')
        if (currentLevel > previousLevel && currentLevel > 0) {
          // Загружаем награду за уровень
          apiClient.get(`/progress/level-reward/${currentLevel}`)
            .then(response => {
              setLevelUpNotification({
                level: currentLevel,
                reward: response.data.reward || 0
              })
              // Автоматически скрываем через 5 секунд
              setTimeout(() => {
                setLevelUpNotification(null)
              }, 5000)
            })
            .catch(error => {
              console.error('Ошибка при загрузке награды за уровень:', error)
            })
        }
        
        // Сохраняем текущий уровень для следующей проверки
        localStorage.setItem('previousLevel', currentLevel.toString())
        
        setStats({
          narCoin: Number(narCoin) || 0,
          xp: Number(xp) || 0,
          level: currentLevel,
          energy: user.energy !== undefined ? user.energy : 100,
          maxEnergy: user.maxEnergy !== undefined ? user.maxEnergy : 100,
          lives: user.lives !== undefined ? user.lives : 5,
          maxLives: user.maxLives !== undefined ? user.maxLives : 5,
          economy: user.economySp || 0,
          power: user.powerSp || 0,
          incomePerHour: 0, // Будет загружено отдельно
        })
        checkPremium()
        checkNotifications()
        checkUnclaimedQuests()
        loadEnergy()
        loadLevelProgress()
        loadPlayerStats()
        loadLeaderboard()
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

  const loadLeaderboard = async () => {
    try {
      const response = await apiClient.get('/ratings/leaderboard?mode=short&period=all&limit=10').catch(() => ({ data: [] }))
      setLeaderboard(response.data || [])
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
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

  const checkUnclaimedQuests = async () => {
    try {
      // Загружаем все квесты (daily и weekly)
      const [dailyResponse, weeklyResponse] = await Promise.all([
        apiClient.get('/quests/daily').catch(() => ({ data: { quests: [] } })),
        apiClient.get('/quests/weekly').catch(() => ({ data: { quests: [] } })),
      ])
      
      const allQuests = [
        ...(dailyResponse.data?.quests || []),
        ...(weeklyResponse.data?.quests || []),
      ]
      
      // Проверяем, есть ли квесты с completed === true и claimed === false
      const hasUnclaimed = allQuests.some((quest: any) => 
        quest.completed === true && quest.claimed === false
      )
      
      setHasUnclaimedQuests(hasUnclaimed)
    } catch (error) {
      console.error('Failed to check unclaimed quests:', error)
      setHasUnclaimedQuests(false)
    }
  }

  // Периодическая проверка невыполненных квестов
  useEffect(() => {
    if (user) {
      checkUnclaimedQuests()
      const interval = setInterval(checkUnclaimedQuests, 30000) // Проверяем каждые 30 секунд
      return () => clearInterval(interval)
    }
  }, [user])

  const handlePlayClick = async () => {
    try {
      // Проверяем наличие активной игры (включая бот-игры)
      const response = await apiClient.get('/games/active').catch(() => ({ data: { game: null } }))
      const activeGame = response.data?.game || response.data

      if (activeGame && activeGame.id && (activeGame.status === 'in_progress' || activeGame.status === 'waiting')) {
        // Если есть активная игра - переходим в неё
        navigate(`/game/${activeGame.id}`)
      } else {
        // Если нет активной игры - переходим на страницу выбора режима
        navigate('/game/modes')
      }
    } catch (error) {
      // Если ошибка при проверке активной игры - переходим на страницу выбора режима
      console.error('Ошибка при проверке активной игры:', error)
      navigate('/game/modes')
    }
  }

  if (!user) {
    return null
  }

  const mainMenuItems = [
    { icon: '/img/зарик.png', title: 'Играть', path: '/game/modes', onClick: handlePlayClick },
    { icon: '/img/шляпа.png', title: 'Курсы', path: '/academy' },
    { icon: '/img/город.png', title: 'Город', path: '/city' },
    { icon: '/img/кланы.png', title: 'Кланы', path: '/clans', disabled: (user?.level || 0) < 10 },
  ]

  return (
    <div className="home-container-v3 page-transition">
      <div className="home-background-overlay" />
      
      {/* Хедер с профилем */}
      <div className="home-header-v3">
        <div className="home-header-main-v3">
          <div className="home-avatar-v3" onClick={() => navigate('/profile')}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} />
            ) : (
              <div className="home-avatar-placeholder-v3">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#B6B6B6"/>
                  <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="#B6B6B6"/>
                </svg>
              </div>
            )}
            {hasNotifications && <div className="home-avatar-notification-v3" />}
          </div>
          <div className="home-user-info-v3">
            <div className="home-username-v3">{user?.nickname || user?.username || 'Игрок'}</div>
            <div className="home-currencies-v3">
              <div className="home-currency-item-v3">
                <img src="/img/narcoin.png" alt="NAR" className="home-currency-img-v3" />
                <span>{stats.narCoin.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        <button 
          className="home-federations-btn-v3"
          onClick={() => navigate('/clans')}
        >
          Федерации
        </button>
      </div>

      {/* Уведомление о повышении уровня */}
      {levelUpNotification && createPortal(
        <div className="level-up-modal-overlay" onClick={() => setLevelUpNotification(null)}>
          <div className="level-up-modal" onClick={(e) => e.stopPropagation()}>
            <div className="level-up-modal-content">
              <div className="level-up-modal-title">
                Поздравляем, вы достигли уровня {levelUpNotification.level}!
              </div>
              <div className="level-up-modal-reward">
                Ваша награда {levelUpNotification.reward.toLocaleString()} NAR!
              </div>
              <button
                className="level-up-modal-button"
                onClick={() => setLevelUpNotification(null)}
              >
                Отлично!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="home-level-section-v3">
        <div className="home-level-info-v3">
          <span>Lvl {stats.level}</span>
          <span>{levelProgress ? `${levelProgress.currentXP}/${levelProgress.xpNeededForNextLevel + levelProgress.xpForCurrentLevel}` : `${stats.xp}`}</span>
        </div>
        <div className="home-level-progress-bar-v3">
          <div 
            className="home-level-progress-fill-v3" 
            style={{ width: `${levelProgress?.progress ? levelProgress.progress * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="home-content-v3">
        {/* Статистика */}
        <div className="home-stats-grid-v3">
          <div className="home-stat-card-v3">
            <div className="home-stat-label-v3">Экономика</div>
            <div className="home-stat-value-v3">{stats.economy}</div>
          </div>
          <div className="home-stat-card-v3">
            <div className="home-stat-label-v3">Сила</div>
            <div className="home-stat-value-v3">{stats.power}</div>
          </div>
          <div className="home-stat-card-v3">
            <div className="home-stat-label-v3">Доход в час</div>
            <div className="home-stat-value-v3">
              <img src="/img/narcoin.png" alt="NAR" className="home-stat-icon-img-v3" />
              <span>+{stats.incomePerHour.toLocaleString()}K</span>
            </div>
          </div>
          <div className="home-stat-card-v3">
            <div className="home-stat-label-v3">Жизнь</div>
            <div className="home-stat-value-v3">{stats.lives}/{stats.maxLives}</div>
          </div>
          <div className="home-stat-card-v3">
            <div className="home-stat-label-v3">Энергия</div>
            <div className="home-stat-value-v3">{stats.energy}/{stats.maxEnergy}</div>
          </div>
        </div>

        {/* Центральное лого */}
        <div className="home-central-logo-container-v3">
          <div className="home-central-logo-circle-v3" onClick={handlePlayClick} style={{ cursor: 'pointer' }}>
            <img src="/img/logo.png" alt="Nardis" className="home-central-logo-v3" />
          </div>
        </div>

        {/* Лидерборд */}
        {leaderboard.length > 0 && (
          <div className="home-leaderboard-section-v3">
            <div className="home-leaderboard-header-v3" onClick={() => navigate('/leaderboard')}>
              <span className="home-leaderboard-title-v3">Лидерборд</span>
              <span className="home-leaderboard-more-v3">Все →</span>
            </div>
            <div className="home-leaderboard-list-v3">
              {leaderboard.slice(0, 5).map((entry, index) => (
                <div key={entry.user?.id || index} className="home-leaderboard-item-v3">
                  <div className="home-leaderboard-rank-v3">#{entry.rank}</div>
                  <div className="home-leaderboard-name-v3">{entry.user?.nickname || entry.user?.username || 'Игрок'}</div>
                  <div className="home-leaderboard-stats-v3">
                    <span>{entry.totalMatches || (entry.wins + entry.losses + (entry.draws || 0))} игр</span>
                    {entry.winRate !== null && entry.winRate !== undefined && (
                      <span> • {entry.winRate}%</span>
                    )}
                    <span> • Lvl {entry.user?.level || 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Меню под кнопкой "Игры" */}
        <div className="home-menu-panel-v3">
          {/* Квесты */}
          <div className="home-menu-panel-item-v3" onClick={() => navigate('/quests')}>
            <span className="home-menu-panel-icon-v3" style={{ position: 'relative' }}>
              <img src="/img/2aebac90f55da8043a26d9cc37815475d23caca9.png" alt="quests" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
              {hasUnclaimedQuests && (
                <span className="home-menu-panel-badge" />
              )}
            </span>
            <span className="home-menu-panel-title-v3">Квесты</span>
            <span className="home-menu-panel-arrow-v3">
              <ArrowRightIcon size={16} style={{ color: '#B6B6B6' }} />
            </span>
          </div>

          {/* Лидерборд */}
          <div className="home-menu-panel-item-v3" onClick={() => navigate('/leaderboard')}>
            <span className="home-menu-panel-icon-v3">
              <img src="/img/crown.png" alt="leaderboard" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
            </span>
            <span className="home-menu-panel-title-v3">Лидерборд</span>
            <span className="home-menu-panel-arrow-v3">
              <ArrowRightIcon size={16} style={{ color: '#B6B6B6' }} />
            </span>
          </div>

          {/* Инвентарь */}
          <div className="home-menu-panel-item-v3" onClick={() => navigate('/inventory')}>
            <span className="home-menu-panel-icon-v3">
              <BoxIcon size={30} style={{ color: '#FFD700' }} />
            </span>
            <span className="home-menu-panel-title-v3">Инвентарь</span>
            <span className="home-menu-panel-arrow-v3">
              <ArrowRightIcon size={16} style={{ color: '#B6B6B6' }} />
            </span>
          </div>

          {/* Уведомления */}
          <div className="home-menu-panel-item-v3" onClick={() => navigate('/notifications')}>
            <span className="home-menu-panel-icon-v3" style={{ position: 'relative' }}>
              <img src="/img/увед.png" alt="notifications" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
              {hasNotifications && <div className="home-menu-panel-notification-badge-v3" />}
            </span>
            <span className="home-menu-panel-title-v3">Уведомления</span>
            <span className="home-menu-panel-arrow-v3">
              <ArrowRightIcon size={16} style={{ color: '#B6B6B6' }} />
            </span>
          </div>

          {/* Аналитика */}
          <div className="home-menu-panel-item-v3" onClick={() => navigate('/history')}>
            <span className="home-menu-panel-icon-v3">
              <img src="/img/зарик.png" alt="analytics" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
            </span>
            <span className="home-menu-panel-title-v3">Аналитика</span>
            <span className="home-menu-panel-arrow-v3">
              <ArrowRightIcon size={16} style={{ color: '#B6B6B6' }} />
            </span>
          </div>

          {/* Настройки */}
          <div className="home-menu-panel-item-v3" onClick={() => navigate('/settings')}>
            <span className="home-menu-panel-icon-v3">
              <SettingsIcon size={30} style={{ color: '#FFD700' }} />
            </span>
            <span className="home-menu-panel-title-v3">Настройки</span>
            <span className="home-menu-panel-arrow-v3">
              <ArrowRightIcon size={16} style={{ color: '#B6B6B6' }} />
            </span>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}