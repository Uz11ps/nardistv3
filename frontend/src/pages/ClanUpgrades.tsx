import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
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
        apiClient.get(`/clans/${clanId}`),
        apiClient.get(`/clans/${clanId}/upgrades`),
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
      title: 'Уровень клана',
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
      title: 'Форт клана',
      description: 'Уменьшает потери при сражениях за районы',
    },
  ]

  if (loading) {
    return (
      <div className="app-container">
        <PageHeader title="Улучшения" />
        <div className="clan-upgrades-loading">Загрузка...</div>      </div>
    )
  }

  if (!clan || !upgrades) {
    return null
  }

  const isLeader = user?.id === clan.leaderId

  return (
    <div className="app-container">
      <PageHeader title="Улучшения" />
      
      <div className="clan-upgrades-content">
        <div className="clan-upgrades-subtitle">
          Используй средства из казны, чтоб усиливать влияние и бонусы клана
        </div>

        <div className="clan-upgrades-list">
          {upgradeConfig.map((config) => {
            const upgrade = upgrades[config.key]
            const isMaxLevel = upgrade.current >= upgrade.max
            const canUpgrade = isLeader && !isMaxLevel && upgrade.cost > 0

            return (
              <Card key={config.key} className="clan-upgrade-card">
                <div className="clan-upgrade-content">
                  <div className="clan-upgrade-icon">
                    <Icon name="shield" size={32} style={{ color: '#ffd700' }} />
                  </div>
                  <div className="clan-upgrade-info">
                    <div className="clan-upgrade-title">{config.title}</div>
                    <div className="clan-upgrade-description">{config.description}</div>
                    <div className="clan-upgrade-level">
                      Текущий уровень: {upgrade.current}/{upgrade.max}
                    </div>
                  </div>
                  <Button
                    variant={canUpgrade ? 'primary' : 'secondary'}
                    className="clan-upgrade-btn"
                    onClick={() => canUpgrade && handleUpgrade(config.key)}
                    disabled={!canUpgrade}
                  >
                    Улучшить
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        {!isLeader && (
          <div className="clan-upgrades-footer">
            Только глава клана может управлять улучшениями
          </div>
        )}
      </div>    </div>
  )
}
