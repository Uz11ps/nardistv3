import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ narCoin: 0, xp: 0, level: 1, energy: 100, maxEnergy: 100 })
  const [hasPremium, setHasPremium] = useState(false)
  const [hasNotifications, setHasNotifications] = useState(false)

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
        })
        checkPremium()
        checkNotifications()
        loadEnergy()
      } catch (error) {
        console.error('Ошибка при загрузке статистики:', error)
        setStats({ narCoin: 0, xp: 0, level: 1, energy: 100, maxEnergy: 100 })
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

  const menuItems = [
    { icon: 'dice', iconColor: '#ff3333', title: 'Играть', path: '/game/modes' },
    { icon: 'trophy', iconColor: '#ffd700', title: 'Турниры', path: '/tournaments' },
    { icon: 'user', iconColor: '#aaaaaa', title: 'Профиль', path: '/profile' },
    { icon: 'academy', iconColor: '#aaaaaa', title: 'Курсы', path: '/academy' },
    { icon: 'city', iconColor: '#ffd700', title: 'Город', path: '/city' },
    { icon: 'shield', iconColor: '#ffd700', title: 'Кланы', path: '/clans', disabled: (user?.level || 0) < 20 },
  ]

  return (
    <div className="app-container page-transition">
      {/* Хедер с профилем */}
      <div className="home-header">
        <div className="home-header-left">
          <div className="home-avatar-container">
            <div className="home-avatar" onClick={() => navigate('/profile')}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} />
              ) : (
                <div className="home-avatar-placeholder">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#B6B6B6"/>
                    <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="#B6B6B6"/>
                  </svg>
                </div>
              )}
              {hasNotifications && <div className="home-avatar-notification" />}
            </div>
          </div>
          <div className="home-user-info">
            <div className="home-username">{user?.nickname || user?.username || 'Игрок'}</div>
            <div className="home-level">Уровень {stats.level}</div>
          </div>
        </div>
        <div className="home-header-right">
          <div className="home-currency">
            <Icon name="coin" size={20} style={{ color: '#ffd700' }} />
            <span>{stats.narCoin.toLocaleString()}</span>
          </div>
          <div className="home-energy">
            <span style={{ color: '#ff3333', fontSize: '20px', marginRight: '4px' }}>⚡</span>
            <span>{stats.energy}/{stats.maxEnergy}</span>
          </div>
        </div>
      </div>

      <div className="home-content">
        {/* Меню */}
        <div className="home-menu">
          {menuItems.map((item) => {
            const isDisabled = item.disabled
            return (
              <div
                key={item.path}
                onClick={() => !isDisabled && navigate(item.path)}
                className="home-menu-item"
                style={{
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="home-menu-item-content">
                  <Icon 
                    name={item.icon} 
                    size={24} 
                    style={{ 
                      color: isDisabled ? '#666666' : item.iconColor,
                      flexShrink: 0 
                    }} 
                  />
                  <span className="home-menu-item-title">{item.title}</span>
                  {isDisabled && (
                    <span className="home-menu-item-disabled">(с 20 уровня)</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}