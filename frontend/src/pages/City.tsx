import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient, getImageUrl } from '../api/client'
import Button from '../components/Button'
import Icon from '../components/Icon'
import './City.css'

interface Building {
  id: string
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
  type: string
  name: string
  icon?: string
  image?: string
  basePrice: number
  baseIncomePerHour: number
  maxAccumulation: number
  maxLevel: number
}


export default function City() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [availableBuildings, setAvailableBuildings] = useState<BuildingConfig[]>([])
  const [collecting, setCollecting] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [clanMode, setClanMode] = useState(false)
  const [clanId, setClanId] = useState<string | null>(null)
  const [clanBuildings, setClanBuildings] = useState<any[]>([])
  const [capturing, setCapturing] = useState<string | null>(null)

  useEffect(() => {
    // Проверяем, пришли ли мы из клана
    const state = location.state as any
    if (state?.clanMode && state?.clanId) {
      setClanMode(true)
      setClanId(state.clanId)
    } else {
      setClanMode(false)
      setClanId(null)
    }
  }, [location])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, clanMode, clanId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      if (clanMode && clanId) {
        // Режим клана: загружаем доступные строения для захвата
        const availableRes = await apiClient.get(`/clans/${clanId}/territories/available`).catch(() => ({ data: [] }))
        setClanBuildings(availableRes.data || [])
        setAvailableBuildings([]) // Не показываем личные строения
        setBuildings([]) // Не показываем личные строения
      } else {
        // Обычный режим: загружаем личные строения и доступные для покупки
        const [buildingsRes, availableRes] = await Promise.all([
          apiClient.get('/city/my-buildings').catch(() => ({ data: [] })),
          apiClient.get('/city/buildings').catch(() => ({ data: [] })),
        ])

        setBuildings(buildingsRes.data || [])
        setAvailableBuildings(availableRes.data || [])
        setClanBuildings([])
      }
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

  const getBuildingName = (building: Building): string => {
    const config = availableBuildings.find(c => c.type === building.type)
    return config?.name || building.type
  }

  const getBuildingIcon = (building: Building): string | undefined => {
    const config = availableBuildings.find(c => c.type === building.type)
    if (config?.icon) {
      const iconUrl = getImageUrl(config.icon) || config.icon
      // Если это относительный путь, добавляем базовый URL
      if (iconUrl && !iconUrl.startsWith('http') && !iconUrl.startsWith('/')) {
        return `/${iconUrl}`
      }
      return iconUrl
    }
    return undefined
  }

  const getBuildingImage = (building: Building): string | undefined => {
    const config = availableBuildings.find(c => c.type === building.type)
    return config?.image ? getImageUrl(config.image) || config.image : undefined
  }

  // Группируем строения по типу, а не по району
  const myBuildingsByType = buildings.reduce((acc, building) => {
    if (!acc[building.type]) {
      acc[building.type] = []
    }
    acc[building.type].push(building)
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

  const handleCaptureBuilding = async (buildingType: string) => {
    if (!clanId) return
    
    try {
      setCapturing(buildingType)
      await apiClient.post(`/clans/${clanId}/territories/capture`, { buildingType })
      alert('Строение успешно захвачено!')
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при захвате строения')
      console.error('Failed to capture building:', error)
    } finally {
      setCapturing(null)
    }
  }

  return (
    <PageLayout title={clanMode ? "Районы" : "Город"} showBack={true}>
      <div className="city-content">
        {clanMode ? (
          <>
            {/* Режим клана: доступные строения для захвата */}
            <div className="city-section">
              <h2 className="city-section-title">Доступные строения для захвата</h2>
              <div className="city-available-buildings">
                {clanBuildings.length === 0 ? (
                  <div className="city-empty">Нет доступных строений для захвата</div>
                ) : (
                  clanBuildings.map((building: any) => (
                    <div key={building.id || building.type} className="city-building-card">
                      <div className="city-building-header">
                        {building.icon && (
                          <img
                            src={getImageUrl(building.icon) || building.icon}
                            alt={building.name}
                            className="city-building-icon"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                        <div className="city-building-info">
                          <div className="city-building-name">{building.name}</div>
                          <div className="city-building-owner">
                            Доступно: {building.availableCount} строений
                          </div>
                          <div className="city-building-status">
                            <span className="city-building-status-dot free"></span>
                            <span className="city-building-status-text">доступен для захвата</span>
                          </div>
                        </div>
                        <div className="city-building-right">
                          <div className="city-building-income">
                            {building.totalPotentialIncome.toLocaleString()} NAR / час
                          </div>
                          <div className="city-building-actions">
                            <Button
                              variant="primary"
                              onClick={() => handleCaptureBuilding(building.type)}
                              disabled={capturing === building.type || building.availableCount === 0}
                              className="city-building-action-btn"
                            >
                              {capturing === building.type ? 'Захват...' : building.availableCount === 0 ? 'Нет доступных' : 'Захватить'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <>
        {/* Мои строения */}
        {buildings.length > 0 && (
          <div className="city-section">
            <h2 className="city-section-title">Мои строения</h2>
            <div className="city-buildings-list">
              {Object.entries(myBuildingsByType).map(([buildingType, typeBuildings]) => (
                <div key={buildingType} className="city-district-buildings">
                  {typeBuildings.map((building) => {
                    const accumulated = calculateAccumulatedIncome(building)
                    const config = availableBuildings.find(
                      c => c.type === building.type
                    )
                    const multiplier = config?.upgradeMultiplier || 1.4
                    const upgradePrice = config
                      ? Math.floor(config.basePrice * Math.pow(multiplier, building.level))
                      : 0

                    return (
                      <div key={building.id} className="city-building-card">
                        <div className="city-building-header">
                          {getBuildingIcon(building) && (
                            <img
                              src={getBuildingIcon(building)!}
                              alt={getBuildingName(building)}
                              className="city-building-icon"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <div className="city-building-info">
                            <div className="city-building-name">{getBuildingName(building)}</div>
                            <div className="city-building-owner">
                              Владелец: {user?.nickname || user?.username || 'Вы'}
                            </div>
                            <div className="city-building-status">
                              <span className="city-building-status-dot stable"></span>
                              <span className="city-building-status-text">Уровень {building.level}</span>
                            </div>
                          </div>
                          <div className="city-building-right">
                            <div className="city-building-income">
                              {building.incomePerHour} NAR / час
                            </div>
                            <div className="city-building-actions">
                              {accumulated > 0 && (
                                <Button
                                  variant="primary"
                                  onClick={() => handleCollectIncome(building.id)}
                                  disabled={collecting === building.id}
                                  className="city-building-action-btn"
                                >
                                  {collecting === building.id ? 'Сбор...' : `Собрать ${accumulated} NAR`}
                                </Button>
                              )}
                              {config && building.level < (config.maxLevel || 10) && (
                                <Button
                                  variant="secondary"
                                  onClick={() => handleUpgradeBuilding(building.id)}
                                  disabled={purchasing === building.id}
                                  className="city-building-action-btn"
                                >
                                  {purchasing === building.id ? 'Улучшение...' : `Улучшить (${upgradePrice.toLocaleString()} NAR)`}
                                </Button>
                              )}
                            </div>
                          </div>
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

          <div className="city-available-buildings">
            {availableBuildings
              .filter((config) => {
                // Фильтруем строения, которые уже куплены
                return !buildings.some(b => b.type === config.type)
              })
              .map((config) => {
              return (
                <div key={config.id} className="city-building-card">
                  <div className="city-building-header">
                    {config.icon && (() => {
                      const iconUrl = getImageUrl(config.icon) || config.icon
                      const finalIconUrl = iconUrl && !iconUrl.startsWith('http') && !iconUrl.startsWith('/') 
                        ? `/${iconUrl}` 
                        : iconUrl
                      return (
                        <img
                          src={finalIconUrl}
                          alt={config.name}
                          className="city-building-icon"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )
                    })()}
                    <div className="city-building-info">
                      <div className="city-building-name">{config.name}</div>
                      <div className="city-building-owner">
                        Владелец: -
                      </div>
                      <div className="city-building-status">
                        <span className="city-building-status-dot free"></span>
                        <span className="city-building-status-text">свободен</span>
                      </div>
                    </div>
                    <div className="city-building-right">
                      <div className="city-building-income">
                        {config.baseIncomePerHour} NAR / час
                      </div>
                      <div className="city-building-actions">
                        <Button
                          variant="primary"
                          onClick={() => handlePurchaseBuilding(config.id)}
                          disabled={purchasing === config.id}
                          className="city-building-action-btn"
                        >
                          {purchasing === config.id ? 'Покупка...' : `Купить`}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {availableBuildings.length === 0 && buildings.length === 0 && (
          <div className="city-unavailable">
            <img src="/img/город.png" alt="City" className="city-unavailable-icon" />
            <h2 className="city-unavailable-title">Город недоступен</h2>
            <p className="city-unavailable-text">
              Строения пока не настроены администратором. Обратитесь к администратору для настройки города.
            </p>
          </div>
        )}
          </>
        )}
      </div>
    </PageLayout>
  )
}

