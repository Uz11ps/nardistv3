import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './ClanDetail.css'

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

export default function ClanDetail() {
  const navigate = useNavigate()
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const [clan, setClan] = useState<Clan | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clanId) {
      loadClan()
      checkMembership()
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
          memberCount: 42,
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

  const checkMembership = async () => {
    try {
      const response = await apiClient.get('/clans/my').catch(() => ({ data: null }))
      if (response.data?.clan?.id === clanId) {
        setIsMember(true)
      }
    } catch (error) {
      // Пользователь не в клане
    }
  }

  const handleJoin = async () => {
    try {
      await apiClient.post(`/clans/${clanId}/join`)
      alert('Вы успешно вступили в клан!')
      navigate(`/clans/${clanId}/manage`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при вступлении в клан')
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
        <div className="clan-detail-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  if (!clan) {
    return (
      <PageLayout title="Клан" showBack={true}>
        <div className="clan-detail-empty">Клан не найден</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="" showBack={true}>
      <div className="clan-detail-content">
        {/* Эмблема клана */}
        <div className="clan-detail-emblem">
          <img src="/img/кланы.png" alt="Clan" className="clan-detail-emblem-icon" />
        </div>

        {/* Название клана */}
        <div className="clan-detail-name">{clan.name}</div>

        {/* Информация о клане */}
        <div className="clan-detail-info">
          Уровень {clan.level} · {clan.memberCount} участника{clan.ownedDistricts && clan.ownedDistricts.length > 0 && ` · Владеет, ${getDistrictName(clan.ownedDistricts[0])}`}
        </div>

        {/* Кнопка вступления */}
        {!isMember && (
          <button className="clan-detail-join-button" onClick={handleJoin}>
            Вступить в клан
          </button>
        )}
      </div>
    </PageLayout>
  )
}
