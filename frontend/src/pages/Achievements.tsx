import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  progress: number
  maxProgress: number
  unlocked: boolean
  unlockedAt?: string
  reward?: {
    type: 'narCoin' | 'xp' | 'skin'
    amount: number
  }
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

  useEffect(() => {
    loadAchievements()
  }, [filter])

  const loadAchievements = async () => {
    try {
      setLoading(true)
      // TODO: заменить на реальный эндпоинт
      // const response = await apiClient.get(`/achievements?filter=${filter}`)
      // setAchievements(response.data)
      
      // Заглушка
      setAchievements([
        {
          id: '1',
          title: 'Первая победа',
          description: 'Выиграй свою первую игру',
          icon: '🏆',
          progress: 1,
          maxProgress: 1,
          unlocked: true,
          unlockedAt: new Date().toISOString(),
          reward: { type: 'narCoin', amount: 100 },
        },
        {
          id: '2',
          title: 'Серия побед',
          description: 'Выиграй 5 игр подряд',
          icon: '🔥',
          progress: 3,
          maxProgress: 5,
          unlocked: false,
          reward: { type: 'narCoin', amount: 500 },
        },
        {
          id: '3',
          title: 'Мастер нардов',
          description: 'Достигни 20 уровня',
          icon: '⭐',
          progress: 15,
          maxProgress: 20,
          unlocked: false,
          reward: { type: 'xp', amount: 1000 },
        },
      ])
    } catch (error) {
      console.error('Failed to load achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAchievements = achievements.filter((ach) => {
    if (filter === 'unlocked') return ach.unlocked
    if (filter === 'locked') return !ach.unlocked
    return true
  })

  const progressPercentage = (progress: number, max: number) => {
    return Math.min(100, (progress / max) * 100)
  }

  return (
    <div className="app-container">
      <PageHeader title="Достижения" />
      
      <div style={{ padding: '20px' }}>
        {/* Фильтры */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              background: filter === 'all' ? '#ff3333' : '#3a3a3a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('unlocked')}
            style={{
              padding: '8px 16px',
              background: filter === 'unlocked' ? '#ff3333' : '#3a3a3a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Полученные
          </button>
          <button
            onClick={() => setFilter('locked')}
            style={{
              padding: '8px 16px',
              background: filter === 'locked' ? '#ff3333' : '#3a3a3a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            В процессе
          </button>
        </div>

        {/* Достижения */}
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>Загрузка...</div>
          </Card>
        ) : filteredAchievements.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>Нет достижений</div>
          </Card>
        ) : (
          <div>
            {filteredAchievements.map((achievement) => (
              <Card
                key={achievement.id}
                style={{
                  marginBottom: '12px',
                  opacity: achievement.unlocked ? 1 : 0.7,
                  borderLeft: achievement.unlocked ? '4px solid #ffd700' : '4px solid #3a3a3a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {/* Иконка */}
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '12px',
                      background: achievement.unlocked ? 'linear-gradient(135deg, #FFD700, #FFA500)' : '#3a3a3a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                    }}
                  >
                    {achievement.icon}
                  </div>

                  {/* Информация */}
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{achievement.title}</div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      {achievement.description}
                    </div>

                    {/* Прогресс */}
                    {!achievement.unlocked && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: '#aaaaaa' }}>
                            Прогресс: {achievement.progress} / {achievement.maxProgress}
                          </span>
                          <span style={{ fontSize: '12px', color: '#aaaaaa' }}>
                            {Math.round(progressPercentage(achievement.progress, achievement.maxProgress))}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            background: '#3a3a3a',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${progressPercentage(achievement.progress, achievement.maxProgress)}%`,
                              height: '100%',
                              background: '#ff3333',
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Награда */}
                    {achievement.reward && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#aaaaaa' }}>Награда:</span>
                        {achievement.reward.type === 'narCoin' && (
                          <span className="gold" style={{ fontSize: '12px', fontWeight: 600 }}>
                            💰 {achievement.reward.amount} NAR
                          </span>
                        )}
                        {achievement.reward.type === 'xp' && (
                          <span style={{ fontSize: '12px', color: '#ff3333', fontWeight: 600 }}>
                            🔥 {achievement.reward.amount} XP
                          </span>
                        )}
                        {achievement.reward.type === 'skin' && (
                          <span style={{ fontSize: '12px', color: '#00aaff', fontWeight: 600 }}>
                            🎨 Скин
                          </span>
                        )}
                      </div>
                    )}

                    {/* Дата получения */}
                    {achievement.unlocked && achievement.unlockedAt && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#666666' }}>
                        Получено: {new Date(achievement.unlockedAt).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>

                  {/* Статус */}
                  {achievement.unlocked && (
                    <span style={{ fontSize: '24px' }}>✅</span>
                  )}
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

