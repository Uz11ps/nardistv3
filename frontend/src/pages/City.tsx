import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'

interface District {
  id: string
  name: string
  owner: string | null
  status: 'free' | 'stable' | 'contested'
  incomePerDay: number
  level: number
}

interface Building {
  id: string
  type: string
  level: number
  incomePerHour: number
  accumulatedIncome: number
  lastCollectedAt: string | null
}

export default function City() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [districts, setDistricts] = useState<District[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if ((user?.level || 0) < 20) {
      // Город недоступен до 20 уровня
      return
    }
    loadCityData()
  }, [user])

  const loadCityData = async () => {
    try {
      const [districtsRes, buildingsRes] = await Promise.all([
        apiClient.get('/city/districts'),
        apiClient.get('/city/buildings'),
      ])
      setDistricts(districtsRes.data || [])
      setBuildings(buildingsRes.data || [])
    } catch (error) {
      console.error('Failed to load city data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCollectIncome = async (buildingId: string) => {
    try {
      await apiClient.post(`/city/buildings/${buildingId}/collect`)
      loadCityData()
    } catch (error) {
      console.error('Failed to collect income:', error)
    }
  }

  const handleCaptureDistrict = async (districtId: string) => {
    try {
      await apiClient.post(`/city/districts/${districtId}/capture`)
      loadCityData()
    } catch (error) {
      console.error('Failed to capture district:', error)
    }
  }

  if ((user?.level || 0) < 20) {
    return (
      <div className="app-container">
        <PageHeader title="Город" />
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏙️</div>
          <div className="card-title" style={{ marginBottom: '12px' }}>
            Город недоступен
          </div>
          <div className="card-subtitle" style={{ marginBottom: '32px' }}>
            Город и районы открываются с 20 уровня. Здесь ты можешь строить предприятия и
            управлять территорией клана
          </div>
          <Button onClick={() => navigate('/')}>Играть</Button>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-container">
        <PageHeader title="Город" />
        <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка...</div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="app-container">
      <PageHeader title="Районы города" />
      
      <div style={{ padding: '20px' }}>
        {/* Районы */}
        <div style={{ marginBottom: '24px' }}>
          {districts.map((district) => (
            <Card key={district.id} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '32px' }}>🛡️</div>
                <div style={{ flex: 1 }}>
                  <div className="card-title">{district.name}</div>
                  <div className="card-subtitle">
                    {district.owner
                      ? `Владелец: ${district.owner}`
                      : 'Свободен'}
                    {district.status === 'stable' && ' • стабильно'}
                    {district.incomePerDay > 0 && ` • ${district.incomePerDay} NAR/день`}
                  </div>
                </div>
                {district.status === 'free' ? (
                  <Button onClick={() => handleCaptureDistrict(district.id)}>
                    Захватить
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => {}}>
                    Подробнее
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Предприятия */}
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
            Мои предприятия
          </div>
          {buildings.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
                У вас пока нет предприятий
              </div>
            </Card>
          ) : (
            buildings.map((building) => (
              <Card key={building.id} style={{ marginBottom: '12px' }}>
                <div className="card-title">{building.type}</div>
                <div className="card-subtitle">Уровень {building.level}</div>
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="gold">
                      Накоплено: {building.accumulatedIncome} NAR
                    </span>
                    <span style={{ color: '#aaaaaa' }}>
                      {building.incomePerHour} NAR/час
                    </span>
                  </div>
                  <Button
                    fullWidth
                    onClick={() => handleCollectIncome(building.id)}
                    disabled={Number(building.accumulatedIncome) === 0}
                  >
                    Забрать доход
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
