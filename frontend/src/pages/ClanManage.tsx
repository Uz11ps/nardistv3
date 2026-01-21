import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './ClanManage.css'

interface Clan {
  id: string
  name: string
  description?: string
  level: number
  memberCount: number
  maxMembers: number
  treasury: number | string
  ownedDistricts?: string[]
  leaderId: string
}

interface ClanMember {
  id: string
  userId: string
  role: string
  contribution: number | string
  user?: {
    id: string
    username: string
    nickname?: string
    level: number
  }
}

export default function ClanManage() {
  const navigate = useNavigate()
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const [clan, setClan] = useState<Clan | null>(null)
  const [member, setMember] = useState<ClanMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false)
  const [showDisbandFinalConfirm, setShowDisbandFinalConfirm] = useState(false)

  useEffect(() => {
    if (clanId) {
      loadClan()
      loadMembership()
    }
  }, [clanId, user])

  const loadClan = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/clans/${clanId}`).catch(() => ({ data: null }))
      setClan(response.data)
    } catch (error) {
      console.error('Failed to load clan:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMembership = async () => {
    try {
      const response = await apiClient.get('/clans/my').catch(() => ({ data: null }))
      if (response.data?.member) {
        setMember(response.data.member)
      }
    } catch (error) {
      console.error('Failed to load membership:', error)
    }
  }

  const isLeader = member?.role === 'leader' || clan?.leaderId === user?.id

  const handleLeave = async () => {
    if (!confirm('Вы уверены, что хотите покинуть федерацию?')) {
      return
    }

    try {
      await apiClient.post(`/clans/${clanId}/leave`)
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Failed to leave clan:', error)
    }
  }

  const handleDisband = () => {
    setShowDisbandConfirm(true)
  }

  const handleDisbandFirstConfirm = () => {
    setShowDisbandConfirm(false)
    setShowDisbandFinalConfirm(true)
  }

  const handleDisbandFinalConfirm = async () => {
    setShowDisbandFinalConfirm(false)
    try {
      await apiClient.post(`/clans/${clanId}/disband`)
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Failed to disband clan:', error)
    }
  }

  const getDistrictName = (district: string) => {
    const districtNames: { [key: string]: string } = {
      district_1: 'Район 1',
      district_2: 'Район 2',
      district_3: 'Район 3',
      district_4: 'Район 4',
      district_5: 'Район 5',
      district_6: 'Район 6',
      district_7: 'Район 7',
    }
    return districtNames[district] || district
  }

  if (loading) {
    return (
      <PageLayout title="Федерация" showBack={true}>
        <div className="clan-manage-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  if (!clan) {
    return (
      <PageLayout title="Федерация" showBack={true}>
        <div className="clan-manage-empty">Федерация не найдена</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="" showBack={true}>
      <div className="clan-manage-wrapper">
        {/* Основной контент */}
        <div className="clan-manage-content">
          {/* Эмблема клана */}
          <div className="clan-manage-emblem">
            <img 
              src="/img/clan-emblem.png" 
              alt="Clan" 
              className="clan-manage-emblem-icon"
              onError={(e) => {
                e.currentTarget.src = "https://www.figma.com/api/mcp/asset/87bd5be0-21be-489a-bcf8-8697846680fa"
              }} 
            />
          </div>

          {/* Название клана */}
          <div className="clan-manage-name">{clan.name}</div>

          {/* Информация о клане */}
          <div className="clan-manage-info">
            Уровень {clan.level} · {clan.memberCount} участника{clan.ownedDistricts && clan.ownedDistricts.length > 0 && ` · Владеет, ${getDistrictName(clan.ownedDistricts[0])}`}
          </div>

          {/* Кнопки управления */}
          <div className="clan-manage-buttons">
            <button className="clan-manage-button" onClick={() => navigate(`/clans/${clanId}/treasury`)}>
              Казна
            </button>
            <button className="clan-manage-button" onClick={() => navigate(`/clans/${clanId}/upgrades`)}>
              Улучшить клан
            </button>
            <button className="clan-manage-button" onClick={() => navigate(`/clans/${clanId}/members`)}>
              Участники
            </button>
            <button className="clan-manage-button" onClick={() => navigate(`/clans/${clanId}/districts`)}>
              Районы
            </button>
            {isLeader ? (
              <button className="clan-manage-button clan-manage-button-disband" onClick={handleDisband}>
                Распустить федерацию
              </button>
            ) : (
              <button className="clan-manage-button clan-manage-button-leave" onClick={handleLeave}>
                Покинуть федерацию
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно первого подтверждения распуска федерации */}
      {showDisbandConfirm && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: '0px',
            left: '0px',
            right: '0px',
            bottom: '0px',
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '20px',
            margin: '0',
            touchAction: 'none',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
          }}
          onClick={() => setShowDisbandConfirm(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#FFF', fontSize: '20px', fontWeight: '600' }}>Подтверждение</h2>
              <button 
                onClick={() => setShowDisbandConfirm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#B6B6B6',
                  fontSize: '32px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >×</button>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: '#FFF', fontSize: '16px', lineHeight: '1.5', margin: 0 }}>
                Вы уверены, что хотите распустить федерацию? Все участники потеряют федерацию, и федерация будет удалена навсегда.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowDisbandConfirm(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFF',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                Отмена
              </button>
              <button 
                onClick={handleDisbandFirstConfirm}
                style={{
                  background: 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)',
                  border: '1px solid #C93C3D',
                  color: '#FFF',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                Продолжить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модальное окно финального подтверждения распуска федерации */}
      {showDisbandFinalConfirm && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: '0px',
            left: '0px',
            right: '0px',
            bottom: '0px',
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '20px',
            margin: '0',
            touchAction: 'none',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
          }}
          onClick={() => setShowDisbandFinalConfirm(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#FF4444', fontSize: '20px', fontWeight: '600' }}>Внимание!</h2>
              <button 
                onClick={() => setShowDisbandFinalConfirm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#B6B6B6',
                  fontSize: '32px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >×</button>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: '#FFF', fontSize: '16px', lineHeight: '1.5', margin: 0, fontWeight: '600' }}>
                Это действие необратимо! Вы действительно хотите распустить федерацию?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowDisbandFinalConfirm(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFF',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                Отмена
              </button>
              <button 
                onClick={handleDisbandFinalConfirm}
                style={{
                  background: 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)',
                  border: '1px solid #C93C3D',
                  color: '#FFF',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                Распустить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
