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
        
        // Мок-данные для разработки
        if (!response.data.quests || response.data.quests.length === 0) {
          if (activeTab === 'daily') {
            setQuests([
              { id: '1', name: 'Сыграть 1 матч', description: '', rewardNarCoin: 100, rewardXP: 50, progress: 1, target: 1, completed: true, claimed: false },
              { id: '2', name: 'Сыграть 3 матча', description: '', rewardNarCoin: 150, rewardXP: 50, progress: 1, target: 3, completed: false, claimed: false },
              { id: '3', name: 'Потратить 100 NAR', description: '', rewardNarCoin: 75, rewardXP: 50, progress: 0, target: 100, completed: false, claimed: false },
              { id: '4', name: 'Зайти в игру', description: '', rewardNarCoin: 50, rewardXP: 50, progress: 1, target: 1, completed: true, claimed: false },
            ])
            setResetTime('23ч 45м')
          } else if (activeTab === 'weekly') {
            setQuests([
              { id: '5', name: 'Выиграть 10 матчей', description: '', rewardNarCoin: 900, rewardXP: 350, progress: 6, target: 10, completed: false, claimed: false },
              { id: '2', name: 'Сыграть 3 матча', description: '', rewardNarCoin: 150, rewardXP: 50, progress: 1, target: 3, completed: false, claimed: false },
              { id: '3', name: 'Потратить 100 NAR', description: '', rewardNarCoin: 75, rewardXP: 50, progress: 38, target: 100, completed: false, claimed: false },
              { id: '4', name: 'Зайти в игру', description: '', rewardNarCoin: 50, rewardXP: 50, progress: 1, target: 1, completed: true, claimed: false },
            ])
            setResetTime('6д 11ч')
          } else {
            setQuests([
              { id: '6', name: 'Сделай первый ход', description: '', rewardNarCoin: 200, rewardXP: 0, progress: 1, target: 1, completed: true, claimed: true },
              { id: '7', name: 'Достигни 20 уровня', description: 'Откроется: Академия, Город', rewardNarCoin: 0, rewardXP: 0, progress: 1, target: 20, completed: false, claimed: false },
            ])
            setResetTime('6д 11ч')
          }
        }
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
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
