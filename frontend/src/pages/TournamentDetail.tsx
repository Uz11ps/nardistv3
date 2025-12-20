import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'
import './TournamentDetail.css'

interface Tournament {
  id: string
  name: string
  mode: 'short' | 'long'
  format: 'bracket' | 'round_robin'
  status: 'upcoming' | 'registration' | 'in_progress' | 'finished'
  maxParticipants: number
  currentParticipants: number
  entryFee?: number
  prizePool?: number
  startDate: string
  registered?: boolean
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

export default function TournamentDetail() {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'table' | 'matches' | 'results'>('table')
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tournamentId) {
      loadTournament()
    }
  }, [tournamentId])

  const loadTournament = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/tournaments/${tournamentId}`)
      setTournament(response.data)
    } catch (error) {
      console.error('Failed to load tournament:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!tournamentId) return
    try {
      await apiClient.post(`/tournaments/${tournamentId}/register`)
      loadTournament()
      alert('Регистрация успешна!')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка регистрации')
    }
  }

  const getModeName = (mode: string) => {
    return mode === 'long' ? 'Длинные' : 'Короткие'
  }

  const buildBracket = (matches: TournamentMatch[] = []) => {
    if (!matches || matches.length === 0) return { rounds: [] }

    // Определяем количество раундов
    const maxRound = Math.max(...matches.map(m => m.round), 0)
    const rounds: Array<Array<TournamentMatch>> = []

    for (let round = 0; round <= maxRound; round++) {
      const roundMatches = matches
        .filter(m => m.round === round)
        .sort((a, b) => a.matchNumber - b.matchNumber)
      rounds.push(roundMatches)
    }

    return { rounds }
  }

  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds - 1) return 'Финал'
    if (round === totalRounds - 2) return 'Полуфинал'
    if (round === totalRounds - 3) return 'Четвертьфинал'
    return `Раунд ${round + 1}`
  }

  if (loading) {
    return (
      <div className="app-container page-transition">
        <PageHeader title="Турнир" />
        <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
          Загрузка...
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="app-container page-transition">
        <PageHeader title="Турнир" />
        <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
          Турнир не найден
        </div>
        <BottomNav />
      </div>
    )
  }

  const { rounds } = buildBracket(tournament.matches || [])
  const totalRounds = rounds.length

  return (
    <div className="app-container page-transition">
      <PageHeader title={tournament.name} />
      
      <div className="tournament-detail-content">
        {/* Вкладки */}
        <div className="tournament-detail-tabs">
          <button
            className={`tournament-detail-tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            Таблица
          </button>
          <button
            className={`tournament-detail-tab ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            Матчи
          </button>
          <button
            className={`tournament-detail-tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Результаты
          </button>
        </div>

        {/* Контент вкладки "Таблица" */}
        {activeTab === 'table' && (
          <div className="tournament-detail-tab-content">
            <Card className="tournament-info-card">
              <div className="tournament-info-row">
                <span className="tournament-info-label">Формат:</span>
                <span className="tournament-info-value">1x1 - {getModeName(tournament.mode)}</span>
              </div>
              <div className="tournament-info-row">
                <span className="tournament-info-label">Участников:</span>
                <span className="tournament-info-value">
                  {tournament.currentParticipants}/{tournament.maxParticipants}
                </span>
              </div>
              {tournament.entryFee !== undefined && (
                <div className="tournament-info-row">
                  <span className="tournament-info-label">Взнос:</span>
                  <span className="tournament-info-value gold">{tournament.entryFee} NAR</span>
                </div>
              )}
              {tournament.prizePool !== undefined && (
                <div className="tournament-info-row">
                  <span className="tournament-info-label">Призовой фонд:</span>
                  <span className="tournament-info-value gold">
                    {tournament.prizePool.toLocaleString()} NAR
                  </span>
                </div>
              )}
              <div className="tournament-info-row">
                <span className="tournament-info-label">Статус:</span>
                <span className="tournament-info-value">{tournament.status}</span>
              </div>
            </Card>

            {!tournament.registered && tournament.status === 'registration' && (
              <Button variant="primary" fullWidth onClick={handleRegister}>
                Зарегистрироваться
              </Button>
            )}
          </div>
        )}

        {/* Контент вкладки "Матчи" - Турнирная сетка */}
        {activeTab === 'matches' && (
          <div className="tournament-detail-tab-content">
            {rounds.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '40px', color: '#aaaaaa' }}>
                  Матчи еще не сформированы
                </div>
              </Card>
            ) : (
              <div className="tournament-bracket">
                {/* Заголовок раундов */}
                <div className="tournament-bracket-header">
                  {rounds.map((_, index) => (
                    <span key={index} className="tournament-bracket-round-header">
                      {getRoundName(index, totalRounds)}
                      {index < rounds.length - 1 && ' - '}
                    </span>
                  ))}
                </div>

                {/* Сетка */}
                <div className="tournament-bracket-grid">
                  {rounds.map((roundMatches, roundIndex) => (
                    <div key={roundIndex} className="tournament-bracket-round">
                      {roundMatches.map((match, matchIndex) => (
                        <Card
                          key={match.id}
                          className="tournament-bracket-match"
                          onClick={() => match.gameId && navigate(`/game/${match.gameId}`)}
                        >
                          <div className="tournament-bracket-match-player">
                            {match.player1 ? (
                              <>
                                <div className="tournament-bracket-match-avatar">
                                  {match.player1.avatarUrl ? (
                                    <img src={match.player1.avatarUrl} alt={match.player1.username} />
                                  ) : (
                                    <Icon name="user" size={24} />
                                  )}
                                </div>
                                <div className="tournament-bracket-match-name">
                                  {match.player1.nickname || match.player1.username}
                                </div>
                                {match.winnerId === match.player1.id && (
                                  <Icon name="trophy" size={16} style={{ color: 'var(--color-gold)' }} />
                                )}
                              </>
                            ) : (
                              <div className="tournament-bracket-match-empty">-</div>
                            )}
                          </div>
                          
                          <div className="tournament-bracket-match-vs">VS</div>
                          
                          <div className="tournament-bracket-match-player">
                            {match.player2 ? (
                              <>
                                <div className="tournament-bracket-match-avatar">
                                  {match.player2.avatarUrl ? (
                                    <img src={match.player2.avatarUrl} alt={match.player2.username} />
                                  ) : (
                                    <Icon name="user" size={24} />
                                  )}
                                </div>
                                <div className="tournament-bracket-match-name">
                                  {match.player2.nickname || match.player2.username}
                                </div>
                                {match.winnerId === match.player2.id && (
                                  <Icon name="trophy" size={16} style={{ color: 'var(--color-gold)' }} />
                                )}
                              </>
                            ) : (
                              <div className="tournament-bracket-match-empty">-</div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Контент вкладки "Результаты" */}
        {activeTab === 'results' && (
          <div className="tournament-detail-tab-content">
            {!tournament.matches || tournament.matches.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: '40px', color: '#aaaaaa' }}>
                  Результаты пока отсутствуют
                </div>
              </Card>
            ) : (
              <div className="tournament-results-list">
                {tournament.matches
                  .filter(m => m.status === 'finished')
                  .map((match) => (
                    <Card key={match.id} className="tournament-result-card">
                      <div className="tournament-result-round">
                        {getRoundName(match.round, totalRounds)}
                      </div>
                      <div className="tournament-result-players">
                        <div className={`tournament-result-player ${match.winnerId === match.player1?.id ? 'winner' : ''}`}>
                          {match.player1?.nickname || match.player1?.username || '-'}
                          {match.winnerId === match.player1?.id && (
                            <Icon name="trophy" size={16} style={{ color: 'var(--color-gold)' }} />
                          )}
                        </div>
                        <div className="tournament-result-vs">VS</div>
                        <div className={`tournament-result-player ${match.winnerId === match.player2?.id ? 'winner' : ''}`}>
                          {match.player2?.nickname || match.player2?.username || '-'}
                          {match.winnerId === match.player2?.id && (
                            <Icon name="trophy" size={16} style={{ color: 'var(--color-gold)' }} />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

