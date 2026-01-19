import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient, getImageUrl } from '../api/client'
import './City.css'

interface Building {
  id: string
  type: string
  level: number
  accumulatedIncome: number
  incomePerHour: number
  lastIncomeCollection: string | null
}

interface BuildingConfig {
  id: string
  type: string
  name: string
  icon?: string
  image?: string
  basePrice: number
  baseIncomePerHour: number
  maxAccumulation: number
  maxLevel: number
  upgradeMultiplier?: number
  incomeMultiplier?: number
}

interface DistrictData {
  id: string
  code: string
  name: string
  description: string
  icon?: string
  image?: string
  requiredLevel: number
  isUnlocked: boolean
  buildings: {
    config: BuildingConfig
    userBuilding: Building | null
  }[]
}

export default function City() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [cityData, setCityData] = useState<DistrictData[]>([])
  const [collecting, setCollecting] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null)
  const [skillPoints, setSkillPoints] = useState({ economy: 0 })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [cityRes, spResponse] = await Promise.all([
        apiClient.get('/city/data'),
        apiClient.get('/progress/skill-points').catch(() => ({ data: { economy: 0 } }))
      ])
      
      const districts = Array.isArray(cityRes.data) ? cityRes.data : []
      setCityData(districts)
      setSkillPoints(spResponse.data || { economy: 0 })
      
      if (districts.length > 0 && !selectedDistrictId) {
        const firstUnlocked = districts.find((d: DistrictData) => d.isUnlocked) || districts[0]
        setSelectedDistrictId(firstUnlocked.id)
      }
    } catch (error) {
      console.error('Failed to load city data:', error)
      setCityData([])
    } finally {
      setLoading(false)
    }
  }, [selectedDistrictId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpgradeBuilding = async (buildingId: string) => {
    const building = currentDistrict?.buildings.find(b => b.userBuilding?.id === buildingId)
    if (!building) return
    
    const upgradePrice = Math.floor(building.config.basePrice * Math.pow(building.config.upgradeMultiplier || 1.15, building.userBuilding!.level))
    const confirmed = window.confirm(`Улучшить здание за ${upgradePrice.toLocaleString('ru-RU')} NAR?`)
    if (!confirmed) return
    
    try {
      setPurchasing(buildingId)
      await apiClient.put(`/city/buildings/${buildingId}/upgrade`)
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка улучшения здания')
    } finally {
      setPurchasing(null)
    }
  }

  const handlePurchaseBuilding = async (configId: string) => {
    try {
      setPurchasing(configId)
      await apiClient.post('/city/buildings/purchase', { buildingConfigId: configId })
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка покупки здания')
    } finally {
      setPurchasing(null)
    }
  }

  const handleCollectIncome = async (buildingId: string) => {
    try {
      setCollecting(buildingId)
      await apiClient.post(`/city/buildings/${buildingId}/collect`)
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка сбора прибыли')
    } finally {
      setCollecting(null)
    }
  }

  const currentDistrict = cityData.find(d => d.id === selectedDistrictId)

  if (loading && cityData.length === 0) {
    return (
      <PageLayout title="Районы" showBack={true}>
        <div className="city-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout 
      title="Районы" 
      showBack={true}
      tabs={cityData.map(district => ({
        id: district.id,
        label: district.name,
        active: selectedDistrictId === district.id,
        onClick: () => setSelectedDistrictId(district.id)
      }))}
    >
      <div className="city-content-v3">
        {/* Информация о районе */}
        {selectedDistrictId && currentDistrict && (
          <div className="city-district-info">
            <div className="city-district-header">
              <h2 className="city-district-name">{currentDistrict.name}</h2>
              {!currentDistrict.isUnlocked && (
                <div className="city-district-lock">
                  <span className="lock-icon">🔒</span>
                  <span className="lock-text">LVL: {currentDistrict.requiredLevel}</span>
                </div>
              )}
              {currentDistrict.isUnlocked && (
                <div className="city-district-level">
                  <span>LVL: {currentDistrict.requiredLevel}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Сетка строений для выбранного района */}
        {selectedDistrictId && currentDistrict && currentDistrict.isUnlocked && (
          <div className="city-buildings-section">
            <div className="city-grid-v3">
              {currentDistrict.buildings && Array.isArray(currentDistrict.buildings) && currentDistrict.buildings.map((buildingData) => {
                const { config, userBuilding } = buildingData
                const incomeMultiplier = config.incomeMultiplier || 0.07
                const accumulatedIncome = userBuilding ? Number(userBuilding.accumulatedIncome || 0) : 0
                const upgradePrice = userBuilding && userBuilding.level < config.maxLevel
                  ? Math.floor(config.basePrice * Math.pow(config.upgradeMultiplier || 1.15, userBuilding.level))
                  : 0
                
                return (
                  <div 
                    key={config.id} 
                    className="city-card-v3-complete"
                  >
                    {/* Иконка здания */}
                    <div className="city-card-v3-icon-wrapper">
                      <img
                        src={getImageUrl(config.icon) || config.icon || '/img/building_placeholder.png'}
                        alt={config.name}
                        onError={(e) => { e.currentTarget.src = '/img/building_placeholder.png' }}
                      />
                    </div>
                    
                    {/* Название и уровень */}
                    <div className="city-card-v3-title">
                      <span className="city-card-v3-name">{config.name}</span>
                      {userBuilding && (
                        <span className="city-card-v3-level">LVL {userBuilding.level}</span>
                      )}
                    </div>
                    
                    {/* Информация о прибыли */}
                    {userBuilding && (
                      <div className="city-card-v3-income">
                        {userBuilding.incomePerHour.toLocaleString('ru-RU')} NAR/час
                      </div>
                    )}
                    
                    {/* Кнопки действий */}
                    <div className="city-card-v3-actions">
                      {userBuilding ? (
                        <>
                          {/* Кнопка сбора прибыли */}
                          {accumulatedIncome > 0 && (
                            <button
                              className="city-card-v3-btn city-card-v3-btn-collect"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCollectIncome(userBuilding.id)
                              }}
                              disabled={collecting === userBuilding.id}
                            >
                              {collecting === userBuilding.id ? 'Сбор...' : `💰 Собрать ${accumulatedIncome.toLocaleString('ru-RU')}`}
                            </button>
                          )}
                          
                          {/* Кнопка улучшения */}
                          {userBuilding.level < config.maxLevel ? (
                            <button
                              className="city-card-v3-btn city-card-v3-btn-upgrade"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpgradeBuilding(userBuilding.id)
                              }}
                              disabled={purchasing === userBuilding.id || (user?.narCoin || 0) < upgradePrice}
                            >
                              {purchasing === userBuilding.id ? '...' : `⬆️ Улучшить ${upgradePrice.toLocaleString('ru-RU')} NAR`}
                            </button>
                          ) : (
                            <div className="city-card-v3-max-level">МАКС. УРОВЕНЬ</div>
                          )}
                        </>
                      ) : (
                        <button
                          className="city-card-v3-btn city-card-v3-btn-purchase"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePurchaseBuilding(config.id)
                          }}
                          disabled={purchasing === config.id || (user?.narCoin || 0) < config.basePrice}
                        >
                          {purchasing === config.id ? '...' : `🛒 Купить ${config.basePrice.toLocaleString('ru-RU')} NAR`}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </PageLayout>
  )
}
