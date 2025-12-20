import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
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
  const [activeTab, setActiveTab] = useState<'active' | 'new' | 'top' | 'all'>('active')
  const [clans, setClans] = useState<Clan[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadClans()
  }, [activeTab, location.state])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        loadClans()
      } else {
        loadClans()
      }
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
      const response = await apiClient.get(`/clans?type=${type}&search=${searchQuery}`)
      setClans(response.data || [])
      
      // Если есть данные из location.state, используем их
      if (location.state?.clans && !searchQuery) {
        setClans(location.state.clans)
      }
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

  return (
    <div className="app-container">
      <PageHeader title="Поиск клана" />
      
      <div className="clan-search-content">
        <div className="clan-search-subtitle">
          Выбирай по духу, рейтингу или числу участников - и присоединяйся
        </div>

        {/* Вкладки */}
        <div className="clan-search-tabs">
          <button
            className={`clan-search-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Активные
          </button>
          <button
            className={`clan-search-tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            Новые
          </button>
          <button
            className={`clan-search-tab ${activeTab === 'top' ? 'active' : ''}`}
            onClick={() => setActiveTab('top')}
          >
            Топ
          </button>
          <button
            className={`clan-search-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Все
          </button>
        </div>

        {/* Поисковая строка */}
        <div className="clan-search-input-container">
          <input
            type="text"
            className="clan-search-input"
            placeholder="Поиск клана"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Список кланов */}
        {loading ? (
          <Card>
            <div className="clan-search-empty">Загрузка...</div>
          </Card>
        ) : clans.length === 0 ? (
          <Card>
            <div className="clan-search-empty">Кланы не найдены</div>
          </Card>
        ) : (
          <div className="clan-search-list">
            {clans.map((clan) => (
              <Card
                key={clan.id}
                className="clan-search-item"
                onClick={() => handleClanClick(clan.id)}
              >
                <div className="clan-search-item-content">
                  <div className="clan-search-item-icon">
                    <Icon name="shield" size={32} style={{ color: '#ffd700' }} />
                  </div>
                  <div className="clan-search-item-info">
                    <div className="clan-search-item-name">{clan.name}</div>
                    <div className="clan-search-item-details">
                      Уровень {clan.level} - {clan.memberCount} {clan.memberCount === 1 ? 'участник' : clan.memberCount < 5 ? 'участника' : 'участников'}
                    </div>
                    <div className="clan-search-item-treasury">
                      Казна: {formatTreasury(clan.treasury)} NAR
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
