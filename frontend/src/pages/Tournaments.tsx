import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'

interface Tournament {
  id: string
  name: string
  mode: 'short' | 'long'
  format: 'bracket' | 'round_robin'
  status: 'upcoming' | 'registration' | 'in_progress' | 'finished'
  maxParticipants: number
  currentParticipants: number
  entryFee: number
  prizePool: number
  startDate: string
  registered: boolean
  currentRound?: number
  totalRounds?: number
  timeRemaining?: string
}

export default function Tournaments() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming'>('active')
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    loadTournaments()
  }, [activeTab])

  const loadTournaments = async () => {
    try {
      const response = await apiClient.get(`/tournaments?status=${activeTab === 'active' ? 'in_progress,registration' : 'upcoming'}`)
      setTournaments(response.data || [])
    } catch (error) {
      console.error('Failed to load tournaments:', error)
    }
  }

  const handleRegister = async (tournamentId: string) => {
    try {
      await apiClient.post(`/tournaments/${tournamentId}/register`)
      loadTournaments()
    } catch (error) {
      console.error('Failed to register:', error)
    }
  }

  const handleView = (tournamentId: string) => {
    navigate(`/tournaments/${tournamentId}`)
  }

  return (
    <div className="app-container">
      <PageHeader title="Турниры" />
      
      <div style={{ padding: '20px' }}>
        {/* Вкладки */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Активные
          </button>
          <button
            className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Будущие
          </button>
        </div>

        {/* Список турниров */}
        <div>
          {tournaments.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
                Нет доступных турниров
              </div>
            </Card>
          ) : (
            tournaments.map((tournament) => (
              <Card key={tournament.id} style={{ marginBottom: '12px' }}>
                <div className="card-title">{tournament.name}</div>
                <div className="card-subtitle" style={{ marginTop: '4px' }}>
                  Формат: 1x1 - {tournament.mode === 'long' ? 'Длинные' : 'Короткие'}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#aaaaaa' }}>Взнос:</span>
                    <span className="gold">{tournament.entryFee} NAR</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#aaaaaa' }}>Призовой фонд:</span>
                    <span className="gold">{tournament.prizePool.toLocaleString()} NAR</span>
                  </div>
                  {tournament.status === 'in_progress' && tournament.currentRound && (
                    <div style={{ color: '#aaaaaa', fontSize: '14px' }}>
                      Раунд {tournament.currentRound} из {tournament.totalRounds}
                      {tournament.timeRemaining && ` • Осталось ${tournament.timeRemaining}`}
                    </div>
                  )}
                  {tournament.status === 'registration' && (
                    <div style={{ color: '#aaaaaa', fontSize: '14px' }}>
                      {tournament.currentParticipants}/{tournament.maxParticipants}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  {tournament.registered ? (
                    <Button variant="secondary" fullWidth onClick={() => handleView(tournament.id)}>
                      Участвуете
                    </Button>
                  ) : (
                    <Button fullWidth onClick={() => handleRegister(tournament.id)}>
                      Участвовать
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
