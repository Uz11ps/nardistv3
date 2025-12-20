import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'
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
  const [members, setMembers] = useState<ClanMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<ClanMember[]>([])
  const [searchQuery, setSearchQuery] = useState('')
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
      const response = await apiClient.get(`/clans/${clanId}/members`)
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
    return `+${amount.toLocaleString()} NAR`
  }

  const getRoleName = (role: string) => {
    const roleNames: { [key: string]: string } = {
      leader: 'Глава клана',
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
    
    const lastSeen = new Date(member.lastSeenAt)
    const now = new Date()
    const diff = now.getTime() - lastSeen.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) {
      return `${minutes} мин. назад`
    }
    if (hours < 24) {
      return `${hours}ч назад`
    }
    if (days === 1) {
      return 'Вчера'
    }
    if (days < 7) {
      return `${days} дн. назад`
    }
    return lastSeen.toLocaleDateString('ru-RU')
  }

  if (loading) {
    return (
      <div className="app-container">
        <PageHeader title="Участники" />
        <div className="clan-members-loading">Загрузка...</div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="app-container">
      <PageHeader title="Участники" />
      
      <div className="clan-members-content">
        <div className="clan-members-count">
          Всего участников: {members.length}
        </div>

        {/* Поисковая строка */}
        <div className="clan-members-search-container">
          <input
            type="text"
            className="clan-members-search-input"
            placeholder="Поиск игрока"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Список участников */}
        {filteredMembers.length === 0 ? (
          <Card>
            <div className="clan-members-empty">
              {searchQuery ? 'Участники не найдены' : 'Нет участников'}
            </div>
          </Card>
        ) : (
          <div className="clan-members-list">
            {filteredMembers.map((member) => {
              const userName = member.user.nickname || member.user.username || 'Без имени'
              const isOnline = member.isOnline

              return (
                <Card key={member.id} className="clan-members-item">
                  <div className="clan-members-item-content">
                    {/* Аватар */}
                    <div className="clan-members-avatar-container">
                      {member.user.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={userName}
                          className="clan-members-avatar"
                        />
                      ) : (
                        <div className="clan-members-avatar-placeholder">
                          <Icon name="user" size={24} />
                        </div>
                      )}
                      {isOnline && <div className="clan-members-online-indicator" />}
                    </div>

                    {/* Информация */}
                    <div className="clan-members-info">
                      <div className="clan-members-name">{userName}</div>
                      <div className="clan-members-role">{getRoleName(member.role)}</div>
                      <div className="clan-members-stats">
                        Вклад {formatContribution(member.contribution)} | Уровень {member.user.level}
                      </div>
                    </div>

                    {/* Статус */}
                    <div className="clan-members-status">
                      {getStatusText(member)}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
