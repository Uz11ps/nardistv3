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
  upgradeMultiplier?: number
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
  const location = useLocation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [cityData, setCityData] = useState<DistrictData[]>([])
  const [collecting, setCollecting] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [clanMode, setClanMode] = useState(false)
  const [clanId, setClanId] = useState<string | null>(null)
  const [clanBuildings, setClanBuildings] = useState<any[]>([])
  const [capturing, setCapturing] = useState<string | null>(null)
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set())
  const [showBuildingModal, setShowBuildingModal] = useState<BuildingConfig | null>(null)
  const [showDistrictModal, setShowDistrictModal] = useState<DistrictData | null>(null)

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
        setCityData([])
      } else {
        // Обычный режим: загружаем полную структуру города
        const response = await apiClient.get('/city/data')
        setCityData(response.data || [])
        
        // По умолчанию разворачиваем первый открытый район
        if (response.data && response.data.length > 0) {
          const firstUnlocked = response.data.find((d: DistrictData) => d.isUnlocked)
          if (firstUnlocked) {
            setExpandedDistricts(new Set([firstUnlocked.id]))
          }
        }
      }
    } catch (error) {
      console.error('Failed to load city data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDistrict = (districtId: string) => {
    const newExpanded = new Set(expandedDistricts)
    if (newExpanded.has(districtId)) {
      newExpanded.delete(districtId)
    } else {
      newExpanded.add(districtId)
    }
    setExpandedDistricts(newExpanded)
  }

  const handlePurchaseBuilding = async (buildingConfigId: string) => {
    try {
      setPurchasing(buildingConfigId)
      await apiClient.post('/city/buildings/purchase', { buildingConfigId })
      alert('Строение успешно куплено!')
      await loadData()
      // Обновляем данные пользователя
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
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

  const calculateAccumulatedIncome = (building: Building, config: BuildingConfig): number => {
    if (!building.lastIncomeCollection) return building.accumulatedIncome

    const now = new Date()
    const lastCollection = new Date(building.lastIncomeCollection)
    const hoursPassed = (now.getTime() - lastCollection.getTime()) / (1000 * 60 * 60)

    // Если строение захвачено, доход уменьшается на 50%
    const incomeMultiplier = building.capturedByClanId ? 0.5 : 1.0
    const incomeToAdd = Math.floor(building.incomePerHour * incomeMultiplier * hoursPassed)
    
    return Math.min(building.accumulatedIncome + incomeToAdd, config.maxAccumulation || 1000000)
  }

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
    <PageLayout title={clanMode ? "Захват районов" : "Город"} showBack={true}>
      <div className="city-content">
        {clanMode ? (
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
        ) : (
          <div className="city-districts-list">
            {cityData.length === 0 ? (
              <div className="city-empty">Город пока не застроен</div>
            ) : (
              cityData.map(district => (
                <div key={district.id} className={`city-district-card ${!district.isUnlocked ? 'locked' : ''}`}>
                  <div 
                    className="city-district-header" 
                    onClick={() => district.isUnlocked && toggleDistrict(district.id)}
                    style={district.image ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${getImageUrl(district.image)})` } : {}}
                  >
                    <div className="city-district-info">
                      <h3 className="city-district-name">
                        {district.name}
                        {!district.isUnlocked && <span className="city-district-lock">🔒 (ур. {district.requiredLevel})</span>}
                        <button 
                          className="city-info-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDistrictModal(district)
                          }}
                        >
                          ⓘ
                        </button>
                      </h3>
                      {district.description && <p className="city-district-desc">{district.description}</p>}
                    </div>
                    {district.isUnlocked && (
                      <div className={`city-district-arrow ${expandedDistricts.has(district.id) ? 'expanded' : ''}`}>
                        ▼
                      </div>
                    )}
                  </div>

                  {district.isUnlocked && expandedDistricts.has(district.id) && (
                    <div className="city-district-content">
                      <div className="city-buildings-list">
                        {district.buildings.map(({ config, userBuilding }) => (
                          <div key={config.id} className="city-building-card">
                            <div className="city-building-header">
                              {(getImageUrl(config.icon) || config.icon) && (
                                <img
                                  src={getImageUrl(config.icon) || config.icon}
                                  alt={config.name}
                                  className="city-building-icon"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                              <div className="city-building-info">
                                <div className="city-building-name">
                                  {config.name}
                                  <button 
                                    className="city-building-info-btn"
                                    onClick={() => setShowBuildingModal(config)}
                                  >
                                    ⓘ
                                  </button>
                                </div>
                                <div className="city-building-status">
                                  {userBuilding ? (
                                    <>
                                      <span className="city-building-status-dot stable"></span>
                                      <span className="city-building-status-text">Уровень {userBuilding.level}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="city-building-status-dot free"></span>
                                      <span className="city-building-status-text">Доступно</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="city-building-right">
                                <div className="city-building-income">
                                  {userBuilding ? userBuilding.incomePerHour : config.baseIncomePerHour} NAR / час
                                </div>
                                <div className="city-building-actions">
                                  {userBuilding ? (
                                    <>
                                      {calculateAccumulatedIncome(userBuilding, config) > 0 && (
                                        <Button
                                          variant="primary"
                                          onClick={() => handleCollectIncome(userBuilding.id)}
                                          disabled={collecting === userBuilding.id}
                                          className="city-building-action-btn"
                                        >
                                          {collecting === userBuilding.id ? '...' : `Собрать ${calculateAccumulatedIncome(userBuilding, config)}`}
                                        </Button>
                                      )}
                                      {userBuilding.level < config.maxLevel && (
                                        <Button
                                          variant="secondary"
                                          onClick={() => handleUpgradeBuilding(userBuilding.id)}
                                          disabled={purchasing === userBuilding.id}
                                          className="city-building-action-btn"
                                        >
                                          {purchasing === userBuilding.id ? '...' : `Улучшить (${Math.floor(config.basePrice * Math.pow(config.upgradeMultiplier || 1.4, userBuilding.level)).toLocaleString()})`}
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <Button
                                      variant="primary"
                                      onClick={() => handlePurchaseBuilding(config.id)}
                                      disabled={purchasing === config.id}
                                      className="city-building-action-btn"
                                    >
                                      {purchasing === config.id ? '...' : `Купить (${config.basePrice.toLocaleString()})`}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Модальное окно района */}
      {showDistrictModal && (
        <div className="city-modal-overlay" onClick={() => setShowDistrictModal(null)}>
          <div className="city-modal" onClick={e => e.stopPropagation()}>
            <div className="city-modal-header">
              <h3>{showDistrictModal.name}</h3>
              <button onClick={() => setShowDistrictModal(null)}>×</button>
            </div>
            <div className="city-modal-content">
              {showDistrictModal.image && (
                <img src={getImageUrl(showDistrictModal.image)} alt={showDistrictModal.name} className="city-modal-image" />
              )}
              <p className="city-modal-desc">{showDistrictModal.description || 'Описание отсутствует'}</p>
              <div className="city-modal-stats">
                <div className="city-modal-stat">
                  <span className="label">Доступ с уровня:</span>
                  <span className="value">{showDistrictModal.requiredLevel}</span>
                </div>
                <div className="city-modal-stat">
                  <span className="label">Статус:</span>
                  <span className={`value ${showDistrictModal.isUnlocked ? 'unlocked' : 'locked'}`}>
                    {showDistrictModal.isUnlocked ? 'Открыт' : 'Закрыт'}
                  </span>
                </div>
              </div>
            </div>
            <div className="city-modal-footer">
              <Button variant="primary" onClick={() => setShowDistrictModal(null)}>Понятно</Button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно строения */}
      {showBuildingModal && (
        <div className="city-modal-overlay" onClick={() => setShowBuildingModal(null)}>
          <div className="city-modal" onClick={e => e.stopPropagation()}>
            <div className="city-modal-header">
              <h3>{showBuildingModal.name}</h3>
              <button onClick={() => setShowBuildingModal(null)}>×</button>
            </div>
            <div className="city-modal-content">
              {showBuildingModal.image && (
                <img src={getImageUrl(showBuildingModal.image)} alt={showBuildingModal.name} className="city-modal-image" />
              )}
              <div className="city-modal-stats">
                <div className="city-modal-stat">
                  <span className="label">Базовый доход:</span>
                  <span className="value">{showBuildingModal.baseIncomePerHour} NAR/час</span>
                </div>
                <div className="city-modal-stat">
                  <span className="label">Макс. уровень:</span>
                  <span className="value">{showBuildingModal.maxLevel}</span>
                </div>
                <div className="city-modal-stat">
                  <span className="label">Макс. накопление:</span>
                  <span className="value">{showBuildingModal.maxAccumulation.toLocaleString()} NAR</span>
                </div>
              </div>
              <div className="city-modal-info-text">
                <p>Улучшайте строение, чтобы увеличить доход в час. С каждым уровнем стоимость улучшения растет, но и ваша прибыль становится больше!</p>
              </div>
            </div>
            <div className="city-modal-footer">
              <Button variant="primary" onClick={() => setShowBuildingModal(null)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

