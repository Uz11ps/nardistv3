import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
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
}

export default function Quests() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'special'>('daily')
  const [quests, setQuests] = useState<Quest[]>([])
  const [resetTime, setResetTime] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null)

  useEffect(() => {
    loadQuests()
  }, [activeTab])

  const loadQuests = async () => {
    try {
      setLoading(true)
      if (activeTab === 'special') {
        // Для особых квестов загружаем все и фильтруем по isPremium
        try {
          const [dailyResponse, weeklyResponse] = await Promise.all([
            apiClient.get('/quests/daily'),
            apiClient.get('/quests/weekly'),
          ])
          const allQuests = [
            ...(dailyResponse.data.quests || []),
            ...(weeklyResponse.data.quests || []),
          ]
          // Фильтруем особые квесты (isPremium)
          const specialQuests = allQuests.filter((q: any) => q.isPremium === true)
          setQuests(specialQuests)
          setResetTime('6д 11ч') // Время до сброса для особых квестов
        } catch (error) {
          console.error('Failed to load special quests:', error)
          setQuests([])
          setResetTime('')
        }
      } else {
        const response = await apiClient.get(`/quests/${activeTab}`)
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
    if (claimingQuestId !== null) return // Защита от повторных запросов
    
    try {
      setClaimingQuestId(questId)
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
    } finally {
      setClaimingQuestId(null)
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
        {activeTab === 'weekly' && resetTime && (
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
                        Награда: {quest.rewardNarCoin.toLocaleString('ru-RU')} NAR - {quest.rewardXP} XP
                      </div>
                      <div className="quest-progress-section">
                        <div className="quest-progress-header">
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
                        disabled={claimingQuestId !== null}
                      >
                        {claimingQuestId === quest.id ? 'Получение...' : 'Забрать'}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}