import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'

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
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'special'>('daily')
  const [quests, setQuests] = useState<Quest[]>([])
  const [resetTime, setResetTime] = useState<string>('')

  useEffect(() => {
    loadQuests()
  }, [activeTab])

  const loadQuests = async () => {
    try {
      const response = await apiClient.get(`/quests/${activeTab}`)
      setQuests(response.data.quests || [])
      setResetTime(response.data.resetTime || '')
    } catch (error) {
      console.error('Failed to load quests:', error)
    }
  }

  const handleClaim = async (questId: string) => {
    try {
      await apiClient.post(`/quests/${questId}/claim`)
      loadQuests()
    } catch (error) {
      console.error('Failed to claim quest:', error)
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Задания" />
      
      <div style={{ padding: '20px' }}>
        {/* Вкладки */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            Ежедневные
          </button>
          <button
            className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            Недельные
          </button>
          <button
            className={`tab ${activeTab === 'special' ? 'active' : ''}`}
            onClick={() => setActiveTab('special')}
          >
            Особые
          </button>
        </div>

        {/* Таймер сброса */}
        {(activeTab === 'weekly' || activeTab === 'special') && resetTime && (
          <div style={{ textAlign: 'center', marginBottom: '16px', color: '#aaaaaa', fontSize: '14px' }}>
            До сброса {resetTime}
          </div>
        )}

        {/* Список заданий */}
        <div>
          {quests.map((quest) => (
            <Card key={quest.id} style={{ marginBottom: '12px' }}>
              <div className="card-title">{quest.name}</div>
              <div className="card-subtitle" style={{ marginTop: '4px' }}>
                Награда: {quest.rewardNarCoin} NAR + {quest.rewardXP} XP
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', color: '#aaaaaa' }}>Прогресс</span>
                  <span style={{ fontSize: '14px', color: '#aaaaaa' }}>
                    {quest.progress}/{quest.target}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(quest.progress / quest.target) * 100}%` }}
                  />
                </div>
              </div>
              {quest.completed && !quest.claimed && (
                <Button
                  fullWidth
                  onClick={() => handleClaim(quest.id)}
                  style={{ marginTop: '12px' }}
                >
                  Забрать
                </Button>
              )}
              {quest.claimed && (
                <Button variant="secondary" fullWidth style={{ marginTop: '12px' }} disabled>
                  Выполнено
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

