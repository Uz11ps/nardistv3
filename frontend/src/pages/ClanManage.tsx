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
      
      // Мок-данные для разработки
      if (!response.data) {
        setClan({
          id: clanId || '1',
          name: 'Нардисты Юга',
          level: 3,
          memberCount: 43,
          maxMembers: 50,
          treasury: 12540,
          ownedDistricts: ['district_2'],
          leaderId: '1',
        })
      }
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

  const handleLeave = async () => {
    if (!confirm('Вы уверены, что хотите покинуть клан?')) {
      return
    }

    try {
      await apiClient.post(`/clans/${clanId}/leave`)
      alert('Вы покинули клан')
      navigate('/clans')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при выходе из клана')
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
      <PageLayout title="Клан" showBack={true}>
        <div className="clan-manage-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  if (!clan) {
    return (
      <PageLayout title="Клан" showBack={true}>
        <div className="clan-manage-empty">Клан не найден</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="" showBack={true}>
      <div className="clan-manage-content">
        {/* Эмблема клана */}
        <div className="clan-manage-emblem">
          <img src="/img/кланы.png" alt="Clan" className="clan-manage-emblem-icon" />
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
          <button className="clan-manage-button" onClick={() => navigate('/city')}>
            Районы
          </button>
          <button className="clan-manage-button clan-manage-button-leave" onClick={handleLeave}>
            Покинуть клан
          </button>
        </div>
      </div>
    </PageLayout>
  )
}
