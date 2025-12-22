import { useState, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import './Quests.css'

interface Quest {
  id: string
  name: string
  description: string
  rewardNarCoin: number
  rewardXP: number
  progress: number
  target: number
  completed: boolean
  claimed: boolean
  isPremium?: boolean
  channelUsername?: string | null
}

export default function Quests() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'special'>('daily')
  const [quests, setQuests] = useState<Quest[]>([])
  const [resetTime, setResetTime] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null)
  const [checkingSubscriptionId, setCheckingSubscriptionId] = useState<string | null>(null)

  useEffect(() => {
    loadQuests()
  }, [activeTab])

  const loadQuests = async () => {
    try {
      setLoading(true)
      if (activeTab === 'special') {
        try {
          const [dailyResponse, weeklyResponse] = await Promise.all([
            apiClient.get('/quests/daily').catch(() => ({ data: { quests: [] } })),
            apiClient.get('/quests/weekly').catch(() => ({ data: { quests: [] } })),
          ])
          const allQuests = [
            ...(dailyResponse.data.quests || []),
            ...(weeklyResponse.data.quests || []),
          ]
          const specialQuests = allQuests.filter((q: any) => q.isPremium === true)
          setQuests(specialQuests)
          setResetTime('6д 11ч')
        } catch (error) {
          console.error('Failed to load special quests:', error)
          setQuests([])
          setResetTime('')
        }
      } else {
        const response = await apiClient.get(`/quests/${activeTab}`).catch(() => ({ data: { quests: [], resetTime: '' } }))
        setQuests(response.data.quests || [])
        setResetTime(response.data.resetTime || '')
      }
    } catch (error) {
      console.error('Failed to load quests:', error)
      setQuests([])
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (questId: string) => {
    if (claimingQuestId !== null) return
    
    try {
      setClaimingQuestId(questId)
      await apiClient.post(`/quests/${questId}/claim`)
      await loadQuests()
      if (user) {
        const userResponse = await apiClient.get('/users/me')
        useAuthStore.setState({ user: userResponse.data })
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при получении награды')
      console.error('Failed to claim quest:', error)
    } finally {
      setClaimingQuestId(null)
    }
  }

  const handleCheckSubscription = async (questId: string) => {
    if (checkingSubscriptionId !== null) return
    
    try {
      setCheckingSubscriptionId(questId)
      const response = await apiClient.post(`/quests/${questId}/check-subscription`)
      if (response.data.subscribed) {
        alert('Подписка подтверждена!')
        await loadQuests()
      } else {
        alert('Вы не подписаны на канал. Пожалуйста, подпишитесь и попробуйте снова.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при проверке подписки')
      console.error('Failed to check subscription:', error)
    } finally {
      setCheckingSubscriptionId(null)
    }
  }

  const formatResetTime = (timeStr: string) => {
    return timeStr || ''
  }

  const getProgressPercentage = (progress: number, target: number) => {
    if (target === 0) return 0
    const percentage = (progress / target) * 100
    return Math.min(percentage, 100)
  }

  return (
    <PageLayout
      title="Задания"
      showBack={true}
      tabs={[
        { id: 'daily', label: 'Ежедневные', active: activeTab === 'daily', onClick: () => setActiveTab('daily') },
        { id: 'weekly', label: 'Недельные', active: activeTab === 'weekly', onClick: () => setActiveTab('weekly') },
        { id: 'special', label: 'Особые', active: activeTab === 'special', onClick: () => setActiveTab('special') },
      ]}
    >
      {/* Таймер сброса */}
      {(activeTab === 'daily' || activeTab === 'weekly') && resetTime && (
        <div className="quests-reset-time">
          До сброса {formatResetTime(resetTime)}
        </div>
      )}

      {/* Список заданий */}
      {loading ? (
        <div className="quests-empty">Загрузка...</div>
      ) : quests.length === 0 ? (
        <div className="quests-empty">Нет доступных заданий</div>
      ) : (
        <div className="quests-list">
          {quests.map((quest) => {
            const progressPercentage = getProgressPercentage(quest.progress, quest.target)
            const canClaim = quest.completed && !quest.claimed

            return (
              <div key={quest.id} className="quest-card">
                <div className="quest-content">
                  <div className="quest-info">
                    <div className="quest-name">{quest.name}</div>
                    {quest.channelUsername && (
                      <div className="quest-description" style={{ marginBottom: '8px' }}>
                        Канал: {quest.channelUsername}
                      </div>
                    )}
                    <div className="quest-reward">
                      Награда: {quest.rewardNarCoin.toLocaleString('ru-RU')} NAR • {quest.rewardXP} XP
                    </div>
                    <div className="quest-progress-section">
                      <div className="quest-progress-bar">
                        <div
                          className="quest-progress-fill"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <div className="quest-progress-header">
                        <span className="quest-progress-value">
                          {quest.progress}/{quest.target}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {quest.channelUsername && !quest.completed && (
                      <button
                        className="quest-claim-btn"
                        onClick={() => handleCheckSubscription(quest.id)}
                        disabled={checkingSubscriptionId !== null}
                        style={{ backgroundColor: '#4CAF50' }}
                      >
                        {checkingSubscriptionId === quest.id ? 'Проверка...' : 'Проверить подписку'}
                      </button>
                    )}
                    {canClaim && (
                      <button
                        className="quest-claim-btn"
                        onClick={() => handleClaim(quest.id)}
                        disabled={claimingQuestId !== null}
                      >
                        {claimingQuestId === quest.id ? 'Получение...' : 'Забрать'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
