import { useState, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { CoinIcon, FireIcon, PaintBrushIcon } from '../components/Icons'
import './Achievements.css'

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
      const response = await apiClient.get(`/achievements?filter=${filter}`).catch(() => ({ data: [] }))
      setAchievements(response.data || [])
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

  const getProgressPercentage = (progress: number, max: number) => {
    return Math.min(100, (progress / max) * 100)
  }

  return (
    <PageLayout
      title="Достижения"
      showBack={true}
      tabs={[
        { id: 'all', label: 'Все', active: filter === 'all', onClick: () => setFilter('all') },
        { id: 'unlocked', label: 'Полученные', active: filter === 'unlocked', onClick: () => setFilter('unlocked') },
        { id: 'locked', label: 'В процессе', active: filter === 'locked', onClick: () => setFilter('locked') },
      ]}
    >
      {/* Достижения */}
      {loading ? (
        <div className="achievements-empty">Загрузка...</div>
      ) : filteredAchievements.length === 0 ? (
        <div className="achievements-empty">Нет достижений</div>
      ) : (
        <div className="achievements-list">
          {filteredAchievements.map((achievement) => (
            <div
              key={achievement.id}
              className="achievement-card"
              style={{
                opacity: achievement.unlocked ? 1 : 0.7,
                borderLeft: achievement.unlocked ? '4px solid #ffd700' : '4px solid #3a3a3a',
              }}
            >
              <div className="achievement-content">
                {/* Иконка */}
                <div className={`achievement-icon ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                  {achievement.icon}
                </div>

                {/* Информация */}
                <div className="achievement-info">
                  <div className="achievement-title">{achievement.title}</div>
                  <div className="achievement-description">
                    {achievement.description}
                  </div>

                  {/* Прогресс */}
                  {!achievement.unlocked && (
                    <div className="achievement-progress-section">
                      <div className="achievement-progress-header">
                        <span className="achievement-progress-value">
                          {achievement.progress}/{achievement.maxProgress}
                        </span>
                      </div>
                      <div className="achievement-progress-bar">
                        <div
                          className="achievement-progress-fill"
                          style={{ width: `${getProgressPercentage(achievement.progress, achievement.maxProgress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Награда */}
                  {achievement.reward && (
                    <div className="achievement-reward">
                      {achievement.reward.type === 'narCoin' && (
                        <span style={{ color: '#FFD700', fontSize: '12px', fontWeight: 600 }}>
                          <CoinIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {achievement.reward.amount} NAR
                        </span>
                      )}
                      {achievement.reward.type === 'xp' && (
                        <span style={{ color: '#E84142', fontSize: '12px', fontWeight: 600 }}>
                          <FireIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {achievement.reward.amount} XP
                        </span>
                      )}
                      {achievement.reward.type === 'skin' && (
                        <span style={{ color: '#00aaff', fontSize: '12px', fontWeight: 600 }}>
                          <PaintBrushIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Скин
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
                  <span className="achievement-status">✅</span>
                )}
              </div>
            </div>
            ))}
        </div>
      )}
    </PageLayout>
  )
}

