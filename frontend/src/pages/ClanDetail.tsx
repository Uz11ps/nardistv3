import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
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
      const response = await apiClient.get(`/clans/${clanId}`)
      setClan(response.data)
    } catch (error) {
      console.error('Failed to load clan:', error)
      navigate('/clans/search')
    } finally {
      setLoading(false)
    }
  }

  const checkMembership = async () => {
    try {
      const response = await apiClient.get('/clans/my')
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
      <div className="app-container">
        <PageHeader title="Клан" />
        <div className="clan-detail-loading">Загрузка...</div>
        <BottomNav />
      </div>
    )
  }

  if (!clan) {
    return null
  }

  const districtText = clan.ownedDistricts && clan.ownedDistricts.length > 0
    ? `Владеет, ${getDistrictName(clan.ownedDistricts[0])}`
    : 'Нет районов'

  const memberText = clan.memberCount === 1 
    ? 'участник' 
    : clan.memberCount < 5 
      ? 'участника' 
      : 'участников'

  return (
    <div className="app-container">
      <PageHeader title="Клан" />
      
      <div className="clan-detail-content">
        {/* Эмблема клана */}
        <div className="clan-detail-emblem">
          <Icon name="shield" size={80} style={{ color: '#ffd700' }} />
        </div>

        {/* Название клана */}
        <div className="clan-detail-name">{clan.name}</div>

        {/* Информация о клане */}
        <div className="clan-detail-info">
          Уровень {clan.level} - {clan.memberCount} {memberText} - {districtText}
        </div>

        {clan.description && (
          <div className="clan-detail-description">{clan.description}</div>
        )}

        {/* Кнопка действия */}
        {!isMember && (
          <div className="clan-detail-action">
            <Button
              variant="primary"
              className="clan-detail-join-btn"
              onClick={handleJoin}
            >
              Вступить в клан
            </Button>
          </div>
        )}

        {isMember && (
          <div className="clan-detail-action">
            <Button
              variant="primary"
              className="clan-detail-join-btn"
              onClick={() => navigate(`/clans/${clanId}/manage`)}
            >
              Управление кланом
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
