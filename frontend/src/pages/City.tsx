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
  accumulatedIncome: number | string
  incomePerHour: number | string
  lastIncomeCollection: string | null
  createdAt?: string
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

interface DistrictCapture {
  capturedAt: string
  expiresAt: string | null
  totalIncomeCollected: number
  lastIncomeCollection: string | null
  baseIncomePerDay: number
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
  // Для кланов
  capture?: DistrictCapture | null
  isCapturedByMyClan?: boolean
  isCapturedByOther?: boolean
  capturedBy?: string | null
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
  const [showUpgradeModal, setShowUpgradeModal] = useState<{ buildingId: string; buildingName: string; currentLevel: number; newLevel: number; currentIncome: number; newIncome: number; price: number } | null>(null)
  // Проверяем, в клане ли пользователь (хуки должны быть ДО условных рендеров!)
  const [userClan, setUserClan] = useState<{ clan: any; member: any } | null>(null)
  
  useEffect(() => {
    apiClient.get('/clans/my').then(res => {
      setUserClan(res.data)
    }).catch(() => {
      setUserClan(null)
    })
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      // Проверяем, в клане ли пользователь и обновляем userClan
      const clanRes = await apiClient.get('/clans/my').catch(() => ({ data: { clan: null, member: null } }))
      setUserClan(clanRes.data)
      
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
    if (!building || !building.userBuilding) return
    
    const currentLevel = building.userBuilding.level
    const newLevel = currentLevel + 1
    const currentIncome = Number(building.userBuilding.incomePerHour)
    
    // Рассчитываем новый доход после улучшения
    const incomeMultiplier = building.config.incomeMultiplier || 0.07
    const baseIncome = Number(building.config.baseIncomePerHour)
    const newIncome = Math.floor(baseIncome * (1 + incomeMultiplier * (newLevel - 1)))
    
    const upgradePrice = Math.floor(building.config.basePrice * Math.pow(building.config.upgradeMultiplier || 1.15, currentLevel))
    
    // Показываем модальное окно вместо window.confirm
    setShowUpgradeModal({
      buildingId,
      buildingName: building.config.name,
      currentLevel,
      newLevel,
      currentIncome,
      newIncome,
      price: upgradePrice
    })
  }

  const confirmUpgrade = async () => {
    if (!showUpgradeModal) return
    
    try {
      setPurchasing(showUpgradeModal.buildingId)
      await apiClient.put(`/city/buildings/${showUpgradeModal.buildingId}/upgrade`)
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
      await loadData()
      setShowUpgradeModal(null)
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
  const isInClan = !!userClan?.clan

  if (loading && cityData.length === 0) {
    return (
      <PageLayout title="Районы" showBack={true}>
        <div className="city-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  // Ограничиваем доступ к городу без лицензии предпринимателя (только для игроков без клана)
  if (!isInClan && !user?.hasBusinessLicense) {
    return (
      <PageLayout title="Районы" showBack={true}>
        <div className="city-loading">
          <p style={{ marginBottom: 12 }}>
            Доступ к городу ограничен. Для входа нужна лицензия предпринимателя.
          </p>
          <button
            className="city-buy-license-btn"
            onClick={() => navigate('/shop', { state: { tab: 'bar' } })}
          >
            Открыть магазин и купить лицензию
          </button>
        </div>
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

        {/* Для кланов - отображение захватов районов */}
        {isInClan && selectedDistrictId && currentDistrict && currentDistrict.isUnlocked && (
          <div className="city-clan-section">
            {currentDistrict.isCapturedByMyClan && currentDistrict.capture ? (
              <div className="city-clan-capture-card">
                <div className="city-clan-capture-header">
                  <h3>Район захвачен</h3>
                  {currentDistrict.capture.expiresAt && (
                    <div className="city-clan-capture-time">
                      Истекает: {new Date(currentDistrict.capture.expiresAt).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
                <div className="city-clan-capture-info">
                  <div>Доход в день: {currentDistrict.capture.baseIncomePerDay.toLocaleString('ru-RU')} NAR</div>
                  <div>Всего собрано: {currentDistrict.capture.totalIncomeCollected.toLocaleString('ru-RU')} NAR</div>
                </div>
                <button
                  className="city-clan-capture-btn"
                  onClick={async () => {
                    if (!userClan?.clan?.id) return
                    try {
                      await apiClient.post(`/clans/${userClan.clan.id}/districts/${currentDistrict.code}/collect`)
                      alert('Доход собран!')
                      await loadData()
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Ошибка сбора дохода')
                    }
                  }}
                >
                  Собрать доход
                </button>
              </div>
            ) : currentDistrict.isCapturedByOther ? (
              <div className="city-clan-capture-card city-clan-capture-other">
                <div className="city-clan-capture-header">
                  <h3>Район захвачен другим кланом</h3>
                </div>
                <div className="city-clan-capture-info">
                  <div>Этот район уже захвачен другим кланом</div>
                </div>
              </div>
            ) : (
              <div className="city-clan-capture-card city-clan-capture-available">
                <div className="city-clan-capture-header">
                  <h3>Район свободен</h3>
                </div>
                <div className="city-clan-capture-info">
                  <div>Этот район можно захватить</div>
                  <div>Захват на 24 часа</div>
                </div>
                <button
                  className="city-clan-capture-btn"
                  onClick={async () => {
                    if (!userClan?.clan?.id) return
                    try {
                      await apiClient.post(`/clans/${userClan.clan.id}/territories/capture`, { districtCode: currentDistrict.code })
                      alert('Район успешно захвачен!')
                      // Обновляем данные клана и города
                      const clanRes = await apiClient.get('/clans/my').catch(() => ({ data: { clan: null, member: null } }))
                      setUserClan(clanRes.data)
                      await loadData()
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Ошибка захвата района')
                    }
                  }}
                >
                  Захватить район
                </button>
              </div>
            )}
          </div>
        )}

        {/* Сетка строений для выбранного района (только для игроков без клана) */}
        {!isInClan && selectedDistrictId && currentDistrict && currentDistrict.isUnlocked && (
          <div className="city-buildings-section">
            <div className="city-grid-v3">
              {currentDistrict.buildings && Array.isArray(currentDistrict.buildings) && currentDistrict.buildings.map((buildingData) => {
                const { config, userBuilding } = buildingData
                const incomeMultiplier = config.incomeMultiplier || 0.07
                
                // Накопленный доход берем ТОЛЬКО из БД, без пересчета на фронтенде,
                // чтобы полностью совпадать с логикой бэкенда
                let accumulatedIncome = 0
                if (userBuilding) {
                  accumulatedIncome = Number(userBuilding.accumulatedIncome || 0)
                }
                
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
                        <div>
                          {(typeof userBuilding.incomePerHour === 'string' 
                            ? Number(userBuilding.incomePerHour) 
                            : (userBuilding.incomePerHour || 0)).toLocaleString('ru-RU')} NAR/час
                        </div>
                        {accumulatedIncome > 0 && (
                          <div className="city-card-v3-accumulated">
                            Накоплено: {accumulatedIncome.toLocaleString('ru-RU')} NAR
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Кнопки действий */}
                    <div className="city-card-v3-actions">
                      {userBuilding ? (
                        <>
                          {/* Кнопка сбора прибыли - показываем всегда, если есть накопленный доход */}
                          <button
                            className="city-card-v3-btn city-card-v3-btn-collect"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCollectIncome(userBuilding.id)
                            }}
                            disabled={collecting === userBuilding.id || accumulatedIncome <= 0}
                          >
                            {collecting === userBuilding.id ? 'Сбор...' : accumulatedIncome > 0 ? `💰 Собрать ${accumulatedIncome.toLocaleString('ru-RU')}` : '💰 Нет дохода'}
                          </button>
                          
                          {/* Кнопка улучшения */}
                          {userBuilding.level < config.maxLevel && upgradePrice > 0 ? (
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

      {/* Модальное окно улучшения */}
      {showUpgradeModal && (
        <div className="city-upgrade-modal-overlay" onClick={() => setShowUpgradeModal(null)}>
          <div className="city-upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <div className="city-upgrade-modal-header">
              <h3>Улучшение здания</h3>
              <button className="city-upgrade-modal-close" onClick={() => setShowUpgradeModal(null)}>✕</button>
            </div>
            <div className="city-upgrade-modal-content">
              <div className="city-upgrade-building-name">{showUpgradeModal.buildingName}</div>
              <div className="city-upgrade-levels">
                <div className="city-upgrade-level-item">
                  <span className="city-upgrade-level-label">Текущий уровень:</span>
                  <span className="city-upgrade-level-value">LVL {showUpgradeModal.currentLevel}</span>
                </div>
                <div className="city-upgrade-level-item">
                  <span className="city-upgrade-level-label">Новый уровень:</span>
                  <span className="city-upgrade-level-value">LVL {showUpgradeModal.newLevel}</span>
                </div>
              </div>
              <div className="city-upgrade-income">
                <div className="city-upgrade-income-item">
                  <span className="city-upgrade-income-label">Был доход:</span>
                  <span className="city-upgrade-income-value">{showUpgradeModal.currentIncome.toLocaleString('ru-RU')} NAR/час</span>
                </div>
                <div className="city-upgrade-income-item">
                  <span className="city-upgrade-income-label">Станет доход:</span>
                  <span className="city-upgrade-income-value city-upgrade-income-new">{showUpgradeModal.newIncome.toLocaleString('ru-RU')} NAR/час</span>
                </div>
              </div>
              <div className="city-upgrade-price">
                Стоимость: <strong>{showUpgradeModal.price.toLocaleString('ru-RU')} NAR</strong>
              </div>
            </div>
            <div className="city-upgrade-modal-actions">
              <button 
                className="city-upgrade-btn city-upgrade-btn-cancel"
                onClick={() => setShowUpgradeModal(null)}
              >
                Отмена
              </button>
              <button 
                className="city-upgrade-btn city-upgrade-btn-confirm"
                onClick={confirmUpgrade}
                disabled={purchasing === showUpgradeModal.buildingId || (user?.narCoin || 0) < showUpgradeModal.price}
              >
                {purchasing === showUpgradeModal.buildingId ? 'Улучшение...' : 'Улучшить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}