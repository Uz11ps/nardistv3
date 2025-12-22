import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
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
      const response = await apiClient.get(`/tournaments?status=${status}`).catch(() => ({ data: [] }))
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

  const getModeName = (mode: string) => {
    return mode === 'long' ? 'Длинные' : 'Короткие'
  }

  return (
    <PageLayout
      title="Турниры"
      showBack={true}
      tabs={[
        { id: 'active', label: 'Активные', active: activeTab === 'active', onClick: () => setActiveTab('active') },
        { id: 'future', label: 'Будущие', active: activeTab === 'future', onClick: () => setActiveTab('future') },
      ]}
    >
      <div className="tournaments-list">
        {tournaments.length === 0 ? (
          <div className="tournaments-empty">Нет доступных турниров</div>
        ) : (
          tournaments.map((tournament) => (
            <div key={tournament.id} className="tournament-card">
              <div className="tournament-header">
                <div className="tournament-title">{tournament.name}</div>
                <div className="tournament-participants">
                  {tournament.currentParticipants}/{tournament.maxParticipants}
                </div>
              </div>
              
              <div className="tournament-details">
                <div className="tournament-detail">
                  Формат: 1х1 • {getModeName(tournament.mode)}
                </div>
                <div className="tournament-detail">
                  Взнос: {tournament.entryFee} NAR
                </div>
                <div className="tournament-detail">
                  Призовой фонд: {tournament.prizePool.toLocaleString()} NAR
                </div>
                {activeTab === 'active' && tournament.currentRound && tournament.totalRounds && (
                  <div className="tournament-detail">
                    Раунд {tournament.currentRound} из {tournament.totalRounds} • Осталось {tournament.timeRemaining || '5:24'}
                  </div>
                )}
              </div>

              <div className="tournament-action">
                {tournament.registered ? (
                  <button
                    className="tournament-button tournament-button-registered"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    Участвуете
                  </button>
                ) : (
                  <button
                    className="tournament-button tournament-button-participate"
                    onClick={() => handleRegister(tournament.id)}
                  >
                    Участвовать
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </PageLayout>
  )
}
