import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient, getImageUrl } from '../api/client'
import Button from '../components/Button'
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
  const [selectedBuilding, setSelectedBuilding] = useState<{ config: BuildingConfig; userBuilding: Building | null } | null>(null)
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
              {currentDistrict.buildings && Array.isArray(currentDistrict.buildings) && currentDistrict.buildings.map((buildingData) => (
                <div 
                  key={buildingData.config.id} 
                  className={`city-card-v3 ${selectedBuilding?.config.id === buildingData.config.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBuilding(buildingData)}
                >
                  <div className="city-card-v3-icon">
                    <img
                      src={getImageUrl(buildingData.config.icon) || buildingData.config.icon || '/img/building_placeholder.png'}
                      alt={buildingData.config.name}
                      onError={(e) => { e.currentTarget.src = '/img/building_placeholder.png' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Информация о выбранном строении (вместо модального окна) */}
        {selectedBuilding && currentDistrict?.isUnlocked && (
          <div className="city-building-info">
            <div className="city-building-header">
              <h3>{selectedBuilding.config.name}</h3>
            </div>
            <div className="city-building-details">
              {(() => {
                const { config, userBuilding } = selectedBuilding
                const incomeMultiplier = config.incomeMultiplier || 0.07
                
                if (userBuilding) {
                  const currentIncome = userBuilding.incomePerHour
                  const nextLevel = userBuilding.level + 1
                  const multiplier = Number(incomeMultiplier)
                  const currentLevel = userBuilding.level
                  const calculatedBaseIncome = currentIncome / (1 + multiplier * (currentLevel - 1))
                  const nextIncome = Math.floor(calculatedBaseIncome * (1 + multiplier * (nextLevel - 1)))
                  const accumulatedIncome = Number(userBuilding.accumulatedIncome || 0)
                  
                  return (
                    <>
                      <div className="city-building-stat">
                        <span className="label">Прибыль:</span>
                        <span className="value">{currentIncome.toLocaleString('ru-RU')} NAR/час</span>
                      </div>
                      <div className="city-building-stat">
                        <span className="label">Была:</span>
                        <span className="value">{currentIncome.toLocaleString('ru-RU')} NAR/час</span>
                      </div>
                      <div className="city-building-stat">
                        <span className="label">Станет:</span>
                        <span className="value">{nextIncome.toLocaleString('ru-RU')} NAR/час</span>
                      </div>
                      <div className="city-building-stat">
                        <span className="label">Улучшение:</span>
                        <span className="value">с уровня {userBuilding.level} до уровня {nextLevel}</span>
                      </div>
                      {accumulatedIncome > 0 && (
                        <div className="city-building-stat">
                          <span className="label">Накоплено:</span>
                          <span className="value">{accumulatedIncome.toLocaleString('ru-RU')} NAR</span>
                        </div>
                      )}
                      <div className="city-building-actions">
                        {accumulatedIncome > 0 && (
                          <Button 
                            variant="primary" 
                            fullWidth 
                            onClick={() => handleCollectIncome(userBuilding.id)} 
                            disabled={collecting === userBuilding.id}
                            style={{ marginBottom: '8px' }}
                          >
                            {collecting === userBuilding.id ? 'Сбор...' : `Собрать ${accumulatedIncome.toLocaleString('ru-RU')} NAR`}
                          </Button>
                        )}
                        {userBuilding.level < config.maxLevel ? (
                          <Button 
                            variant="primary" 
                            fullWidth 
                            onClick={() => handleUpgradeBuilding(userBuilding.id)} 
                            disabled={purchasing === userBuilding.id || (user?.narCoin || 0) < Math.floor(config.basePrice * Math.pow(config.upgradeMultiplier || 1.15, userBuilding.level))}
                          >
                            {purchasing === userBuilding.id ? '...' : `Улучшить (${Math.floor(config.basePrice * Math.pow(config.upgradeMultiplier || 1.15, userBuilding.level)).toLocaleString('ru-RU')} NAR)`}
                          </Button>
                        ) : (
                          <div className="city-max-lvl">МАКС. УРОВЕНЬ</div>
                        )}
                      </div>
                    </>
                  )
                }
                
                return (
                  <>
                    <div className="city-building-stat">
                      <span className="label">Прибыль:</span>
                      <span className="value">{config.baseIncomePerHour} NAR/час</span>
                    </div>
                    <div className="city-building-actions">
                      <Button 
                        variant="primary" 
                        fullWidth 
                        onClick={() => handlePurchaseBuilding(config.id)} 
                        disabled={purchasing === config.id || (user?.narCoin || 0) < config.basePrice}
                      >
                        {purchasing === config.id ? '...' : `Купить (${config.basePrice.toLocaleString('ru-RU')} NAR)`}
                      </Button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>

    </PageLayout>
  )
}
