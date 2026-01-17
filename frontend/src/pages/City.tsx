import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
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
  const [showBuildingModal, setShowBuildingModal] = useState<BuildingConfig | null>(null)
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
      setShowBuildingModal(null)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка улучшения здания')
    } finally {
      setPurchasing(null)
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
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка покупки здания')
    } finally {
      setPurchasing(null)
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
    <PageLayout title="Районы" showBack={true}>
      <div className="city-content-v3">
        {/* Горизонтальные вкладки районов */}
        <div className="city-tabs-v3">
          {cityData.map(district => (
            <button
              key={district.id}
              className={`city-tab-v3 ${selectedDistrictId === district.id ? 'active' : ''} ${!district.isUnlocked ? 'locked' : ''}`}
              onClick={() => setSelectedDistrictId(district.id)}
            >
              <span>{district.name}</span>
              {!district.isUnlocked && (
                <span className="city-tab-unlock-text">разблокируется с {district.requiredLevel}</span>
              )}
            </button>
          ))}
        </div>

        {/* Сетка строений */}
        <div className="city-grid-v3">
          {currentDistrict?.buildings && Array.isArray(currentDistrict.buildings) && currentDistrict.buildings.map(({ config, userBuilding }) => (
            <div 
              key={config.id} 
              className={`city-card-v3 ${!currentDistrict.isUnlocked ? 'locked' : ''}`}
              onClick={() => currentDistrict.isUnlocked && setShowBuildingModal(config)}
            >
              <div className="city-card-v3-icon">
                <img
                  src={getImageUrl(config.icon) || config.icon || '/img/building_placeholder.png'}
                  alt={config.name}
                  onError={(e) => { e.currentTarget.src = '/img/building_placeholder.png' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showBuildingModal && createPortal(
        <div 
          className="city-modal-overlay" 
          onClick={() => setShowBuildingModal(null)}
          style={{
            position: 'fixed', top: '0px', left: '0px', right: '0px', bottom: '0px',
            width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh',
            background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2147483647, padding: '12px', margin: '0',
            border: 'none', outline: 'none', touchAction: 'none', overflow: 'hidden',
            overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            className="city-modal" 
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              padding: '0', borderRadius: '16px', textAlign: 'center', maxWidth: '400px',
              width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
            }}
          >
            <div className="city-modal-header">
              <h3>{showBuildingModal.name}</h3>
              <button onClick={() => setShowBuildingModal(null)}>×</button>
            </div>
            <div className="city-modal-content">
              <div className="city-modal-image-container">
                <img 
                  src={getImageUrl(showBuildingModal.image || showBuildingModal.icon) || showBuildingModal.image || showBuildingModal.icon || '/img/building_placeholder.png'} 
                  alt={showBuildingModal.name} 
                  className="city-modal-image" 
                />
              </div>
              <div className="city-modal-stats">
                {(() => {
                  const userBuilding = currentDistrict?.buildings.find(b => b.config.id === showBuildingModal.id)?.userBuilding
                  const incomeMultiplier = showBuildingModal.incomeMultiplier || 0.07
                  
                  if (userBuilding) {
                    // Текущая прибыль из базы данных
                    const currentIncome = userBuilding.incomePerHour
                    // Прибыль после улучшения (уровень + 1)
                    const nextLevel = userBuilding.level + 1
                    const baseIncome = Number(showBuildingModal.baseIncomePerHour)
                    const multiplier = Number(incomeMultiplier)
                    
                    // Используем ту же формулу, что и на бэкенде: baseIncomePerHour * (1 + incomeMultiplier * (level - 1))
                    // Для текущего уровня: baseIncome * (1 + multiplier * (currentLevel - 1))
                    // Для следующего уровня: baseIncome * (1 + multiplier * (nextLevel - 1))
                    const nextIncome = Math.floor(baseIncome * (1 + multiplier * (nextLevel - 1)))
                    
                    return (
                      <>
                        <div className="city-modal-stat">
                          <span className="label">Прибыль была:</span>
                          <span className="value">{currentIncome.toLocaleString('ru-RU')} NAR/час</span>
                        </div>
                        <div className="city-modal-stat">
                          <span className="label">Станет:</span>
                          <span className="value">{nextIncome.toLocaleString('ru-RU')} NAR/час</span>
                        </div>
                        <div className="city-modal-stat">
                          <span className="label">Улучшение с уровня {userBuilding.level} до уровня {nextLevel}</span>
                        </div>
                      </>
                    )
                  }
                  
                  // Для нового здания показываем базовую прибыль
                  return (
                    <div className="city-modal-stat">
                      <span className="label">Прибыль:</span>
                      <span className="value">{showBuildingModal.baseIncomePerHour} NAR/час</span>
                    </div>
                  )
                })()}
              </div>
              
              <div className="city-modal-footer">
                {(() => {
                  const userBuilding = currentDistrict?.buildings.find(b => b.config.id === showBuildingModal.id)?.userBuilding
                  const upgradePrice = userBuilding 
                    ? Math.floor(showBuildingModal.basePrice * Math.pow(showBuildingModal.upgradeMultiplier || 1.15, userBuilding.level))
                    : showBuildingModal.basePrice

                  if (userBuilding) {
                    return userBuilding.level < showBuildingModal.maxLevel ? (
                      <Button variant="primary" fullWidth onClick={() => handleUpgradeBuilding(userBuilding.id)} disabled={purchasing === userBuilding.id || (user?.narCoin || 0) < upgradePrice}>
                        {purchasing === userBuilding.id ? '...' : `Улучшить (${upgradePrice} NAR)`}
                      </Button>
                    ) : (
                      <div className="city-max-lvl">МАКС. УРОВЕНЬ</div>
                    )
                  }
                  return (
                    <Button variant="primary" fullWidth onClick={() => handlePurchaseBuilding(showBuildingModal.id)} disabled={purchasing === showBuildingModal.id || (user?.narCoin || 0) < showBuildingModal.basePrice}>
                      {purchasing === showBuildingModal.id ? '...' : `Купить (${showBuildingModal.basePrice} NAR)`}
                    </Button>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
