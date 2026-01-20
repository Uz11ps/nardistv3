import { useState, useEffect } from 'react'
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
      alert('Вы покинули федерацию')
      navigate('/', { replace: true })
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при выходе из федерации')
    }
  }

  const handleDisband = async () => {
    if (!confirm('Вы уверены, что хотите распустить федерацию? Все участники потеряют федерацию, и федерация будет удалена навсегда.')) {
      return
    }

    if (!confirm('Это действие необратимо! Вы действительно хотите распустить федерацию?')) {
      return
    }

    try {
      await apiClient.post(`/clans/${clanId}/disband`)
      alert('Федерация распущена')
      navigate('/', { replace: true })
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при распускании федерации')
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
    </PageLayout>
  )
}
