import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import BottomNav from '../components/BottomNav'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  createdAt: string
  read: boolean
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    // Загружаем уведомления (пока заглушка)
    setNotifications([
      {
        id: '1',
        title: 'Добро пожаловать!',
        message: 'Вы успешно зарегистрированы в игре НАРДИСТ',
        type: 'success',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ])
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes} мин. назад`
    if (hours < 24) return `${hours} ч. назад`
    if (days < 7) return `${days} дн. назад`
    return date.toLocaleDateString('ru-RU')
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      default:
        return 'ℹ️'
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Уведомления" />
      
      <div style={{ padding: '20px' }}>
        {notifications.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
              Нет уведомлений
            </div>
          </Card>
        ) : (
          <div>
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                style={{
                  marginBottom: '12px',
                  opacity: notification.read ? 0.7 : 1,
                  borderLeft: `4px solid ${
                    notification.type === 'success' ? '#00ff00' :
                    notification.type === 'warning' ? '#ffaa00' :
                    notification.type === 'error' ? '#ff3333' :
                    '#00aaff'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{notification.title}</div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      {notification.message}
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '8px', fontSize: '12px' }}>
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

