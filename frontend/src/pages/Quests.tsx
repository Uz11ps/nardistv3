import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { PaintBrushIcon, TicketIcon, CoinIcon, StarIcon } from '../components/Icons'
import './Quests.css'

interface Quest {
  id: string
  name: string
  description: string
  rewardNarCoin: number
  rewardXP: number
  rewardSkin?: any
  rewardTickets?: number
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
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardData, setRewardData] = useState<{
    narCoin?: number
    xp?: number
    skin?: any
    tickets?: number
  } | null>(null)

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
      const response = await apiClient.post(`/quests/${questId}/claim`)
      
      // Сохраняем данные о награде
      if (response.data?.rewards) {
        setRewardData(response.data.rewards)
        setShowRewardModal(true)
      }
      
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
                      Награда:{' '}
                      {quest.rewardNarCoin > 0 && (
                        <span>{quest.rewardNarCoin.toLocaleString('ru-RU')} NAR</span>
                      )}
                      {quest.rewardNarCoin > 0 && quest.rewardXP > 0 && ' • '}
                      {quest.rewardXP > 0 && <span>{quest.rewardXP} XP</span>}
                      {quest.rewardSkin && (
                        <>
                          {(quest.rewardNarCoin > 0 || quest.rewardXP > 0) && ' • '}
                          <span style={{ color: '#00aaff' }}>
                            <PaintBrushIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Скин
                          </span>
                        </>
                      )}
                      {quest.rewardTickets && quest.rewardTickets > 0 && (
                        <>
                          {(quest.rewardNarCoin > 0 || quest.rewardXP > 0 || quest.rewardSkin) && ' • '}
                          <span style={{ color: '#ff6b6b' }}>
                            <TicketIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {quest.rewardTickets} билет{quest.rewardTickets > 1 ? 'ов' : ''}
                          </span>
                        </>
                      )}
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

      {/* Модальное окно с наградой */}
      {showRewardModal && rewardData && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowRewardModal(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid #FFD700',
              boxShadow: '0 8px 32px rgba(255, 215, 0, 0.3)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ 
              color: '#FFF', 
              marginBottom: '24px', 
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              Поздравляем!
            </h2>
            <p style={{ 
              color: '#B6B6B6', 
              marginBottom: '24px', 
              fontSize: '16px' 
            }}>
              Вы успешно выполнили задание и получили награду:
            </p>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              marginBottom: '24px'
            }}>
              {rewardData.narCoin !== undefined && rewardData.narCoin > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(255, 215, 0, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
                }}>
                  <CoinIcon size={24} style={{ color: '#FFD700' }} />
                  <span style={{ color: '#FFD700', fontSize: '18px', fontWeight: '600' }}>
                    +{rewardData.narCoin.toLocaleString('ru-RU')} NAR
                  </span>
                </div>
              )}
              
              {rewardData.xp !== undefined && rewardData.xp > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(74, 158, 255, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(74, 158, 255, 0.3)'
                }}>
                  <StarIcon size={24} style={{ color: '#4a9eff' }} />
                  <span style={{ color: '#4a9eff', fontSize: '18px', fontWeight: '600' }}>
                    +{rewardData.xp} XP
                  </span>
                </div>
              )}
              
              {rewardData.skin && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(0, 170, 255, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 170, 255, 0.3)'
                }}>
                  <PaintBrushIcon size={24} style={{ color: '#00aaff' }} />
                  <span style={{ color: '#00aaff', fontSize: '18px', fontWeight: '600' }}>
                    Новый скин
                  </span>
                </div>
              )}
              
              {rewardData.tickets !== undefined && rewardData.tickets > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'rgba(255, 107, 107, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 107, 107, 0.3)'
                }}>
                  <TicketIcon size={24} style={{ color: '#ff6b6b' }} />
                  <span style={{ color: '#ff6b6b', fontSize: '18px', fontWeight: '600' }}>
                    +{rewardData.tickets} билет{rewardData.tickets > 1 ? 'ов' : ''}
                  </span>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowRewardModal(false)}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(180deg, #4a9eff 0%, #2196F3 100%)',
                border: 'none',
                color: '#FFF',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Отлично!
            </button>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
