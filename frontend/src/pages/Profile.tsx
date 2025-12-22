import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ narCoin: 0, xp: 0, level: 1 })
  const [hasPremium, setHasPremium] = useState(false)

  useEffect(() => {
    if (user) {
      setStats({
        narCoin: Number(user.narCoin) || 0,
        xp: Number(user.xp) || 0,
        level: user.level || 1,
      })
      checkPremium()
    }
  }, [user])

  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status').catch(() => ({ data: { hasActive: false } }))
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }

  const menuItems = [
    { icon: '/img/c86058c8dc0c93af3b43acd129cee0eae6877c3e.png', title: 'Магазин', path: '/shop' },
    { icon: '/img/инв.png', title: 'Инвентарь', path: '/inventory' },
    { icon: '/img/зарик.png', title: 'Квесты', path: '/quests' },
    { icon: '/img/увед.png', title: 'Уведомления', path: '/notifications' },
    { icon: '/img/settings.png', title: 'Настройки', path: '/settings' },
  ]

  return (
    <PageLayout title="Профиль" showBack={true}>
      <div className="profile-content">
        {/* Профиль пользователя */}
        <div className="profile-header">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  <img src="/img/челувек.png" alt="User" className="profile-avatar-icon" />
                </div>
              )}
            </div>
          </div>
          <div className="profile-name">
            {user?.nickname || user?.firstName || user?.username || 'Игрок'}
          </div>
          <div className="profile-level">
            Уровень {stats.level}
          </div>
        </div>

        {/* Валюта */}
        <div className="profile-currency-card">
          <div className="profile-currency-content">
            <div className="profile-currency-left">
              <img src="/img/narcoin.png" alt="NAR" className="profile-currency-icon" />
              <span className="profile-currency-amount">
                {stats.narCoin.toLocaleString('ru-RU')} NAR
              </span>
            </div>
            <button className="profile-topup-btn" onClick={() => navigate('/shop')}>
              Пополнить
            </button>
          </div>
        </div>

        {/* Меню */}
        <div className="profile-menu">
          {menuItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className="profile-menu-item"
            >
              <div className="profile-menu-item-content">
                <img src={item.icon} alt={item.title} className="profile-menu-item-icon" />
                <span className="profile-menu-item-title">{item.title}</span>
                <span className="profile-menu-item-arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
