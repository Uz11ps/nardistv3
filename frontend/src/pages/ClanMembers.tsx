import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
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
      const response = await apiClient.get(`/clans/${clanId}/members`).catch(() => ({ data: [] }))
      setMembers(response.data || [])
      setFilteredMembers(response.data || [])
      
      // Мок-данные для разработки
      if (!response.data || response.data.length === 0) {
        const mockMembers: ClanMember[] = [
          {
            id: '1',
            role: 'leader',
            contribution: 5200,
            isOnline: true,
            user: { id: '1', username: 'Алексей', nickname: 'Алексей', level: 23 },
          },
          {
            id: '2',
            role: 'officer',
            contribution: 3200,
            isOnline: false,
            lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            user: { id: '2', username: 'Shatov', nickname: 'Shatov', level: 21 },
          },
          {
            id: '3',
            role: 'member',
            contribution: 5200,
            isOnline: true,
            user: { id: '3', username: 'bot', nickname: 'bot', level: 20 },
          },
          {
            id: '4',
            role: 'member',
            contribution: 1200,
            isOnline: false,
            lastSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            user: { id: '4', username: 'uz1ps', nickname: 'uz1ps', level: 27 },
          },
        ]
        setMembers(mockMembers)
        setFilteredMembers(mockMembers)
      }
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
      <PageLayout title="Участники" showBack={true}>
        <div className="clan-members-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Участники" subtitle={`Всего участников: ${members.length}`} showBack={true}>
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
        <div className="clan-members-empty">
          {searchQuery ? 'Участники не найдены' : 'Нет участников'}
        </div>
      ) : (
        <div className="clan-members-list">
          {filteredMembers.map((member) => {
            const userName = member.user.nickname || member.user.username || 'Без имени'
            const isOnline = member.isOnline

            return (
              <div key={member.id} className="clan-members-item">
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
                        <img src="/img/челувек.png" alt="User" className="clan-members-avatar-icon" />
                      </div>
                    )}
                    {isOnline && <div className="clan-members-online-indicator" />}
                  </div>

                  {/* Информация */}
                  <div className="clan-members-info">
                    <div className="clan-members-name">{userName}</div>
                    <div className="clan-members-role">{getRoleName(member.role)}</div>
                    <div className="clan-members-stats">
                      Вклад +{formatContribution(member.contribution)} | Уровень {member.user.level}
                    </div>
                  </div>

                  {/* Статус */}
                  <div className="clan-members-status">
                    {getStatusText(member)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
