import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatDateTime } from '../utils/dateUtils'
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
  prizes?: any
  startDate: string
  registrationStart?: string
  registrationEnd?: string
  registered: boolean
  currentRound?: number
  totalRounds?: number
  timeRemaining?: string
  matches?: TournamentMatch[]
}

interface TournamentMatch {
  id: string
  round: number
  matchNumber: number
  status: 'scheduled' | 'in_progress' | 'finished' | 'bye'
  player1?: {
    id: string
    username: string
    nickname?: string
    avatarUrl?: string
  }
  player2?: {
    id: string
    username: string
    nickname?: string
    avatarUrl?: string
  }
  winnerId?: string
  gameId?: string
}

import { TournamentBracket } from '../components/TournamentBracket'

export default function Tournaments() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const timezone = user?.timezone || 'Europe/Moscow'
  const [activeTab, setActiveTab] = useState<'active' | 'future'>('active')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [tournamentDetail, setTournamentDetail] = useState<Tournament | null>(null)
  const [availableTickets, setAvailableTickets] = useState(0)

  useEffect(() => {
    loadTournaments()
    loadTickets()
  }, [activeTab])

  const loadTickets = async () => {
    try {
      const response = await apiClient.get('/tournaments/tickets/my').catch(() => ({ data: { available: 0 } }))
      setAvailableTickets(response.data?.available || 0)
    } catch (error) {
      console.error('Failed to load tickets:', error)
    }
  }

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

  const handleShowDetails = async (tournament: Tournament) => {
    try {
      setSelectedTournament(tournament)
      const response = await apiClient.get(`/tournaments/${tournament.id}`)
      setTournamentDetail(response.data)
    } catch (error) {
      console.error('Failed to load tournament details:', error)
      setTournamentDetail(tournament)
    }
  }

  const handleRegister = async (tournamentId: string) => {
    try {
      await apiClient.post(`/tournaments/${tournamentId}/register`)
      loadTournaments()
      loadTickets() // Обновляем количество билетов
      if (selectedTournament?.id === tournamentId) {
        setSelectedTournament(null)
        setTournamentDetail(null)
      }
      alert('Регистрация успешна!')
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
                  {availableTickets > 0 && (
                    <span style={{ marginLeft: '8px', color: '#4CAF50', fontSize: '12px' }}>
                      или 🎫 {availableTickets} билет{availableTickets > 1 ? 'ов' : ''}
                    </span>
                  )}
                </div>
                <div className="tournament-detail">
                  Призовой фонд: {tournament.prizePool.toLocaleString()} NAR
                </div>
                {activeTab === 'active' && tournament.status === 'in_progress' && tournament.currentRound && tournament.totalRounds && (
                  <div className="tournament-detail">
                    Раунд {tournament.currentRound} из {tournament.totalRounds}
                    {tournament.timeRemaining && ` • Осталось ${tournament.timeRemaining}`}
                  </div>
                )}
                {activeTab === 'active' && tournament.status === 'registration' && tournament.registrationEnd && (
                  <div className="tournament-detail">
                    Регистрация до: {formatDateTime(tournament.registrationEnd, timezone)}
                  </div>
                )}
              </div>

              <div className="tournament-action">
                <button
                  className="tournament-button tournament-button-details"
                  onClick={() => handleShowDetails(tournament)}
                >
                  Подробнее
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Модальное окно с деталями турнира */}
      {selectedTournament && tournamentDetail && createPortal(
        <div 
          className="tournament-modal-overlay" 
          onClick={() => { setSelectedTournament(null); setTournamentDetail(null) }}
          style={{
            position: 'fixed',
            top: '0px',
            left: '0px',
            right: '0px',
            bottom: '0px',
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '20px',
            margin: '0',
            touchAction: 'none',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
          }}
        >
          <div className="tournament-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tournament-modal-header">
              <h3 className="tournament-modal-title">{tournamentDetail.name}</h3>
              <button 
                className="tournament-modal-close"
                onClick={() => { setSelectedTournament(null); setTournamentDetail(null) }}
              >
                ×
              </button>
            </div>

            <div className="tournament-modal-content">
              {/* Базовая информация */}
              <div className="tournament-modal-section">
                <div className="tournament-modal-info-row">
                  <span className="tournament-modal-label">Начало:</span>
                  <span className="tournament-modal-value">
                    {formatDateTime(tournamentDetail.startDate, timezone)}
                  </span>
                </div>
                <div className="tournament-modal-info-row">
                  <span className="tournament-modal-label">Взнос:</span>
                  <span className="tournament-modal-value">
                    {tournamentDetail.entryFee} NAR
                    {availableTickets > 0 && (
                      <span style={{ marginLeft: '8px', color: '#4CAF50', fontSize: '12px' }}>
                        или 🎫 {availableTickets} билет{availableTickets > 1 ? 'ов' : ''}
                      </span>
                    )}
                  </span>
                </div>
                <div className="tournament-modal-info-row">
                  <span className="tournament-modal-label">Участников:</span>
                  <span className="tournament-modal-value">
                    {tournamentDetail.currentParticipants}/{tournamentDetail.maxParticipants}
                  </span>
                </div>
                <div className="tournament-modal-info-row">
                  <span className="tournament-modal-label">Формат:</span>
                  <span className="tournament-modal-value">1x1 • {getModeName(tournamentDetail.mode)}</span>
                </div>
              </div>

              {/* Призы */}
              <div className="tournament-modal-section">
                <h4 className="tournament-modal-section-title">Призы</h4>
                <div className="tournament-modal-prizes">
                  {tournamentDetail.prizes ? (
                    Array.isArray(tournamentDetail.prizes) ? (
                      tournamentDetail.prizes.map((prize: any, index: number) => (
                        <div key={index} className="tournament-modal-prize">
                          <span className="tournament-modal-prize-place">
                            {prize.place === 1 ? '🥇' : prize.place === 2 ? '🥈' : prize.place === 3 ? '🥉' : `${prize.place}.`}
                          </span>
                          <span className="tournament-modal-prize-value">
                            {prize.type === 'usd' && `$${prize.amount}`}
                            {prize.type === 'nar' && `${prize.amount} NAR`}
                            {prize.type === 'skin' && `Скин: ${prize.skinName || prize.skinId}`}
                            {prize.type === 'xp' && `${prize.amount} XP`}
                            {!prize.type && prize.amount && `${prize.amount} NAR`}
                          </span>
                        </div>
                      ))
                    ) : typeof tournamentDetail.prizes === 'object' ? (
                      Object.entries(tournamentDetail.prizes).map(([key, value]: [string, any]) => (
                        <div key={key} className="tournament-modal-prize">
                          <span className="tournament-modal-prize-place">
                            {key === '1' ? '🥇' : key === '2' ? '🥈' : key === '3' ? '🥉' : `${key}.`} место:
                          </span>
                          <span className="tournament-modal-prize-value">
                            {value.type === 'usd' && `$${value.amount}`}
                            {value.type === 'nar' && `${value.amount} NAR`}
                            {value.type === 'skin' && `Скин: ${value.skinName || value.skinId}`}
                            {value.type === 'xp' && `${value.amount} XP`}
                            {typeof value === 'number' && `${value} NAR`}
                            {typeof value === 'string' && value}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="tournament-modal-prize">
                        <span className="tournament-modal-prize-value">
                          Призовой фонд: {tournamentDetail.prizePool?.toLocaleString()} NAR
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="tournament-modal-prize">
                      <span className="tournament-modal-prize-value">
                        Призовой фонд: {tournamentDetail.prizePool?.toLocaleString()} NAR
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Турнирная сетка */}
              {(tournamentDetail.matches && tournamentDetail.matches.length > 0) || tournamentDetail.format === 'bracket' ? (
                <div className="tournament-modal-section">
                  <h4 className="tournament-modal-section-title">Турнирная сетка</h4>
                  <div className="tournament-modal-bracket-container">
                    <TournamentBracket 
                      matches={tournamentDetail.matches || []} 
                      maxParticipants={tournamentDetail.maxParticipants} 
                      tournamentId={tournamentDetail.id}
                      tournamentStatus={tournamentDetail.status}
                    />
                  </div>
                </div>
              ) : null}

              {/* Кнопка регистрации */}
              {!tournamentDetail.registered && tournamentDetail.status === 'registration' && (
                <div className="tournament-modal-actions">
                  <button
                    className="tournament-modal-button tournament-modal-button-primary"
                    onClick={() => handleRegister(tournamentDetail.id)}
                  >
                    Зарегистрироваться
                  </button>
                </div>
              )}
              {tournamentDetail.registered && (
                <div className="tournament-modal-actions">
                  <button
                    className="tournament-modal-button tournament-modal-button-secondary"
                    onClick={() => navigate(`/tournaments/${tournamentDetail.id}`)}
                  >
                    Перейти к турниру
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
