import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './ClanUpgrades.css'

interface Upgrade {
  current: number
  max: number
  cost: number
}

interface Upgrades {
  districtStrength: Upgrade
  economy: Upgrade
  fort: Upgrade
  clanLevel: number // Общий уровень клана (рассчитывается автоматически)
}

interface Clan {
  id: string
  leaderId: string
  treasury: number | string
}

interface UpgradePreview {
  upgradeType: string
  upgradeName: string
  currentLevel: number
  newLevel: number
  cost: number
  currentTreasury: number
  newTreasury: number
  effects: Array<{ label: string; current: string; new: string }>
  currentClanLevel: number
  newClanLevel: number
}

export default function ClanUpgrades() {
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const [clan, setClan] = useState<Clan | null>(null)
  const [upgrades, setUpgrades] = useState<Upgrades | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    if (clanId) {
      loadData()
    }
  }, [clanId, user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [clanResponse, upgradesResponse] = await Promise.all([
        apiClient.get(`/clans/${clanId}`).catch(() => ({ data: null })),
        apiClient.get(`/clans/${clanId}/upgrades`).catch(() => ({ data: null })),
      ])
      setClan(clanResponse.data)
      setUpgrades(upgradesResponse.data)
    } catch (error) {
      console.error('Failed to load upgrades data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgradeClick = async (upgradeType: string) => {
    if (!clanId) return
    
    try {
      const preview = await apiClient.get(`/clans/${clanId}/upgrades/preview/${upgradeType}`)
      setUpgradePreview(preview.data)
      setShowUpgradeModal(true)
    } catch (error: any) {
      console.error('Failed to load upgrade preview:', error)
    }
  }

  const handleConfirmUpgrade = async () => {
    if (!clanId || !upgradePreview) return
    
    try {
      setUpgrading(true)
      await apiClient.post(`/clans/${clanId}/upgrade`, { upgradeType: upgradePreview.upgradeType })
      setShowUpgradeModal(false)
      setUpgradePreview(null)
      await loadData()
    } catch (error: any) {
      console.error('Failed to upgrade:', error)
      setShowUpgradeModal(false)
      setUpgradePreview(null)
    } finally {
      setUpgrading(false)
    }
  }

  const handleCancelUpgrade = () => {
    setShowUpgradeModal(false)
    setUpgradePreview(null)
  }

  const upgradeConfig = [
    {
      key: 'districtStrength' as const,
      title: 'Сила районов',
      description: 'Повышает влияние при захвате районов',
    },
    {
      key: 'economy' as const,
      title: 'Экономика',
      description: 'Увеличивает доход клана от налогов',
    },
    {
      key: 'fort' as const,
      title: 'Форт федерации',
      description: 'Уменьшает потери при сражениях за районы',
    },
  ]

  if (loading) {
    return (
      <PageLayout title="Улучшения" showBack={true}>
        <div className="clan-upgrades-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  if (!clan || !upgrades) {
    return (
      <PageLayout title="Улучшения" showBack={true}>
        <div className="clan-upgrades-empty">Данные не найдены</div>
      </PageLayout>
    )
  }

  const isLeader = user?.id === clan.leaderId

  return (
    <PageLayout
      title="Улучшения"
      subtitle="Используй средства из казны, чтоб усиливать влияние и бонусы федерации"
      showBack={true}
    >
      {/* Отображение общего уровня клана */}
      {upgrades.clanLevel !== undefined && (
        <div style={{ 
          background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ 
            color: '#B6B6B6', 
            fontSize: '14px', 
            marginBottom: '8px',
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            Уровень федерации
          </div>
          <div style={{ 
            color: '#FFD700', 
            fontSize: '32px', 
            fontWeight: '600',
            marginBottom: '8px',
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            {upgrades.clanLevel}/10
          </div>
          <div style={{ 
            color: '#B6B6B6', 
            fontSize: '12px',
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            Уровень рассчитывается автоматически на основе суммы всех улучшений
          </div>
        </div>
      )}

      <div className="clan-upgrades-list">
        {upgradeConfig.map((config) => {
          const upgrade = upgrades[config.key]
          const isMaxLevel = upgrade.current >= upgrade.max
          
          return (
            <div key={config.key} className="clan-upgrade-item">
              <img src="/img/кланы.png" alt="Upgrade" className="clan-upgrade-icon" />
              <div className="clan-upgrade-info">
                <div className="clan-upgrade-title">{config.title}</div>
                <div className="clan-upgrade-description">{config.description}</div>
                <div className="clan-upgrade-level">
                  Текущий уровень: {upgrade.current}/{upgrade.max}
                </div>
              </div>
              <button
                className={`clan-upgrade-button ${isMaxLevel ? 'max-level' : ''}`}
                onClick={() => !isMaxLevel && handleUpgradeClick(config.key)}
                disabled={isMaxLevel || !isLeader}
              >
                Улучшить
              </button>
            </div>
          )
        })}
      </div>

      {!isLeader && (
        <div className="clan-upgrades-footer">
          Только глава федерации может управлять улучшениями
        </div>
      )}

      {/* Модальное окно подтверждения улучшения */}
      {showUpgradeModal && upgradePreview && createPortal(
        <div className="clan-upgrade-modal-overlay" onClick={handleCancelUpgrade}>
          <div className="clan-upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clan-upgrade-modal-header">
              <h3 className="clan-upgrade-modal-title">{upgradePreview.upgradeName}</h3>
              <button className="clan-upgrade-modal-close" onClick={handleCancelUpgrade}>×</button>
            </div>
            
            <div className="clan-upgrade-modal-content">
              <div className="clan-upgrade-modal-section">
                <div className="clan-upgrade-modal-section-title">Эффекты улучшения:</div>
                <div className="clan-upgrade-modal-effects">
                  {upgradePreview.effects.map((effect, index) => (
                    <div key={index} className="clan-upgrade-modal-effect">
                      <div className="clan-upgrade-modal-effect-label">{effect.label}:</div>
                      <div className="clan-upgrade-modal-effect-values">
                        <span className="clan-upgrade-modal-effect-current">{effect.current}</span>
                        <span className="clan-upgrade-modal-effect-arrow">→</span>
                        <span className="clan-upgrade-modal-effect-new">{effect.new}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="clan-upgrade-modal-section">
                <div className="clan-upgrade-modal-section-title">Финансы:</div>
                <div className="clan-upgrade-modal-finance">
                  <div className="clan-upgrade-modal-finance-item">
                    <span className="clan-upgrade-modal-finance-label">Вы потратите:</span>
                    <span className="clan-upgrade-modal-finance-value" style={{ color: '#E84142' }}>
                      {upgradePreview.cost.toLocaleString('ru-RU')} NAR
                    </span>
                  </div>
                  <div className="clan-upgrade-modal-finance-item">
                    <span className="clan-upgrade-modal-finance-label">В казне останется:</span>
                    <span className="clan-upgrade-modal-finance-value" style={{ color: '#4CAF50' }}>
                      {upgradePreview.newTreasury.toLocaleString('ru-RU')} NAR
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="clan-upgrade-modal-footer">
              <button
                className="clan-upgrade-modal-btn clan-upgrade-modal-btn-cancel"
                onClick={handleCancelUpgrade}
                disabled={upgrading}
              >
                Отказаться
              </button>
              <button
                className="clan-upgrade-modal-btn clan-upgrade-modal-btn-confirm"
                onClick={handleConfirmUpgrade}
                disabled={upgrading || upgradePreview.newTreasury < 0}
              >
                {upgrading ? 'Применение...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
