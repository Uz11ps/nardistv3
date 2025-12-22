import { useState, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { apiClient } from '../api/client'
import './Notifications.css'

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

    if (minutes < 60) return `${minutes} минут назад`
    if (hours < 24) return `${hours} часа назад`
    if (days < 7) return `${days} дней назад`
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

  const [filter, setFilter] = useState<'all' | 'games' | 'system'>('all')

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true
    if (filter === 'games') return n.type === 'success' || n.type === 'error'
    if (filter === 'system') return n.type === 'info' || n.type === 'warning'
    return true
  })

  const tabs = [
    { id: 'all', label: 'Все', active: filter === 'all', onClick: () => setFilter('all') },
    { id: 'games', label: 'Игры', active: filter === 'games', onClick: () => setFilter('games') },
    { id: 'system', label: 'Система', active: filter === 'system', onClick: () => setFilter('system') },
  ]

  return (
    <PageLayout 
      title="Уведомления" 
      subtitle="Здесь хранятся все ваши уведомления"
      showBack={true}
      tabs={tabs}
    >
      <div className="notifications-content">
        {loading ? (
          <Card>
            <div className="notifications-loading">Загрузка...</div>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <div className="notifications-empty">Нет уведомлений</div>
          </Card>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className="notifications-item"
                onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                style={{
                  opacity: notification.read ? 0.7 : 1,
                  cursor: notification.read ? 'default' : 'pointer',
                }}
              >
                <div className="notifications-item-content">
                  <div className="notifications-item-title">
                    {notification.title}
                  </div>
                  <div className="notifications-item-message">
                    {notification.message}
                  </div>
                  <div className="notifications-item-time">
                    {formatDate(notification.createdAt)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
