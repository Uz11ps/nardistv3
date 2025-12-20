import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
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
      <div className="app-container page-transition">
        <PageHeader title="Город недоступен" />
        <div className="city-unavailable">
          <Icon name="city" className="city-unavailable-icon" />
          <div className="city-unavailable-title">Город недоступен</div>
          <div className="city-unavailable-text">
            Город и районы открываются с 20 уровня. Здесь ты можешь строить предприятия и управлять территорией клана
          </div>
          <Button onClick={() => navigate('/')} fullWidth>
            Играть
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-container page-transition">
        <PageHeader title="Районы города" />
        <div className="city-districts-list">
          <Card>
            <div style={{ textAlign: 'center', padding: '20px', color: '#aaaaaa' }}>
              Загрузка...
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Если пользователь не в клане
  if (!userClan?.clan) {
    return (
      <div className="app-container page-transition">
        <PageHeader title="Город недоступен" />
        <div className="city-unavailable">
          <Icon name="city" className="city-unavailable-icon" />
          <div className="city-unavailable-title">Город недоступен</div>
          <div className="city-unavailable-text">
            Вступи в клан, чтобы открыть доступ к районам
          </div>
          <Button onClick={() => navigate('/clans/search')} fullWidth>
            Найти клан
          </Button>
        </div>
      </div>
    )
  }

  // Список районов
  return (
    <div className="app-container page-transition">
      <PageHeader title="Районы города" />
      
      <div className="city-districts-list">
        {districts.map((district) => (
          <Card key={district.id} className="district-card">
            <div className="district-icon">
              <Icon name="shield" size={32} />
            </div>
            <div className="district-info">
              <div className="district-name">{district.name}</div>
              <div className="district-details">
                Владелец: {district.owner || '-'}
              </div>
              <div className="district-status">
                <span
                  className={`district-status-dot ${
                    district.status === 'stable'
                      ? 'stable'
                      : district.status === 'vulnerable'
                      ? 'vulnerable'
                      : 'free'
                  }`}
                />
                <span className="district-status-text">
                  {district.status === 'stable'
                    ? 'стабильно'
                    : district.status === 'vulnerable'
                    ? `${district.vulnerabilityPercent || 0}% уязвим`
                    : 'свободен'}
                </span>
              </div>
              {district.incomePerDay > 0 && (
                <div className="district-income gold">
                  {district.incomePerDay.toLocaleString()} NAR/день
                </div>
              )}
            </div>
            <div className="district-actions">
              {district.status === 'free' ? (
                <button
                  className="district-action-btn capture"
                  onClick={() => handleCaptureDistrict(district.id)}
                >
                  Захватить
                </button>
              ) : (
                <button
                  className="district-action-btn details"
                  onClick={() => handleDistrictDetails(district.id)}
                >
                  Подробнее
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
