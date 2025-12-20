import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
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
}

export default function Quests() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'special'>('daily')
  const [quests, setQuests] = useState<Quest[]>([])
  const [resetTime, setResetTime] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQuests()
  }, [activeTab])

  const loadQuests = async () => {
    try {
      setLoading(true)
      const type = activeTab === 'special' ? 'daily' : activeTab // Для особых используем daily, но фильтруем по isPremium
      const response = await apiClient.get(`/quests/${type}`)
      let questsData = response.data.quests || []
      
      // Если особые, фильтруем премиум квесты
      if (activeTab === 'special') {
        // TODO: добавить фильтрацию по isPremium, когда это будет доступно в API
        questsData = questsData.filter((q: any) => q.isPremium)
      }
      
      setQuests(questsData)
      setResetTime(response.data.resetTime || '')
    } catch (error) {
      console.error('Failed to load quests:', error)
      setQuests([])
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (questId: string) => {
    try {
      await apiClient.post(`/quests/${questId}/claim`)
      await loadQuests()
      // Обновляем данные пользователя
      if (user) {
        const userResponse = await apiClient.get('/users/me')
        useAuthStore.setState({ user: userResponse.data })
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при получении награды')
      console.error('Failed to claim quest:', error)
    }
  }

  const formatResetTime = (timeStr: string) => {
    // Форматируем время до сброса (например, "6д 11ч" или "24ч")
    return timeStr || ''
  }

  const getProgressPercentage = (progress: number, target: number) => {
    if (target === 0) return 0
    const percentage = (progress / target) * 100
    return Math.min(percentage, 100)
  }

  return (
    <div className="app-container">
      <PageHeader title="Задания" />
      
      <div className="quests-content">
        {/* Вкладки */}
        <div className="quests-tabs">
          <button
            className={`quests-tab ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            Ежедневные
          </button>
          <button
            className={`quests-tab ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            Недельные
          </button>
          <button
            className={`quests-tab ${activeTab === 'special' ? 'active' : ''}`}
            onClick={() => setActiveTab('special')}
          >
            Особые
          </button>
        </div>

        {/* Таймер сброса */}
        {(activeTab === 'weekly' || activeTab === 'daily') && resetTime && (
          <div className="quests-reset-time">
            До сброса {formatResetTime(resetTime)}
          </div>
        )}

        {/* Список заданий */}
        {loading ? (
          <Card>
            <div className="quests-empty">Загрузка...</div>
          </Card>
        ) : quests.length === 0 ? (
          <Card>
            <div className="quests-empty">Нет доступных заданий</div>
          </Card>
        ) : (
          <div className="quests-list">
            {quests.map((quest) => {
              const progressPercentage = getProgressPercentage(quest.progress, quest.target)
              const canClaim = quest.completed && !quest.claimed

              return (
                <Card key={quest.id} className="quest-card">
                  <div className="quest-content">
                    <div className="quest-info">
                      <div className="quest-name">{quest.name}</div>
                      <div className="quest-reward">
                        Награда: {quest.rewardNarCoin.toLocaleString()} NAR - {quest.rewardXP} XP
                      </div>
                      <div className="quest-progress-section">
                        <div className="quest-progress-header">
                          <span className="quest-progress-label">Прогресс</span>
                          <span className="quest-progress-value">
                            {quest.progress}/{quest.target}
                          </span>
                        </div>
                        <div className="quest-progress-bar">
                          <div
                            className="quest-progress-fill"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {canClaim && (
                      <Button
                        variant="primary"
                        className="quest-claim-btn"
                        onClick={() => handleClaim(quest.id)}
                      >
                        Забрать
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}