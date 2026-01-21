import React, { useRef, useState, useEffect } from 'react'
import './TournamentBracket.css'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api/client'

interface BracketMatch {
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
  scheduledAt?: string
}

interface TournamentBracketProps {
  matches: BracketMatch[]
  maxParticipants?: number
  tournamentId?: string
  tournamentStatus?: string
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ 
  matches, 
  maxParticipants = 16,
  tournamentId,
  tournamentStatus,
}) => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const currentUserId = user?.id
  const containerRef = useRef<HTMLDivElement>(null)
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null)
  
  // Drag to scroll logic
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only enable drag if not clicking on a clickable match
    const target = e.target as HTMLElement
    if (target.closest('.bracket-match.clickable') || target.closest('.bracket-match.clickable-start')) return

    setIsDragging(true)
    if (containerRef.current) {
      setStartX(e.pageX - containerRef.current.offsetLeft)
      setStartY(e.pageY - containerRef.current.offsetTop)
      setScrollLeft(containerRef.current.scrollLeft)
      setScrollTop(containerRef.current.scrollTop)
      containerRef.current.style.cursor = 'grabbing'
    }
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    e.preventDefault()
    
    const x = e.pageX - containerRef.current.offsetLeft
    const y = e.pageY - containerRef.current.offsetTop
    
    const walkX = (x - startX) * 1.5 // Scroll speed multiplier
    const walkY = (y - startY) * 1.5

    containerRef.current.scrollLeft = scrollLeft - walkX
    containerRef.current.scrollTop = scrollTop - walkY
  }

  // Generate full bracket structure based on maxParticipants
  const buildFullBracket = (matches: BracketMatch[] = [], maxParticipants: number) => {
    // Determine the bracket size (next power of 2)
    const capacity = Math.pow(2, Math.ceil(Math.log2(maxParticipants)))
    const totalRounds = Math.log2(capacity)
    
    const rounds: Array<Array<BracketMatch>> = []
    
    // Если турнир в статусе registration, собираем регистрационные матчи (round: 0, без player2)
    // Если турнир уже начат, такие матчи не должны быть - сетка уже создана
    const isRegistrationPhase = tournamentStatus === 'registration' || tournamentStatus === 'upcoming'
    const registrationPool = new Map<number, BracketMatch>()

    if (isRegistrationPhase) {
      matches.forEach((m) => {
        if (m.round === 0 && !m.player2 && typeof m.matchNumber === 'number') {
          registrationPool.set(m.matchNumber, m)
        }
      })
    }
    
    for (let round = 0; round < totalRounds; round++) {
      const matchesInRound = capacity / Math.pow(2, round + 1)
      const roundMatches: BracketMatch[] = []
      
      for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
        // Find existing match in data (игнорируем регистрационные матчи после создания сетки)
        const existingMatch = matches.find(m => {
          if (m.round === round && m.matchNumber === matchNum) {
            // Если турнир начат, игнорируем регистрационные матчи (round: 0 без player2)
            if (!isRegistrationPhase && round === 0 && !m.player2) {
              return false
            }
            return true
          }
          return false
        })
        
        if (existingMatch) {
          // Если это реальный матч (не регистрационный), используем его как есть
          if (existingMatch.player2 || (!isRegistrationPhase && round === 0)) {
            roundMatches.push(existingMatch)
          } else if (isRegistrationPhase && round === 0) {
            // В фазе регистрации можем попытаться найти партнера
            let player2 = existingMatch.player2
            if (!player2) {
              const partnerEntry = registrationPool.get(matchNum * 2 + 1)
              if (partnerEntry) {
                player2 = partnerEntry.player1
                registrationPool.delete(matchNum * 2 + 1)
              }
            }
            roundMatches.push({
              ...existingMatch,
              player2,
            })
          }
        } else {
          // Создаем placeholder только в фазе регистрации
          let player1, player2;
          
          if (isRegistrationPhase && round === 0) {
             const p1Entry = registrationPool.get(matchNum * 2)
             const p2Entry = registrationPool.get(matchNum * 2 + 1)
             if (p1Entry) {
               player1 = p1Entry.player1
               registrationPool.delete(matchNum * 2)
             }
             if (p2Entry) {
               player2 = p2Entry.player1
               registrationPool.delete(matchNum * 2 + 1)
             }
          }

          // Create placeholder
          roundMatches.push({
            id: `placeholder-${round}-${matchNum}`,
            round,
            matchNumber: matchNum,
            status: 'scheduled',
            player1,
            player2,
          })
        }
      }
      rounds.push(roundMatches)
    }
    
    return rounds
  }

  const rounds = buildFullBracket(matches, maxParticipants)

  // Определяет, можно ли начать матч
  const canStartMatch = (match: BracketMatch): boolean => {
    if (!tournamentId || !currentUserId) return false
    if (tournamentStatus !== 'in_progress') return false
    if (match.status !== 'scheduled') return false
    if (!match.player1 || !match.player2) return false
    if (match.player1.id !== currentUserId && match.player2.id !== currentUserId) return false
    if (match.gameId) return false // Матч уже начат

    // Проверяем, что прошло 15 минут с начала раунда (время подготовки)
    if (match.scheduledAt) {
      const now = new Date()
      const roundStartTime = new Date(match.scheduledAt)
      const roundEndTime = new Date(roundStartTime.getTime() + 15 * 60 * 1000) // 15 минут с начала раунда
      
      // Игра может начаться только после окончания 15 минут подготовки раунда
      if (now >= roundEndTime) {
        return true
      }
    }

    return false
  }

  const handleStartMatch = async (matchId: string) => {
    if (!tournamentId || startingMatchId) return
    
    try {
      setStartingMatchId(matchId)
      const response = await apiClient.post(`/tournaments/${tournamentId}/matches/${matchId}/start`)
      if (response.data.gameId) {
        navigate(`/game/${response.data.gameId}`)
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при старте матча')
      console.error('Failed to start match:', error)
    } finally {
      setStartingMatchId(null)
    }
  }

  const getRoundName = (roundIndex: number, totalRounds: number) => {
    if (roundIndex === totalRounds - 1) return 'Финал'
    if (roundIndex === totalRounds - 2) return 'Полуфинал'
    if (roundIndex === totalRounds - 3) return 'Четвертьфинал'
    return `Раунд ${roundIndex + 1}`
  }

  return (
    <div 
      className="bracket-container" 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div className="bracket-scroll">
        <div className="bracket-rounds">
          {rounds.map((roundMatches, roundIndex) => {
            const isLastRound = roundIndex === rounds.length - 1
            
            return (
              <div key={roundIndex} className="bracket-round">
                <div className="bracket-round-header">
                  {getRoundName(roundIndex, rounds.length)}
                </div>
                <div className="bracket-matches">
                  {roundMatches.map((match, matchIndex) => {
                    const canStart = canStartMatch(match)
                    const isUserInMatch = currentUserId && (match.player1?.id === currentUserId || match.player2?.id === currentUserId)
                    const opponent = match.player1?.id === currentUserId ? match.player2 : match.player1
                    
                    return (
                    <div key={match.id} className="bracket-match-wrapper">
                      <div 
                        className={`bracket-match ${match.gameId && isUserInMatch ? 'clickable' : (canStart && isUserInMatch) ? 'clickable-start' : ''}`}
                        onClick={() => {
                          if (!isUserInMatch) return // Запрет захода в чужие матчи
                          
                          if (match.gameId) {
                            navigate(`/game/${match.gameId}`)
                          } else if (canStart && !startingMatchId) {
                            handleStartMatch(match.id)
                          }
                        }}
                      >
                        <div className={`bracket-player ${match.winnerId === match.player1?.id ? 'winner' : ''} ${!match.player1 ? 'empty' : ''} ${match.player1?.id === currentUserId ? 'current-user' : ''}`}>
                           {match.player1?.avatarUrl ? (
                             <img src={match.player1.avatarUrl} className="bracket-avatar" alt="" />
                           ) : (
                             <div className="bracket-avatar-placeholder"><Icon name="user" size={12} /></div>
                           )}
                           {match.player1?.id === currentUserId && <span className="bracket-me-indicator">•</span>}
                           <span className="bracket-player-name">{match.player1?.nickname || match.player1?.username || '-'}</span>
                           {match.winnerId === match.player1?.id && <Icon name="trophy" size={12} className="bracket-trophy" />}
                        </div>
                        <div className={`bracket-player ${match.winnerId === match.player2?.id ? 'winner' : ''} ${!match.player2 ? 'empty' : ''} ${match.player2?.id === currentUserId ? 'current-user' : ''}`}>
                           {match.player2?.avatarUrl ? (
                             <img src={match.player2.avatarUrl} className="bracket-avatar" alt="" />
                           ) : (
                             <div className="bracket-avatar-placeholder"><Icon name="user" size={12} /></div>
                           )}
                           {match.player2?.id === currentUserId && <span className="bracket-me-indicator">•</span>}
                           <span className="bracket-player-name">{match.player2?.nickname || match.player2?.username || '-'}</span>
                           {match.winnerId === match.player2?.id && <Icon name="trophy" size={12} className="bracket-trophy" />}
                        </div>
                      </div>
                      
                      {!isLastRound && (
                        <div className={`bracket-connector ${matchIndex % 2 === 0 ? 'connector-down' : 'connector-up'}`}></div>
                      )}
                      
                      {/* Incoming connector for all rounds except first */}
                      {roundIndex > 0 && (
                        <div className="bracket-connector-incoming"></div>
                      )}
                    </div>
                  )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
