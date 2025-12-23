import { useState, useEffect } from 'react'
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
  level: Upgrade
  districtStrength: Upgrade
  economy: Upgrade
  fort: Upgrade
}

interface Clan {
  id: string
  leaderId: string
}

export default function ClanUpgrades() {
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const [clan, setClan] = useState<Clan | null>(null)
  const [upgrades, setUpgrades] = useState<Upgrades | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handleUpgrade = async (upgradeType: string) => {
    try {
      await apiClient.post(`/clans/${clanId}/upgrade`, { upgradeType })
      alert('Улучшение успешно применено!')
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при улучшении')
      console.error('Failed to upgrade:', error)
    }
  }

  const upgradeConfig = [
    {
      key: 'level' as const,
      title: 'Уровень федерации',
      description: 'Увеличивает кол-во участников',
    },
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
                onClick={() => !isMaxLevel && handleUpgrade(config.key)}
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
    </PageLayout>
  )
}
