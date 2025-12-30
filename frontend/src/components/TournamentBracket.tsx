import React from 'react'
import './TournamentBracket.css'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useAuthStore } from '../store/authStore'

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
}

interface TournamentBracketProps {
  matches: BracketMatch[]
  maxParticipants?: number
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ matches, maxParticipants = 16 }) => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const currentUserId = user?.id

  // Generate full bracket structure based on maxParticipants
  const buildFullBracket = (matches: BracketMatch[] = [], maxParticipants: number) => {
    // Determine the bracket size (next power of 2)
    const capacity = Math.pow(2, Math.ceil(Math.log2(maxParticipants)))
    const totalRounds = Math.log2(capacity)
    
    const rounds: Array<Array<BracketMatch>> = []
    
    for (let round = 0; round < totalRounds; round++) {
      const matchesInRound = capacity / Math.pow(2, round + 1)
      const roundMatches: BracketMatch[] = []
      
      for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
        // Find existing match in data
        const existingMatch = matches.find(m => m.round === round && m.matchNumber === matchNum)
        
        if (existingMatch) {
          roundMatches.push(existingMatch)
        } else {
          // Check if we have registered players for Round 0 that haven't been assigned a match ID yet
          // In the backend, registered users are stored as matches with round=0 and sequential matchNumber
          // BUT they are not paired yet. They are just "slots".
          // matchNumber 0, 1, 2, 3...
          
          // If round is 0, we can try to fill slots with players from the "registration" matches list
          // if the backend provides them in a flat list.
          
          // However, the standard `matches` array passed here usually contains valid match structures.
          // If we are in registration phase, `matches` might be a list of user entries (round=0).
          
          let player1, player2;
          
          if (round === 0) {
             // Try to find player in slot 1 (index 2*matchNum) and slot 2 (index 2*matchNum + 1)
             // This assumes `matches` contains raw registration entries with sequential matchNumbers 0, 1, 2...
             // and NO pairing logic applied yet.
             // This is a heuristic for visualization before tournament start.
             
             // Check if `matches` contains "unpaired" entries (player2 is null, status scheduled/bye)
             const isRegistrationList = matches.every(m => m.round === 0 && !m.player2);
             
             if (isRegistrationList) {
                 const p1Entry = matches.find(m => m.matchNumber === matchNum * 2);
                 const p2Entry = matches.find(m => m.matchNumber === matchNum * 2 + 1);
                 
                 if (p1Entry) player1 = p1Entry.player1;
                 if (p2Entry) player2 = p2Entry.player1; // Yes, player1 of the entry
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

  const getRoundName = (roundIndex: number, totalRounds: number) => {
    if (roundIndex === totalRounds - 1) return 'Финал'
    if (roundIndex === totalRounds - 2) return 'Полуфинал'
    if (roundIndex === totalRounds - 3) return 'Четвертьфинал'
    return `Раунд ${roundIndex + 1}`
  }

  return (
    <div className="bracket-container">
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
                  {roundMatches.map((match, matchIndex) => (
                    <div key={match.id} className="bracket-match-wrapper">
                      <div 
                        className={`bracket-match ${match.gameId ? 'clickable' : ''}`}
                        onClick={() => match.gameId && navigate(`/game/${match.gameId}`)}
                      >
                        <div className={`bracket-player ${match.winnerId === match.player1?.id ? 'winner' : ''} ${!match.player1 ? 'empty' : ''} ${match.player1?.id === currentUserId ? 'current-user' : ''}`}>
                           {match.player1?.avatarUrl ? (
                             <img src={match.player1.avatarUrl} className="bracket-avatar" alt="" />
                           ) : (
                             <div className="bracket-avatar-placeholder"><Icon name="user" size={12} /></div>
                           )}
                           <span className="bracket-player-name">{match.player1?.nickname || match.player1?.username || '-'}</span>
                           {match.winnerId === match.player1?.id && <Icon name="trophy" size={12} className="bracket-trophy" />}
                        </div>
                        <div className={`bracket-player ${match.winnerId === match.player2?.id ? 'winner' : ''} ${!match.player2 ? 'empty' : ''} ${match.player2?.id === currentUserId ? 'current-user' : ''}`}>
                           {match.player2?.avatarUrl ? (
                             <img src={match.player2.avatarUrl} className="bracket-avatar" alt="" />
                           ) : (
                             <div className="bracket-avatar-placeholder"><Icon name="user" size={12} /></div>
                           )}
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
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
