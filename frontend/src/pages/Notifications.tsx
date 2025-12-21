import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import { apiClient } from '../api/client'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/notifications')
      setNotifications(response.data || [])
    } catch (error) {
      console.error('Ошибка при загрузке уведомлений:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await apiClient.put(`/notifications/${notificationId}/read`)
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error('Ошибка при отметке уведомления:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Ошибка при отметке всех уведомлений:', error)
    }
  }

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

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="app-container">
      <PageHeader title="Уведомления">
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              padding: '8px 16px',
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Отметить все как прочитанные
          </button>
        )}
      </PageHeader>
      
      <div style={{ padding: '20px' }}>
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
              Загрузка...
            </div>
          </Card>
        ) : notifications.length === 0 ? (
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
                onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                style={{
                  marginBottom: '12px',
                  opacity: notification.read ? 0.7 : 1,
                  borderLeft: `4px solid ${
                    notification.type === 'success' ? '#00ff00' :
                    notification.type === 'warning' ? '#ffaa00' :
                    notification.type === 'error' ? '#ff3333' :
                    '#00aaff'
                  }`,
                  cursor: notification.read ? 'default' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">
                      {notification.title}
                      {!notification.read && (
                        <span style={{ marginLeft: '8px', fontSize: '10px', color: '#ff3333' }}>
                          ●
                        </span>
                      )}
                    </div>
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
    </div>
  )
}

