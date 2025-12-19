import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'

import { apiClient } from '../api/client'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ narCoin: 0, xp: 0, level: 1 })
  const [hasPremium, setHasPremium] = useState(false)

  useEffect(() => {
    if (user) {
      try {
        const narCoin = typeof user.narCoin === 'bigint' ? Number(user.narCoin) : (user.narCoin || 0)
        const xp = typeof user.xp === 'bigint' ? Number(user.xp) : (user.xp || 0)
        setStats({
          narCoin: Number(narCoin) || 0,
          xp: Number(xp) || 0,
          level: user.level || 1,
        })
        checkPremium()
      } catch (error) {
        console.error('Ошибка при загрузке статистики:', error)
        setStats({ narCoin: 0, xp: 0, level: 1 })
      }
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

  if (!user) {
    return null
  }

  const menuItems = [
    { icon: '🎲', title: 'Онлайн игра', subtitle: 'Сразись с игроками по всему миру', path: '/game/search' },
    { icon: '🪑', title: 'Свободные столы', subtitle: 'Выбирай стол и присоединяйся к игре', path: '/game/tables' },
    { icon: '🤖', title: 'Игра с AI', subtitle: 'Тренируйся без ограничений', path: '/game/new?mode=bot' },
  ]

  const profileItems = [
    { icon: '🏙️', title: 'Город', path: '/city' },
    { icon: '🏆', title: 'Турниры', path: '/tournaments' },
    { icon: '👤', title: 'Профиль', path: '/profile' },
    { icon: '🛡️', title: 'Кланы', path: '/clans', disabled: (user?.level || 0) < 20 },
    { icon: '🎓', title: 'Курсы', path: '/academy' },
  ]

  return (
    <div className="app-container">
      <PageHeader title="НАРДИСТ" showBack={false} />
      
      <div style={{ padding: '20px' }}>
        {/* Профиль пользователя */}
        <Card style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="avatar avatar-large">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} />
              ) : (
                <div style={{ fontSize: '32px' }}>👤</div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-title">{user?.nickname || user?.username || 'Игрок'}</div>
                {hasPremium && (
                  <span style={{ 
                    fontSize: '16px',
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 'bold'
                  }}>⭐</span>
                )}
              </div>
              <div className="card-subtitle">Уровень {stats.level}</div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <span className="gold">💰 {stats.narCoin.toLocaleString()} NAR</span>
                <span style={{ color: '#ff3333' }}>🔥 {stats.xp}/100</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Валюта */}
        <Card style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="gold-icon" style={{ fontSize: '24px' }}>🪙</span>
              <span className="gold" style={{ fontSize: '18px', fontWeight: 600 }}>
                {stats.narCoin.toLocaleString()} NAR
              </span>
            </div>
            <Button variant="primary" onClick={() => navigate('/shop')}>
              Пополнить
            </Button>
          </div>
        </Card>

        {/* Режимы игры */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
            Режимы игры
          </div>
          {menuItems.map((item) => (
            <Card
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ marginBottom: '12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '32px' }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="card-title">{item.title}</div>
                  <div className="card-subtitle">{item.subtitle}</div>
                </div>
                <div style={{ fontSize: '20px', color: '#666666' }}>→</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Меню */}
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
            Меню
          </div>
          {profileItems.map((item) => {
            const isDisabled = item.disabled
            return (
              <Card
                key={item.path}
                onClick={() => !isDisabled && navigate(item.path)}
                style={{
                  marginBottom: '12px',
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">
                      {item.title}
                      {isDisabled && (
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                          (с 20 уровня)
                        </span>
                      )}
                    </div>
                  </div>
                  {!isDisabled && <div style={{ fontSize: '20px', color: '#666666' }}>→</div>}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Футер */}
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: '#aaaaaa',
            fontSize: '14px',
            marginTop: '32px',
          }}
        >
          Игры дают опыт, NAR-coin и рейтинг
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
