import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import PlayerProfileModal from '../components/PlayerProfileModal'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatRelativeTime } from '../utils/dateUtils'
import './ClanMembers.css'

interface ClanMember {
  id: string
  role: string
  contribution: number | string
  isOnline: boolean
  lastSeenAt?: string
  user: {
    id: string
    username: string
    nickname?: string
    level: number
    avatarUrl?: string
  }
}

export default function ClanMembers() {
  const { clanId } = useParams<{ clanId: string }>()
  const { user } = useAuthStore()
  const timezone = user?.timezone || 'Europe/Moscow'
  const [members, setMembers] = useState<ClanMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<ClanMember[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clanId) {
      loadMembers()
    }
  }, [clanId])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMembers(members)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredMembers(
        members.filter((member) => {
          const name = (member.user.nickname || member.user.username || '').toLowerCase()
          return name.includes(query)
        })
      )
    }
  }, [searchQuery, members])

  const loadMembers = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/clans/${clanId}/members`).catch(() => ({ data: [] }))
      setMembers(response.data || [])
      setFilteredMembers(response.data || [])
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatContribution = (contribution: number | string) => {
    const amount = typeof contribution === 'string' ? parseInt(contribution) : contribution
    return `${amount.toLocaleString()} NAR`
  }

  const getRoleName = (role: string) => {
    const roleNames: { [key: string]: string } = {
      leader: 'Глава федерации',
      officer: 'Офицер',
      member: 'Участник',
    }
    return roleNames[role.toLowerCase()] || role
  }

  const getStatusText = (member: ClanMember) => {
    if (member.isOnline) {
      return 'Онлайн'
    }
    if (!member.lastSeenAt) {
      return 'Никогда'
    }
    
    return formatRelativeTime(member.lastSeenAt, timezone)
  }

  if (loading) {
    return (
      <PageLayout title="Участники" showBack={true}>
        <div className="clan-members-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Участники" subtitle={`Всего участников: ${members.length}`} showBack={true}>
      <div className="clan-members-content">
        <div className="clan-members-search-container">
          <input
            type="text"
            className="clan-members-search-input"
            placeholder="Поиск игрока"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredMembers.length === 0 ? (
          <div className="clan-members-empty">
            {searchQuery ? 'Участники не найдены' : 'Нет участников'}
          </div>
        ) : (
          <div className="clan-members-grid">
            {filteredMembers.map((member) => {
              const userName = member.user.nickname || member.user.username || 'Без имени'
              const roleName = member.role.toLowerCase() === 'leader' ? 'Лидер' : 
                               member.role.toLowerCase() === 'officer' ? 'Офицер' : 'Участник'

              return (
                <div 
                  key={member.id} 
                  className="clan-members-card"
                  onClick={() => {
                    setSelectedPlayer(member.user)
                    setShowPlayerModal(true)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="clan-members-card-avatar">
                    {member.user.avatarUrl ? (
                      <img src={member.user.avatarUrl} alt={userName} />
                    ) : (
                      <div className="clan-members-avatar-placeholder">
                        <img src="/img/челувек.png" alt="User" />
                      </div>
                    )}
                  </div>
                  <div className="clan-members-card-name">{userName}</div>
                  <div className="clan-members-card-role">{roleName}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <PlayerProfileModal
        isOpen={showPlayerModal}
        player={selectedPlayer}
        onClose={() => {
          setShowPlayerModal(false)
          setSelectedPlayer(null)
        }}
      />
    </PageLayout>
  )
}
