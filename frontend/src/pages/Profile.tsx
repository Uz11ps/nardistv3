import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
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
      const response = await apiClient.get('/subscription/status')
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }

  const menuItems = [
    { icon: 'crown', title: 'Магазин', path: '/shop' },
    { icon: 'box', title: 'Инвентарь', path: '/inventory' },
    { icon: 'target', title: 'Квесты', path: '/quests' },
    { icon: 'bell', title: 'Уведомления', path: '/notifications' },
    { icon: 'settings', title: 'Настройки', path: '/settings' },
  ]

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (item.path) {
      navigate(item.path)
    }
  }

  return (
    <div className="app-container">
      <div className="profile-page-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ←
        </button>
      </div>
      
      <div className="profile-content">
        {/* Профиль пользователя */}
        <div className="profile-header">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="profile-avatar-img" />
              ) : (
                <Icon name="user" size={80} className="profile-avatar-icon" />
              )}
            </div>
          </div>
          <div className="profile-name">
            {user?.nickname || user?.username || 'Игрок'}
          </div>
          <div className="profile-level">
            Уровень {stats.level}
          </div>
        </div>

        {/* Валюта */}
        <Card className="profile-currency-card">
          <div className="profile-currency-content">
            <div className="profile-currency-left">
              <Icon name="coin" size={24} className="profile-currency-icon" />
              <span className="profile-currency-amount">
                {stats.narCoin.toLocaleString('ru-RU')} NAR
              </span>
            </div>
            <Button variant="primary" className="profile-topup-btn" onClick={() => navigate('/shop')}>
              Пополнить
            </Button>
          </div>
        </Card>

        {/* Меню */}
        <div className="profile-menu">
          {menuItems.map((item) => (
            <Card
              key={item.path}
              onClick={() => handleMenuClick(item)}
              className="profile-menu-item"
            >
              <div className="profile-menu-item-content">
                <Icon name={item.icon} size={24} className="profile-menu-item-icon" />
                <span className="profile-menu-item-title">{item.title}</span>
                <span className="profile-menu-item-arrow">→</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

    </div>
  )
}