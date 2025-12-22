import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './City.css'

interface District {
  id: string
  name: string
  owner: string | null
  status: 'free' | 'stable' | 'vulnerable'
  incomePerDay: number
  level: number
  vulnerabilityPercent?: number
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

  useEffect(() => {
    if ((user?.level || 0) >= 20) {
      loadCityData()
    } else {
      setLoading(false)
    }
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

  const handleCaptureDistrict = async (districtId: string) => {
    try {
      await apiClient.post(`/city/districts/${districtId}/capture`)
      loadCityData()
      alert('Район успешно захвачен!')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при захвате района')
    }
  }

  const handleDistrictDetails = (districtId: string) => {
    // TODO: Navigate to district details page
    console.log('District details:', districtId)
  }

  // Если уровень меньше 20
  if ((user?.level || 0) < 20) {
    return (
      <PageLayout title="Город недоступен" showBack={true}>
        <div className="city-unavailable">
          <img src="/img/город.png" alt="City" className="city-unavailable-icon" />
          <h2 className="city-unavailable-title">Город недоступен</h2>
          <p className="city-unavailable-text">
            Город и районы открываются с 20 уровня.
            <br />
            Здесь ты можешь строить предприятия и управлять территорией клана
          </p>
          <button className="city-play-button" onClick={() => navigate('/')}>
            Играть
          </button>
        </div>
      </PageLayout>
    )
  }

  if (loading) {
    return (
      <PageLayout title="Районы города" showBack={true}>
        <div className="city-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  // Если пользователь не в клане
  if (!userClan?.clan) {
    return (
      <PageLayout title="Город недоступен" showBack={true}>
        <div className="city-unavailable">
          <img src="/img/город.png" alt="City" className="city-unavailable-icon" />
          <h2 className="city-unavailable-title">Город недоступен</h2>
          <p className="city-unavailable-text">
            Вступи в клан, чтобы открыть доступ к районам
          </p>
          <button className="city-find-clan-button" onClick={() => navigate('/clans/search')}>
            Найти клан
          </button>
        </div>
      </PageLayout>
    )
  }

  // Список районов
  return (
    <PageLayout title="Районы города" showBack={true}>
      <div className="city-districts-list">
        {districts.map((district) => (
          <div key={district.id} className="city-district-card">
            <img src="/img/кланы.png" alt="District" className="city-district-icon" />
            <div className="city-district-info">
              <div className="city-district-name">{district.name}</div>
              <div className="city-district-owner">
                Владелец: {district.owner || '-'}
              </div>
              <div className="city-district-status">
                <span
                  className={`city-district-status-dot ${
                    district.status === 'stable'
                      ? 'stable'
                      : district.status === 'vulnerable'
                      ? 'vulnerable'
                      : 'free'
                  }`}
                />
                <span className="city-district-status-text">
                  {district.status === 'stable'
                    ? 'стабильно'
                    : district.status === 'vulnerable'
                    ? `${district.vulnerabilityPercent || 0}% уязвим`
                    : 'свободен'}
                </span>
              </div>
            </div>
            <div className="city-district-actions">
              {district.status === 'free' ? (
                <button
                  className="city-district-button city-district-button-capture"
                  onClick={() => handleCaptureDistrict(district.id)}
                >
                  Захватить
                </button>
              ) : district.status === 'stable' ? (
                <div className="city-district-income">
                  {district.incomePerDay.toLocaleString()} NAR / день
                </div>
              ) : (
                <button
                  className="city-district-button city-district-button-details"
                  onClick={() => handleDistrictDetails(district.id)}
                >
                  Подробнее
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}
