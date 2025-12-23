import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './ClanSearch.css'

interface Clan {
  id: string
  name: string
  description?: string
  level: number
  memberCount: number
  maxMembers: number
  treasury: number | string
  ownedDistricts?: string[]
}

export default function ClanSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'active' | 'new' | 'top' | 'all'>('active')
  const [clans, setClans] = useState<Clan[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadClans()
  }, [activeTab, location.state])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClans()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadClans = async () => {
    try {
      setLoading(true)
      const typeMap: { [key: string]: string } = {
        active: 'active',
        new: 'new',
        top: 'top',
        all: '',
      }
      const type = typeMap[activeTab] || ''
      const response = await apiClient.get(`/clans?type=${type}&search=${searchQuery}`).catch(() => ({ data: [] }))
      setClans(response.data || [])
    } catch (error) {
      console.error('Failed to load clans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClanClick = (clanId: string) => {
    navigate(`/clans/${clanId}`)
  }

  const formatTreasury = (treasury: number | string) => {
    const amount = typeof treasury === 'string' ? parseInt(treasury) : treasury
    return amount.toLocaleString()
  }

  if ((user?.level || 0) < 10) {
    return (
      <PageLayout title="Поиск клана" showBack={true}>
        <div className="clans-unavailable">
          <img src="/img/кланы.png" alt="Federations" className="clans-unavailable-icon" />
          <h2 className="clans-unavailable-title">Федерации недоступны</h2>
          <p className="clans-unavailable-text">
            Федерации открываются с 10 уровня. Прокачайся, играй в турнирах и зарабатывай очки!
          </p>
          <button className="clans-play-button" onClick={() => navigate('/')}>
            Играть
          </button>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Поиск федерации"
      subtitle="Выбирай по духу, рейтингу или числу участников - и присоединяйся"
      showBack={true}
      tabs={[
        { id: 'active', label: 'Активные', active: activeTab === 'active', onClick: () => setActiveTab('active') },
        { id: 'new', label: 'Новые', active: activeTab === 'new', onClick: () => setActiveTab('new') },
        { id: 'top', label: 'Топ', active: activeTab === 'top', onClick: () => setActiveTab('top') },
        { id: 'all', label: 'Все', active: activeTab === 'all', onClick: () => setActiveTab('all') },
      ]}
    >
      {/* Поисковая строка */}
      <div className="clan-search-input-container">
        <input
          type="text"
          className="clan-search-input"
          placeholder="Поиск федерации"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Список кланов */}
      {loading ? (
        <div className="clan-search-loading">Загрузка...</div>
      ) : clans.length === 0 ? (
        <div className="clan-search-empty">Федерации не найдены</div>
      ) : (
        <div className="clan-search-list">
          {clans.map((clan) => (
            <div key={clan.id} className="clan-search-item" onClick={() => handleClanClick(clan.id)}>
              <img src="/img/кланы.png" alt="Clan" className="clan-search-icon" />
              <div className="clan-search-info">
                <div className="clan-search-name">{clan.name}</div>
                <div className="clan-search-details">
                  Уровень {clan.level} · {clan.memberCount} участника
                </div>
                <div className="clan-search-treasury">Казна: {formatTreasury(clan.treasury)} NAR</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
