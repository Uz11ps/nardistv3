import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './City.css'

interface AvailableBuilding {
  type: string
  name: string
  price: number
  incomePerHour: number
  maxAccumulation: number
}

interface UserBuilding {
  id: string
  type: string
  level: number
  incomePerHour: number
  accumulatedIncome: number
  maxAccumulation: number
  capturedByClanId: string | null
  capturedAt: Date | null
}

interface District {
  id: string
  name: string
  userBuilding: UserBuilding | null
  availableBuildings: AvailableBuilding[]
  capturedCount: number
}

interface UserClan {
  clan: {
    id: string
    name: string
  } | null
  member: any | null
}

export default function City() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [districts, setDistricts] = useState<District[]>([])
  const [userClan, setUserClan] = useState<UserClan | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [captureableBuildings, setCaptureableBuildings] = useState<any[]>([])

  useEffect(() => {
    loadCityData()
  }, [user])

  const loadCityData = async () => {
    try {
      setLoading(true)
      const [districtsRes, clanRes] = await Promise.all([
        apiClient.get('/city/districts').catch(() => ({ data: [] })),
        apiClient.get('/clans/my').catch(() => ({ data: { clan: null, member: null } })),
      ])
      setDistricts(districtsRes.data || [])
      setUserClan(clanRes.data || { clan: null, member: null })
    } catch (error) {
      console.error('Failed to load city data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseBuilding = async (districtId: string, type: string) => {
    try {
      await apiClient.post('/city/buildings/purchase', { district: districtId, type })
      alert('Предприятие успешно куплено!')
      loadCityData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке предприятия')
    }
  }

  const handleCollectIncome = async (buildingId: string) => {
    try {
      const response = await apiClient.post(`/city/buildings/${buildingId}/collect`)
      alert(`Собрано: ${response.data.income} NAR`)
      loadCityData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при сборе дохода')
    }
  }

  const handleUpgradeBuilding = async (buildingId: string) => {
    try {
      await apiClient.post(`/city/upgrade/${buildingId}`)
      alert('Предприятие улучшено!')
      loadCityData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при улучшении предприятия')
    }
  }

  const handleCaptureTerritory = async (buildingId: string) => {
    if (!userClan?.clan) {
      alert('Вы должны состоять в клане для захвата территорий')
      return
    }

    if (!userClan.member || (userClan.member.role !== 'leader' && userClan.member.role !== 'officer')) {
      alert('Только лидер и офицеры могут захватывать территории')
      return
    }

    if (!confirm('Захватить эту территорию? Клан получит 10% от дохода игрока.')) {
      return
    }

    try {
      await apiClient.post(`/city/buildings/${buildingId}/capture`)
      alert('Территория успешно захвачена!')
      loadCityData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при захвате территории')
    }
  }

  const getBuildingTypeName = (type: string): string => {
    const names: Record<string, string> = {
      club: 'Клуб',
      workshop: 'Мастерская',
      factory: 'Фабрика',
      school: 'Школа',
      market: 'Рынок',
      academy: 'Академия',
      temple: 'Храм',
    }
    return names[type] || type
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
      <div className="city-container">
        {userClan?.clan && (
          <div className="city-clan-info">
            <div>Ваш клан: {userClan.clan.name}</div>
            <small>Клан может захватить только одну территорию раз в 3 дня</small>
          </div>
        )}
        <div className="city-districts-list">
          {districts.map((district) => (
            <div key={district.id} className="city-district-card">
              <div className="city-district-header">
                <h3 className="city-district-name">{district.name}</h3>
                {district.capturedCount > 0 && (
                  <span className="city-district-captured">
                    Захвачено: {district.capturedCount}
                  </span>
                )}
              </div>

              {district.userBuilding ? (
                <div className="city-user-building">
                  <div className="city-building-info">
                    <div className="city-building-name">
                      {getBuildingTypeName(district.userBuilding.type)} (Ур. {district.userBuilding.level})
                    </div>
                    {district.userBuilding.capturedByClanId && (
                      <div className="city-building-captured">
                        ⚠️ Захвачено кланом
                        <br />
                        <small>Вы получаете 50% дохода</small>
                      </div>
                    )}
                    <div className="city-building-stats">
                      <div>Доход: {district.userBuilding.incomePerHour} NAR/час</div>
                      <div>Накоплено: {district.userBuilding.accumulatedIncome.toLocaleString()} / {district.userBuilding.maxAccumulation.toLocaleString()} NAR</div>
                    </div>
                  </div>
                  <div className="city-building-actions">
                    <button
                      className="city-button city-button-collect"
                      onClick={() => handleCollectIncome(district.userBuilding!.id)}
                      disabled={district.userBuilding.accumulatedIncome === 0}
                    >
                      Собрать доход
                    </button>
                    <button
                      className="city-button city-button-upgrade"
                      onClick={() => handleUpgradeBuilding(district.userBuilding!.id)}
                    >
                      Улучшить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="city-available-buildings">
                  <div className="city-buildings-title">Доступные предприятия:</div>
                  {district.availableBuildings.length > 0 ? (
                    district.availableBuildings.map((building, idx) => (
                      <div key={idx} className="city-building-option">
                        <div className="city-building-option-info">
                          <div className="city-building-option-name">{building.name}</div>
                          <div className="city-building-option-stats">
                            <div>Доход: {building.incomePerHour} NAR/час</div>
                            <div>Макс. накопление: {building.maxAccumulation.toLocaleString()} NAR</div>
                          </div>
                        </div>
                        <button
                          className="city-button city-button-purchase"
                          onClick={() => handlePurchaseBuilding(district.id, building.type)}
                          disabled={Number(user?.narCoin || 0) < building.price}
                        >
                          Купить за {building.price.toLocaleString()} NAR
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="city-no-buildings">Нет доступных предприятий</div>
                  )}
                </div>
              )}

              {/* Показываем другие предприятия в районе для захвата (только для кланов) */}
              {userClan?.clan && (
                <div className="city-capture-section">
                  <button
                    className="city-button city-button-toggle"
                    onClick={async () => {
                      if (selectedDistrict === district.id) {
                        setSelectedDistrict(null)
                        setCaptureableBuildings([])
                      } else {
                        setSelectedDistrict(district.id)
                        try {
                          const response = await apiClient.get(`/city/captureable?district=${district.id}`)
                          setCaptureableBuildings(response.data || [])
                        } catch (error) {
                          console.error('Failed to load captureable buildings:', error)
                          setCaptureableBuildings([])
                        }
                      }
                    }}
                  >
                    {selectedDistrict === district.id ? 'Скрыть' : 'Показать'} предприятия для захвата
                  </button>
                  {selectedDistrict === district.id && captureableBuildings.length > 0 && (
                    <div className="city-captureable-list">
                      {captureableBuildings.map((building) => (
                        <div key={building.id} className="city-captureable-item">
                          <div className="city-captureable-info">
                            <div>{getBuildingTypeName(building.type)} (Ур. {building.level})</div>
                            <div>Доход: {building.incomePerHour} NAR/час</div>
                            {building.capturedByClanId && (
                              <small>Уже захвачено другим кланом</small>
                            )}
                          </div>
                          <button
                            className="city-button city-button-capture"
                            onClick={() => handleCaptureTerritory(building.id)}
                            disabled={!!building.capturedByClanId}
                          >
                            Захватить
                          </button>
                        </div>
                      ))}
                      {captureableBuildings.length === 0 && (
                        <div className="city-no-captureable">Нет доступных предприятий для захвата</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
