import { useState, useEffect, useCallback } from 'react'
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
  const { user, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [cityData, setCityData] = useState<DistrictData[]>([])
  const [collecting, setCollecting] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [clanMode, setClanMode] = useState(false)
  const [clanBuildings, setClanBuildings] = useState<any[]>([])
  const [capturing, setCapturing] = useState<string | null>(null)
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null)
  const [showBuildingModal, setShowBuildingModal] = useState<BuildingConfig | null>(null)
  const [skillPoints, setSkillPoints] = useState({ economy: 0 })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [cityRes, spResponse] = await Promise.all([
        apiClient.get('/city/districts'),
        apiClient.get('/progress/skill-points').catch(() => ({ data: { economy: 0 } }))
      ])
      
      // Проверяем, что данные - массив
      const districts = Array.isArray(cityRes.data) ? cityRes.data : []
      setCityData(districts)
      setSkillPoints(spResponse.data || { economy: 0 })
      
      if (districts.length > 0 && !selectedDistrictId) {
        const firstUnlocked = districts.find((d: DistrictData) => d.isUnlocked) || districts[0]
        setSelectedDistrictId(firstUnlocked.id)
      }
    } catch (error) {
      console.error('Failed to load city data:', error)
      setCityData([]) // Устанавливаем пустой массив при ошибке
    } finally {
      setLoading(false)
    }
  }, [selectedDistrictId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const calculateAccumulatedIncome = (building: Building, config: BuildingConfig) => {
    if (!building.lastIncomeCollection) return building.accumulatedIncome
    
    const lastCollection = new Date(building.lastIncomeCollection).getTime()
    const now = new Date().getTime()
    const hoursPassed = (now - lastCollection) / (1000 * 60 * 60)
    
    // Применяем бонус экономики
    const econSp = skillPoints.economy || 0
    const passiveMult = 1 + 0.015 * Math.min(econSp, 40)
    
    const additionalIncome = Math.floor(building.incomePerHour * hoursPassed * passiveMult)
    return Math.min(building.accumulatedIncome + additionalIncome, config.maxAccumulation)
  }

  const handleCollectIncome = async (buildingId: string) => {
    try {
      setCollecting(buildingId)
      const response = await apiClient.post(`/city/buildings/${buildingId}/collect`)
      
      // Обновляем баланс пользователя
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      
      // Обновляем данные города
      await loadData()
      alert(`Собрано ${response.data.collectedAmount} NAR!`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка сбора прибыли')
    } finally {
      setCollecting(null)
    }
  }

  const handlePurchaseBuilding = async (configId: string) => {
    try {
      setPurchasing(configId)
      await apiClient.post('/city/buildings/purchase', { configId })
      
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      
      await loadData()
      setShowBuildingModal(null)
      alert('Здание успешно приобретено!')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка покупки здания')
    } finally {
      setPurchasing(null)
    }
  }

  const handleUpgradeBuilding = async (buildingId: string) => {
    try {
      setPurchasing(buildingId)
      await apiClient.post(`/city/upgrade/${buildingId}`)
      
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      
      await loadData()
      setShowBuildingModal(null)
      alert('Здание успешно улучшено!')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка улучшения здания')
    } finally {
      setPurchasing(null)
    }
  }

  const handleCaptureBuilding = async (buildingType: string) => {
    try {
      setCapturing(buildingType)
      // Логика захвата для кланов
      alert('Захват районов в разработке')
    } catch (error) {
      console.error('Capture failed:', error)
    } finally {
      setCapturing(null)
    }
  }

  const currentDistrict = cityData.find(d => d.id === selectedDistrictId)

  if (loading && cityData.length === 0) {
    return (
      <PageLayout title="Город" showBack={true}>
        <div className="city-loading">Загрузка города...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title={clanMode ? "Захват районов" : "Город"} showBack={true}>
      <div className="city-content-v2">
        {clanMode ? (
          <div className="city-section">
            <h2 className="city-section-title">Доступные строения для захвата</h2>
            <div className="city-available-buildings">
              {!clanBuildings || !Array.isArray(clanBuildings) || clanBuildings.length === 0 ? (
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
          <div className="city-v2-container">
            {/* Горизонтальные вкладки районов */}
            <div className="city-tabs">
              {cityData && Array.isArray(cityData) && cityData.map(district => (
                <button
                  key={district.id}
                  className={`city-tab ${selectedDistrictId === district.id ? 'active' : ''} ${!district.isUnlocked ? 'locked' : ''}`}
                  onClick={() => setSelectedDistrictId(district.id)}
                  title={!district.isUnlocked ? `Откроется на ${district.requiredLevel} уровне` : ''}
                >
                  {district.name}
                  {!district.isUnlocked && (
                    <span className="city-tab-lock" title={`Откроется на ${district.requiredLevel} уровне`}>
                      🔒 {district.requiredLevel}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Контент текущего района */}
            {currentDistrict && (
              <div className="city-district-view">
                {!currentDistrict.isUnlocked && (
                  <div className="city-district-locked-banner">
                    <Icon name="lock" size={24} />
                    <span>Откроется на {currentDistrict.requiredLevel} уровне (Ваш уровень: {user?.level || 1})</span>
                  </div>
                )}
                
                <div className="city-buildings-grid">
                  {currentDistrict.buildings && Array.isArray(currentDistrict.buildings) && currentDistrict.buildings.map(({ config, userBuilding }) => {
                    const accumulated = userBuilding ? calculateAccumulatedIncome(userBuilding, config) : 0
                    const upgradePrice = userBuilding 
                      ? Math.floor(config.basePrice * Math.pow(config.upgradeMultiplier || 1.4, userBuilding.level))
                      : config.basePrice

                    const isDistrictLocked = !currentDistrict.isUnlocked;
                    
                    return (
                      <div 
                        key={config.id} 
                        className={`city-card-v2 ${isDistrictLocked ? 'disabled preview' : ''}`}
                        onClick={() => !isDistrictLocked && setShowBuildingModal(config)}
                        style={isDistrictLocked ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      >
                        <div className="city-card-header">
                          <div className="city-card-icon-wrapper">
                            <img
                              src={getImageUrl(config.icon) || config.icon || '/img/building_placeholder.png'}
                              alt={config.name}
                              className="city-card-icon"
                              onError={(e) => {
                                e.currentTarget.src = '/img/building_placeholder.png'
                              }}
                            />
                          </div>
                          <div className="city-card-title-group">
                            <div className="city-card-name">{config.name}</div>
                            <div className="city-card-profit">
                              Прибыль в час
                              <div className="city-card-profit-value">
                                <img src="/img/narcoin.png" alt="NAR" className="city-card-coin-mini" />
                                {userBuilding ? userBuilding.incomePerHour.toLocaleString() : config.baseIncomePerHour.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="city-card-footer">
                          <div className="city-card-lvl">lvl {userBuilding?.level || 0}</div>
                          <div className="city-card-price">
                            <div className="city-card-price-value">
                              {userBuilding ? (
                                userBuilding.level < config.maxLevel ? (
                                  <>
                                    <img src="/img/narcoin.png" alt="NAR" className="city-card-coin-mini" />
                                    {upgradePrice >= 1000 ? `${(upgradePrice / 1000).toFixed(1)}K` : upgradePrice}
                                  </>
                                ) : (
                                  'MAX'
                                )
                              ) : (
                                <>
                                  <img src="/img/narcoin.png" alt="NAR" className="city-card-coin-mini" />
                                  {config.basePrice >= 1000 ? `${(config.basePrice / 1000).toFixed(1)}K` : config.basePrice}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="city-card-actions-overlay" onClick={e => e.stopPropagation()}>
                          {isDistrictLocked ? (
                            <div style={{
                              padding: '8px',
                              textAlign: 'center',
                              color: '#ff6b6b',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Район заблокирован до {currentDistrict.requiredLevel} уровня
                            </div>
                          ) : userBuilding ? (
                            <>
                              {accumulated > 0 && (
                                <button
                                  className="city-card-action-btn collect"
                                  onClick={() => handleCollectIncome(userBuilding.id)}
                                  disabled={collecting === userBuilding.id || isDistrictLocked}
                                >
                                  {collecting === userBuilding.id ? '...' : `Собрать ${accumulated}`}
                                </button>
                              )}
                              {userBuilding.level < config.maxLevel && (
                                <button
                                  className="city-card-action-btn upgrade"
                                  onClick={() => handleUpgradeBuilding(userBuilding.id)}
                                  disabled={purchasing === userBuilding.id || (user?.narCoin || 0) < upgradePrice || isDistrictLocked}
                                >
                                  {purchasing === userBuilding.id ? '...' : 'Улучшить'}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              className="city-card-action-btn buy"
                              onClick={() => handlePurchaseBuilding(config.id)}
                              disabled={purchasing === config.id || (user?.narCoin || 0) < config.basePrice || isDistrictLocked}
                            >
                              {purchasing === config.id ? '...' : 'Купить'}
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
        )}
      </div>

      {showBuildingModal && (
        <div className="city-modal-overlay" onClick={() => setShowBuildingModal(null)}>
          <div className="city-modal" onClick={e => e.stopPropagation()}>
            <div className="city-modal-header">
              <h3>{showBuildingModal.name}</h3>
              <button onClick={() => setShowBuildingModal(null)}>×</button>
            </div>
            {currentDistrict && !currentDistrict.isUnlocked && (
              <div style={{
                padding: '12px',
                background: 'rgba(255, 107, 107, 0.1)',
                borderBottom: '1px solid rgba(255, 107, 107, 0.3)',
                color: '#ff6b6b',
                fontSize: '14px',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                ⚠️ Район заблокирован до {currentDistrict.requiredLevel} уровня (Ваш уровень: {user?.level || 1})
              </div>
            )}
            <div className="city-modal-content">
              <div className="city-modal-image-container">
                <img 
                  src={getImageUrl(showBuildingModal.image || showBuildingModal.icon) || showBuildingModal.image || showBuildingModal.icon || '/img/building_placeholder.png'} 
                  alt={showBuildingModal.name} 
                  className="city-modal-image" 
                />
              </div>
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
              
              {(() => {
                const userBuilding = currentDistrict?.buildings && Array.isArray(currentDistrict.buildings) 
                  ? currentDistrict.buildings.find(b => b.config.id === showBuildingModal.id)?.userBuilding 
                  : null
                const upgradePrice = userBuilding 
                  ? Math.floor(showBuildingModal.basePrice * Math.pow(showBuildingModal.upgradeMultiplier || 1.4, userBuilding.level))
                  : showBuildingModal.basePrice
                
                return (
                  <div className="city-modal-footer-v2">
                    {userBuilding ? (
                      <div className="city-modal-actions-group">
                        <div className="city-modal-info-row">
                          <span>Ваш уровень: {userBuilding.level}</span>
                          <span>Текущий доход: {userBuilding.incomePerHour} NAR/ч</span>
                        </div>
                        {userBuilding.level < showBuildingModal.maxLevel ? (
                          <Button 
                            variant="primary" 
                            fullWidth
                            onClick={() => handleUpgradeBuilding(userBuilding.id)}
                            disabled={purchasing === userBuilding.id || (user?.narCoin || 0) < upgradePrice}
                          >
                            {purchasing === userBuilding.id ? 'Улучшение...' : `Улучшить за ${upgradePrice.toLocaleString()} NAR`}
                          </Button>
                        ) : (
                          <div className="city-max-lvl-badge">МАКСИМАЛЬНЫЙ УРОВЕНЬ</div>
                        )}
                      </div>
                    ) : (
                      <Button 
                        variant="primary" 
                        fullWidth
                        onClick={() => handlePurchaseBuilding(showBuildingModal.id)}
                        disabled={purchasing === showBuildingModal.id || (user?.narCoin || 0) < showBuildingModal.basePrice || !currentDistrict?.isUnlocked}
                      >
                        {!currentDistrict?.isUnlocked 
                          ? `Заблокировано до ${currentDistrict?.requiredLevel} уровня`
                          : purchasing === showBuildingModal.id 
                            ? 'Покупка...' 
                            : `Купить за ${showBuildingModal.basePrice.toLocaleString()} NAR`}
                      </Button>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

