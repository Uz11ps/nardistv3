import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
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
      const response = await apiClient.get(`/clans/${clanId}`)
      setClan(response.data)
    } catch (error) {
      console.error('Failed to load clan:', error)
      navigate('/clans')
    } finally {
      setLoading(false)
    }
  }

  const loadMembership = async () => {
    try {
      const response = await apiClient.get('/clans/my')
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

  const handleNavigate = (path: string) => {
    navigate(`/clans/${clanId}${path}`)
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
        <PageHeader title="Управление кланом" />
        <div className="clan-manage-loading">Загрузка...</div>
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

  const isLeader = user?.id === clan.leaderId

  return (
    <div className="app-container">
      <PageHeader title="Управление кланом" />
      
      <div className="clan-manage-content">
        {/* Эмблема клана */}
        <div className="clan-manage-emblem">
          <Icon name="shield" size={80} style={{ color: '#ffd700' }} />
        </div>

        {/* Название клана */}
        <div className="clan-manage-name">{clan.name}</div>

        {/* Информация о клане */}
        <div className="clan-manage-info">
          Уровень {clan.level} - {clan.memberCount} {memberText} - {districtText}
        </div>

        {/* Кнопки управления */}
        <div className="clan-manage-actions">
          <Button
            variant="secondary"
            className="clan-manage-action-btn"
            onClick={() => handleNavigate('/treasury')}
          >
            Казна
          </Button>
          {isLeader && (
            <Button
              variant="secondary"
              className="clan-manage-action-btn"
              onClick={() => handleNavigate('/upgrade')}
            >
              Улучшить клан
            </Button>
          )}
          <Button
            variant="secondary"
            className="clan-manage-action-btn"
            onClick={() => handleNavigate('/members')}
          >
            Участники
          </Button>
          <Button
            variant="secondary"
            className="clan-manage-action-btn"
            onClick={() => handleNavigate('/districts')}
          >
            Районы
          </Button>
        </div>

        {/* Кнопка выхода */}
        <div className="clan-manage-leave">
          <Button
            variant="primary"
            className="clan-manage-leave-btn"
            onClick={handleLeave}
          >
            Покинуть клан
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
