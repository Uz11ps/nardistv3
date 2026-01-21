import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { LockIcon } from '../components/Icons'
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
  requiredClanLevel?: number
  isUnlocked: boolean
  capture?: DistrictCapture | null
  isCapturedByMyClan?: boolean
  isCapturedByOther?: boolean
  capturedBy?: string | null
}

interface ClanMember {
  role: string
}

interface ClanInfo {
  level: number
}

export default function ClanDistricts() {
  const navigate = useNavigate()
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [districts, setDistricts] = useState<DistrictData[]>([])
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null)
  const [member, setMember] = useState<ClanMember | null>(null)
  const [clanInfo, setClanInfo] = useState<ClanInfo | null>(null)

  useEffect(() => {
    console.log('ClanDistricts component mounted, clanId:', clanId)
    if (!clanId) {
      console.error('ClanDistricts: No clanId in params, redirecting to clans')
      navigate('/clans', { replace: true })
    }
  }, [clanId, navigate])

  const loadData = useCallback(async () => {
    if (!clanId) {
      console.error('ClanDistricts: No clanId provided')
      return
    }
    
    try {
      setLoading(true)
      console.log('ClanDistricts: Loading districts for clan:', clanId)
      // Загружаем данные о районах для клана, информацию о членстве и информацию о клане
      const [districtsResponse, membershipResponse, clanResponse] = await Promise.all([
        apiClient.get(`/clans/${clanId}/districts`).catch(() => ({ data: [] })),
        apiClient.get('/clans/my').catch(() => ({ data: null })),
        apiClient.get(`/clans/${clanId}`).catch(() => ({ data: null }))
      ])
      console.log('ClanDistricts: Response:', districtsResponse.data)
      const districtsData = Array.isArray(districtsResponse.data) ? districtsResponse.data : []
      setDistricts(districtsData)
      
      // Сохраняем информацию о членстве для проверки прав
      if (membershipResponse.data?.member) {
        setMember(membershipResponse.data.member)
      }
      
      // Сохраняем информацию о клане (уровень)
      if (clanResponse.data) {
        setClanInfo({ level: clanResponse.data.level || 1 })
      }
      
      if (districtsData.length > 0 && !selectedDistrictId) {
        const firstUnlocked = districtsData.find((d: DistrictData) => d.isUnlocked) || districtsData[0]
        setSelectedDistrictId(firstUnlocked.id)
      }
    } catch (error: any) {
      console.error('Failed to load clan districts:', error)
      console.error('Error response:', error.response?.data)
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
      await loadData()
    } catch (error: any) {
      console.error('Failed to capture district:', error)
    }
  }

  const handleCollectIncome = async (districtCode: string) => {
    if (!clanId) return
    
    try {
      await apiClient.post(`/clans/${clanId}/districts/${districtCode}/collect`)
      await loadData()
    } catch (error: any) {
      console.error('Failed to collect income:', error)
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
        label: district.isUnlocked ? district.name : `${district.name} (LVL ${district.requiredClanLevel || district.requiredLevel})`,
        active: selectedDistrictId === district.id,
        onClick: () => setSelectedDistrictId(district.id),
        disabled: !district.isUnlocked
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
                  <LockIcon className="lock-icon" size={18} />
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
                  {!currentDistrict.isUnlocked && currentDistrict.requiredClanLevel ? (
                    <div style={{ color: '#FF4444', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
                      🔒 Для захвата этого района требуется уровень федерации {currentDistrict.requiredClanLevel}
                      {clanInfo && (
                        <span style={{ color: '#B6B6B6', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                          Текущий уровень федерации: {clanInfo.level}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>Этот район можно захватить</div>
                      <div>Захват на 12 часов</div>
                      <div style={{ marginTop: '16px', padding: '12px', background: '#1a1a1a', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                        <div style={{ color: '#FFD700', fontWeight: 600, marginBottom: '8px' }}>
                          ⚠️ Как работает захват:
                        </div>
                        <div style={{ color: '#B6B6B6', marginBottom: '6px' }}>
                          • Лидер клана может захватить район на 12 часов
                        </div>
                        <div style={{ color: '#B6B6B6', marginBottom: '6px' }}>
                          • Кулдаун на захват: 24 часа
                        </div>
                        <div style={{ color: '#B6B6B6', marginBottom: '6px' }}>
                          • Для успешного захвата участникам клана нужно играть и выигрывать против других игроков
                        </div>
                        <div style={{ color: '#B6B6B6', marginBottom: '6px' }}>
                          • За каждую победу проигравший (если у него есть город) или случайный игрок с этим районом теряет доход, который передается клану
                        </div>
                        <div style={{ color: '#B6B6B6', marginBottom: '6px' }}>
                          • Захват на игроке действует 1 час, после чего сбрасывается
                        </div>
                        <div style={{ color: '#FFD700', marginTop: '8px', fontWeight: 600 }}>
                          ⚡ Важно: Играйте и выигрывайте, чтобы клан получал пассивный доход!
                        </div>
                      </div>
                      {member?.role !== 'leader' && (
                        <div style={{ color: '#FFD700', marginTop: '12px', fontSize: '14px' }}>
                          Только лидер может захватывать районы
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  className="city-clan-capture-btn"
                  onClick={() => handleCaptureDistrict(currentDistrict.code)}
                  disabled={member?.role !== 'leader' || !currentDistrict.isUnlocked}
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

