import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Referrals.css'

interface ReferralStats {
  referralCode: string
  referralLink: string
  totalReferred: number
  activeReferred: number
  playersWithMatches: number
  playersWithDonations: number
  retentionRate: number
  totalEarnings: number
  referralPercent: number
  referralBaseBonus: number
  earnings: Array<{
    id: string
    referredUserId: string
    donationAmount: number
    referralBonus: number
    description: string
    createdAt: string
  }>
}

export default function Referrals() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/referrals/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load referral stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!stats?.referralLink) return
    
    try {
      await navigator.clipboard.writeText(stats.referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = stats.referralLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (!stats?.referralLink) return

    const shareText = `🎲 Присоединяйся к Nardist!\n\nИграй в нарды и зарабатывай! Используй мою реферальную ссылку:\n${stats.referralLink}`

    try {
      // Проверяем доступность Telegram WebApp API
      const telegramWebApp = (window as any).Telegram?.WebApp
      
      if (telegramWebApp) {
        if (telegramWebApp.openTelegramLink) {
          // Используем Telegram API для шаринга через tg://msg?text=...
          // Это откроет диалог выбора контакта для отправки сообщения
          const encodedText = encodeURIComponent(shareText)
          telegramWebApp.openTelegramLink(`tg://msg?text=${encodedText}`)
          return
        } else if (telegramWebApp.openLink) {
          // Альтернативный вариант: просто открываем ссылку
          // Пользователь сможет скопировать или переслать её вручную
          telegramWebApp.openLink(stats.referralLink)
          return
        }
      }
      
      // Fallback: используем Web Share API если доступен
      if (navigator.share) {
        await navigator.share({
          title: 'Присоединяйся к Nardist!',
          text: shareText,
          url: stats.referralLink,
        })
        return
      }
      
      // Последний fallback: копируем в буфер обмена
      await navigator.clipboard.writeText(shareText)
      alert('Ссылка скопирована в буфер обмена!')
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to share:', error)
        // Fallback: копируем в буфер обмена
        try {
          await navigator.clipboard.writeText(shareText)
          alert('Ссылка скопирована в буфер обмена!')
        } catch (copyError) {
          console.error('Failed to copy:', copyError)
        }
      }
    }
  }

  if (loading) {
    return (
      <PageLayout title="Рефералы" showBack={true}>
        <div className="referrals-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  if (!stats) {
    return (
      <PageLayout title="Рефералы" showBack={true}>
        <div className="referrals-error">Ошибка загрузки данных</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Рефералы" showBack={true}>
      <div className="referrals-content">
        {/* Реферальная ссылка */}
        <div className="referrals-link-section">
          <h3 className="referrals-section-title">Твоя реферальная ссылка</h3>
          <div className="referrals-link-container">
            <input
              type="text"
              readOnly
              value={stats.referralLink}
              className="referrals-link-input"
            />
            <button
              className={`referrals-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          <button className="referrals-share-btn" onClick={handleShare}>
            📤 Поделиться
          </button>
        </div>

        {/* Статистика */}
        <div className="referrals-stats-section">
          <h3 className="referrals-section-title">Статистика</h3>
          <div className="referrals-stats-grid">
            <div className="referrals-stat-card">
              <div className="referrals-stat-value">{stats.totalReferred}</div>
              <div className="referrals-stat-label">Всего рефералов</div>
            </div>
            <div className="referrals-stat-card">
              <div className="referrals-stat-value">{stats.activeReferred}</div>
              <div className="referrals-stat-label">Активных</div>
            </div>
            <div className="referrals-stat-card">
              <div className="referrals-stat-value">{stats.playersWithMatches}</div>
              <div className="referrals-stat-label">Играли матчи</div>
            </div>
            <div className="referrals-stat-card">
              <div className="referrals-stat-value">{stats.playersWithDonations}</div>
              <div className="referrals-stat-label">Делали донаты</div>
            </div>
            <div className="referrals-stat-card">
              <div className="referrals-stat-value">{stats.retentionRate.toFixed(1)}%</div>
              <div className="referrals-stat-label">Ретеншн</div>
            </div>
            <div className="referrals-stat-card earnings">
              <div className="referrals-stat-value">
                {stats.totalEarnings.toLocaleString()} NAR
              </div>
              <div className="referrals-stat-label">Общий доход</div>
            </div>
          </div>
        </div>

        {/* История доходов */}
        {stats.earnings.length > 0 && (
          <div className="referrals-earnings-section">
            <h3 className="referrals-section-title">История доходов</h3>
            <div className="referrals-earnings-list">
              {stats.earnings.map((earning) => (
                <div key={earning.id} className="referrals-earning-item">
                  <div className="referrals-earning-info">
                    <div className="referrals-earning-description">{earning.description}</div>
                    <div className="referrals-earning-date">
                      {new Date(earning.createdAt).toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="referrals-earning-amount">
                    +{earning.referralBonus.toLocaleString()} NAR
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.earnings.length === 0 && (
          <div className="referrals-empty-earnings">
            <p>Пока нет доходов от рефералов</p>
            <p className="referrals-empty-note">
              Приглашай друзей и получай бонусы за их донаты!
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

