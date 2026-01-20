import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './City.css'

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
  capture?: DistrictCapture | null
  isCapturedByMyClan?: boolean
  isCapturedByOther?: boolean
  capturedBy?: string | null
}

export default function ClanDistricts() {
  const navigate = useNavigate()
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [districts, setDistricts] = useState<DistrictData[]>([])
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!clanId) return
    
    try {
      setLoading(true)
      // Загружаем данные о районах для клана
      const response = await apiClient.get(`/clans/${clanId}/districts`)
      const districtsData = Array.isArray(response.data) ? response.data : []
      setDistricts(districtsData)
      
      if (districtsData.length > 0 && !selectedDistrictId) {
        const firstUnlocked = districtsData.find((d: DistrictData) => d.isUnlocked) || districtsData[0]
        setSelectedDistrictId(firstUnlocked.id)
      }
    } catch (error) {
      console.error('Failed to load clan districts:', error)
      setDistricts([])
    } finally {
      setLoading(false)
    }
  }, [clanId, selectedDistrictId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCaptureDistrict = async (districtCode: string) => {
    if (!clanId) return
    
    try {
      await apiClient.post(`/clans/${clanId}/territories/capture`, { districtCode })
      alert('Район успешно захвачен!')
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка захвата района')
    }
  }

  const handleCollectIncome = async (districtCode: string) => {
    if (!clanId) return
    
    try {
      await apiClient.post(`/clans/${clanId}/districts/${districtCode}/collect`)
      alert('Доход собран!')
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка сбора дохода')
    }
  }

  const currentDistrict = districts.find(d => d.id === selectedDistrictId)

  if (loading && districts.length === 0) {
    return (
      <PageLayout title="Районы" showBack={true}>
        <div className="city-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout 
      title="Районы" 
      showBack={true}
      tabs={districts.map(district => ({
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

        {/* Отображение захватов районов */}
        {selectedDistrictId && currentDistrict && currentDistrict.isUnlocked && (
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
                  onClick={() => handleCollectIncome(currentDistrict.code)}
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
                  onClick={() => handleCaptureDistrict(currentDistrict.code)}
                >
                  Захватить район
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

