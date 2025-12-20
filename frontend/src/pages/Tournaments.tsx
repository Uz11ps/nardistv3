import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'
import './Tournaments.css'

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
  const [activeTab, setActiveTab] = useState<'active' | 'future'>('active')
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    loadTournaments()
  }, [activeTab])

  const loadTournaments = async () => {
    try {
      const status = activeTab === 'active' ? 'in_progress,registration' : 'upcoming'
      const response = await apiClient.get(`/tournaments?status=${status}`)
      setTournaments(response.data || [])
    } catch (error) {
      console.error('Failed to load tournaments:', error)
      setTournaments([])
    }
  }

  const handleRegister = async (tournamentId: string) => {
    try {
      await apiClient.post(`/tournaments/${tournamentId}/register`)
      loadTournaments()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка регистрации')
      console.error('Failed to register:', error)
    }
  }

  const formatTimeRemaining = (timeRemaining?: string) => {
    if (!timeRemaining) return ''
    return timeRemaining
  }

  const getModeName = (mode: string) => {
    return mode === 'long' ? 'Длинные' : 'Короткие'
  }

  return (
    <div className="app-container">
      <PageHeader title="Турниры" />
      
      <div className="tournaments-content">
        {/* Вкладки */}
        <div className="tournaments-tabs">
          <button
            className={`tournaments-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Активные
          </button>
          <button
            className={`tournaments-tab ${activeTab === 'future' ? 'active' : ''}`}
            onClick={() => setActiveTab('future')}
          >
            Будущие
          </button>
        </div>

        {/* Список турниров */}
        <div className="tournaments-list">
          {tournaments.length === 0 ? (
            <Card>
              <div className="tournaments-empty">
                Нет доступных турниров
              </div>
            </Card>
          ) : (
            tournaments.map((tournament) => (
              <Card key={tournament.id} className="tournament-card">
                <div className="tournament-header">
                  <div className="tournament-title">{tournament.name}</div>
                  <div className="tournament-participants">
                    {tournament.currentParticipants}/{tournament.maxParticipants}
                  </div>
                </div>
                
                <div className="tournament-details">
                  <div className="tournament-detail">
                    <span className="tournament-detail-label">Формат:</span>
                    <span className="tournament-detail-value">1x1 - {getModeName(tournament.mode)}</span>
                  </div>
                  <div className="tournament-detail">
                    <span className="tournament-detail-label">Взнос:</span>
                    <span className="tournament-detail-value gold">{tournament.entryFee} NAR</span>
                  </div>
                  <div className="tournament-detail">
                    <span className="tournament-detail-label">Призовой фонд:</span>
                    <span className="tournament-detail-value gold">{tournament.prizePool.toLocaleString()} NAR</span>
                  </div>
                  {activeTab === 'active' && tournament.currentRound && tournament.totalRounds && (
                    <div className="tournament-detail">
                      <span className="tournament-detail-label">Раунд {tournament.currentRound} из {tournament.totalRounds}</span>
                      {tournament.timeRemaining && (
                        <span className="tournament-detail-value"> - Осталось {formatTimeRemaining(tournament.timeRemaining)}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="tournament-action">
                  {tournament.registered ? (
                    <Button 
                      variant="secondary" 
                      className="tournament-action-btn"
                      onClick={() => navigate(`/tournaments/${tournament.id}`)}
                    >
                      Участвуете
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      className="tournament-action-btn"
                      onClick={() => handleRegister(tournament.id)}
                    >
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