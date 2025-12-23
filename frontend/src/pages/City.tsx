import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import Button from '../components/Button'
import Icon from '../components/Icon'
import './City.css'

interface Building {
  id: string
  district: string
  type: string
  level: number
  accumulatedIncome: number
  incomePerHour: number
  lastIncomeCollection: string | null
  capturedByClanId: string | null
  capturedAt: string | null
  captureExpiresAt: string | null
}

interface BuildingConfig {
  id: string
  district: string
  type: string
  name: string
  icon?: string
  image?: string
  basePrice: number
  baseIncomePerHour: number
  maxAccumulation: number
  maxLevel: number
}

interface DistrictConfig {
  id: string
  code: string
  name: string
  description?: string
  icon?: string
  image?: string
  order: number
  isActive: boolean
  requiredLevel?: number
}

export default function City() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [availableBuildings, setAvailableBuildings] = useState<BuildingConfig[]>([])
  const [districts, setDistricts] = useState<DistrictConfig[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [collecting, setCollecting] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [buildingsRes, availableRes, districtsRes] = await Promise.all([
        apiClient.get('/city/my-buildings').catch(() => ({ data: [] })),
        apiClient.get('/city/buildings').catch(() => ({ data: [] })),
        apiClient.get('/admin/districts').catch(() => ({ data: [] })),
      ])

      setBuildings(buildingsRes.data || [])
      setAvailableBuildings(availableRes.data || [])
      setDistricts((districtsRes.data || []).filter((d: DistrictConfig) => d.isActive))
    } catch (error) {
      console.error('Failed to load city data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseBuilding = async (buildingConfigId: string) => {
    try {
      setPurchasing(buildingConfigId)
      await apiClient.post('/city/buildings/purchase', { buildingConfigId })
      alert('Строение успешно куплено!')
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке строения')
      console.error('Failed to purchase building:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const handleUpgradeBuilding = async (buildingId: string) => {
    try {
      setPurchasing(buildingId)
      await apiClient.put(`/city/buildings/${buildingId}/upgrade`)
      alert('Строение успешно улучшено!')
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при улучшении строения')
      console.error('Failed to upgrade building:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const handleCollectIncome = async (buildingId: string) => {
    try {
      setCollecting(buildingId)
      const response = await apiClient.post(`/city/buildings/${buildingId}/collect`)
      alert(`Собрано ${response.data.collected} NAR-coin!`)
      await loadData()
      // Обновляем данные пользователя
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при сборе дохода')
      console.error('Failed to collect income:', error)
    } finally {
      setCollecting(null)
    }
  }

  const calculateAccumulatedIncome = (building: Building): number => {
    if (!building.lastIncomeCollection) return building.accumulatedIncome

    const now = new Date()
    const lastCollection = new Date(building.lastIncomeCollection)
    const hoursPassed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60)

    // Если строение захвачено, доход уменьшается на 50%
    const incomeMultiplier = building.capturedByClanId ? 0.5 : 1.0
    const incomeToAdd = Math.floor(building.incomePerHour * incomeMultiplier * hoursPassed)
    
    return Math.min(building.accumulatedIncome + incomeToAdd, 1000000) // Максимальное накопление
  }

  const getDistrictName = (districtCode: string): string => {
    const district = districts.find(d => d.code === districtCode)
    return district?.name || districtCode
  }

  const getBuildingName = (building: Building): string => {
    const config = availableBuildings.find(c => c.district === building.district && c.type === building.type)
    return config?.name || `${building.type} (${building.district})`
  }

  const getBuildingIcon = (building: Building): string | undefined => {
    const config = availableBuildings.find(c => c.district === building.district && c.type === building.type)
    return config?.icon
  }

  const filteredBuildings = selectedDistrict
    ? availableBuildings.filter(b => b.district === selectedDistrict)
    : availableBuildings

  const myBuildingsByDistrict = buildings.reduce((acc, building) => {
    if (!acc[building.district]) {
      acc[building.district] = []
    }
    acc[building.district].push(building)
    return acc
  }, {} as Record<string, Building[]>)

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <PageLayout title="Город" showBack={true}>
        <div className="city-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Город" showBack={true}>
      <div className="city-content">
        {/* Мои строения */}
        {buildings.length > 0 && (
          <div className="city-section">
            <h2 className="city-section-title">Мои строения</h2>
            <div className="city-buildings-list">
              {Object.entries(myBuildingsByDistrict).map(([districtCode, districtBuildings]) => (
                <div key={districtCode} className="city-district-buildings">
                  <h3 className="city-district-title">{getDistrictName(districtCode)}</h3>
                  {districtBuildings.map((building) => {
                    const accumulated = calculateAccumulatedIncome(building)
                    const config = availableBuildings.find(
                      c => c.district === building.district && c.type === building.type
                    )
                    const upgradePrice = config
                      ? Math.floor(config.basePrice * Math.pow(1.4, building.level))
                      : 0

                    return (
                      <div key={building.id} className="city-building-card">
                        <div className="city-building-header">
                          {getBuildingIcon(building) && (
                            <img
                              src={getBuildingIcon(building)}
                              alt={getBuildingName(building)}
                              className="city-building-icon"
                            />
                          )}
                          <div className="city-building-info">
                            <div className="city-building-name">{getBuildingName(building)}</div>
                            <div className="city-building-level">Уровень {building.level}</div>
                            <div className="city-building-income">
                              Доход: {building.incomePerHour} NAR/час
                            </div>
                            {building.capturedByClanId && (
                              <div className="city-building-captured">
                                ⚠️ Захвачено кланом (доход -50%)
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="city-building-actions">
                          {accumulated > 0 && (
                            <Button
                              variant="primary"
                              onClick={() => handleCollectIncome(building.id)}
                              disabled={collecting === building.id}
                            >
                              {collecting === building.id ? 'Сбор...' : `Собрать ${accumulated} NAR`}
                            </Button>
                          )}
                          {config && building.level < config.maxLevel && (
                            <Button
                              variant="secondary"
                              onClick={() => handleUpgradeBuilding(building.id)}
                              disabled={purchasing === building.id}
                            >
                              {purchasing === building.id ? 'Улучшение...' : `Улучшить (${upgradePrice} NAR)`}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Доступные строения для покупки */}
        <div className="city-section">
          <h2 className="city-section-title">Доступные строения</h2>
          
          {/* Фильтр по районам */}
          {districts.length > 0 && (
            <div className="city-district-filters">
              <button
                className={`city-district-filter ${!selectedDistrict ? 'active' : ''}`}
                onClick={() => setSelectedDistrict(null)}
              >
                Все
              </button>
              {districts.map(district => (
                <button
                  key={district.id}
                  className={`city-district-filter ${selectedDistrict === district.code ? 'active' : ''}`}
                  onClick={() => setSelectedDistrict(district.code)}
                >
                  {district.name}
                </button>
              ))}
            </div>
          )}

          <div className="city-available-buildings">
            {filteredBuildings.map((config) => {
              const existingBuilding = buildings.find(
                b => b.district === config.district && b.type === config.type
              )

              return (
                <div key={config.id} className="city-building-card">
                  <div className="city-building-header">
                    {config.icon && (
                      <img
                        src={config.icon}
                        alt={config.name}
                        className="city-building-icon"
                      />
                    )}
                    <div className="city-building-info">
                      <div className="city-building-name">{config.name}</div>
                      <div className="city-building-district">{getDistrictName(config.district)}</div>
                      <div className="city-building-stats">
                        <div>Цена: {config.basePrice} NAR</div>
                        <div>Доход: {config.baseIncomePerHour} NAR/час</div>
                        <div>Макс. уровень: {config.maxLevel}</div>
                      </div>
                    </div>
                  </div>
                  <div className="city-building-actions">
                    {existingBuilding ? (
                      <div className="city-building-owned">Уже куплено</div>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => handlePurchaseBuilding(config.id)}
                        disabled={purchasing === config.id}
                      >
                        {purchasing === config.id ? 'Покупка...' : `Купить за ${config.basePrice} NAR`}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {buildings.length === 0 && filteredBuildings.length === 0 && (
          <div className="city-unavailable">
            <img src="/img/город.png" alt="City" className="city-unavailable-icon" />
            <h2 className="city-unavailable-title">Город недоступен</h2>
            <p className="city-unavailable-text">
              Строения пока не настроены администратором
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

