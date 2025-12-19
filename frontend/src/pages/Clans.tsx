import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'
import './Clans.css'

interface Clan {
  id: string
  name: string
  description: string
  level: number
  memberCount: number
  maxMembers: number
  treasury: number
  ownedDistricts: string[]
}

export default function Clans() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'search' | 'my' | 'create'>('search')
  const [clans, setClans] = useState<Clan[]>([])
  const [myClan, setMyClan] = useState<Clan | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })

  useEffect(() => {
    if ((user?.level || 0) < 20) {
      return
    }
    if (activeTab === 'search') {
      loadClans()
    } else if (activeTab === 'my') {
      loadMyClan()
    }
  }, [activeTab, user])

  const loadClans = async () => {
    try {
      const response = await apiClient.get(`/clans?type=active&search=${searchQuery}`)
      setClans(response.data || [])
    } catch (error) {
      console.error('Failed to load clans:', error)
    }
  }

  const loadMyClan = async () => {
    try {
      // Здесь должен быть endpoint для получения клана пользователя
      // Пока заглушка
    } catch (error) {
      console.error('Failed to load my clan:', error)
    }
  }

  const handleCreateClan = async () => {
    try {
      const response = await apiClient.post('/clans/create', createForm)
      setMyClan(response.data)
      setShowCreateModal(false)
      setActiveTab('my')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка создания клана')
    }
  }

  const handleJoinClan = async (clanId: string) => {
    try {
      await apiClient.post(`/clans/${clanId}/join`)
      navigate(`/clans/${clanId}`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка вступления в клан')
    }
  }

  if ((user?.level || 0) < 20) {
    return (
      <div className="app-container">
        <PageHeader title="Кланы" />
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🛡️</div>
          <div className="card-title" style={{ marginBottom: '12px' }}>
            Кланы недоступны
          </div>
          <div className="card-subtitle" style={{ marginBottom: '32px' }}>
            Кланы открываются с 20 уровня, прокачайся, играй в турнирах и зарабатывай очки
          </div>
          <Button onClick={() => navigate('/')}>Играть</Button>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="app-container">
      <PageHeader title="Кланы" />
      
      <div style={{ padding: '20px' }}>
        {/* Вкладки */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Поиск
          </button>
          <button
            className={`tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            Мой клан
          </button>
          <button
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Создать
          </button>
        </div>

        {/* Поиск кланов */}
        {activeTab === 'search' && (
          <div>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Поиск клана"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  loadClans()
                }}
                className="form-input"
              />
            </div>

            <div className="clan-filters">
              <button className="filter-btn active">Активные</button>
              <button className="filter-btn">Новые</button>
              <button className="filter-btn">Топ</button>
              <button className="filter-btn">Все</button>
            </div>

            <div className="clans-list">
              {clans.map((clan) => (
                <Card key={clan.id} className="clan-card" onClick={() => navigate(`/clans/${clan.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="clan-icon">🛡️</div>
                    <div style={{ flex: 1 }}>
                      <div className="card-title">{clan.name}</div>
                      <div className="card-subtitle">
                        Уровень {clan.level} - {clan.memberCount} участников
                      </div>
                      <div className="card-subtitle" style={{ marginTop: '4px' }}>
                        Казна: {clan.treasury.toLocaleString()} NAR
                      </div>
                    </div>
                    <Button onClick={() => handleJoinClan(clan.id)}>
                      Вступить
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Мой клан */}
        {activeTab === 'my' && (
          <div>
            {myClan ? (
              <div>
                <Card className="clan-card">
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div className="clan-icon-large">🛡️</div>
                    <div className="card-title">{myClan.name}</div>
                    <div className="card-subtitle">
                      Уровень {myClan.level} - {myClan.memberCount} участников
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Button variant="secondary" onClick={() => navigate(`/clans/${myClan.id}/treasury`)}>
                      Казна
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/clans/${myClan.id}/upgrade`)}>
                      Улучшить клан
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/clans/${myClan.id}/members`)}>
                      Участники
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/clans/${myClan.id}/districts`)}>
                      Районы
                    </Button>
                    <Button variant="primary" onClick={() => {}}>
                      Покинуть клан
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
                  Вы не состоите в клане
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Создание клана */}
        {activeTab === 'create' && (
          <div>
            <Card className="create-clan-card">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div className="clan-icon-large">🛡️</div>
                <div className="card-title">Создай клан</div>
                <div className="card-subtitle">
                  и начни свой путь к господству в городе
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Название клана</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Введите название"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Описание (необязательно)</label>
                <textarea
                  className="form-input"
                  placeholder="Краткое описание"
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <Button
                fullWidth
                onClick={handleCreateClan}
                disabled={!createForm.name}
              >
                Создать клан
              </Button>

              <div style={{ marginTop: '16px', fontSize: '12px', color: '#aaaaaa', textAlign: 'center' }}>
                После создания клана ты сможешь приглашать участников и улучшать район
              </div>
            </Card>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

