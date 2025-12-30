import React from 'react'
import './TournamentBracket.css'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

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
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ matches }) => {
  const navigate = useNavigate()

  const buildBracket = (matches: BracketMatch[]) => {
    if (!matches || matches.length === 0) return []
    const maxRound = Math.max(...matches.map(m => m.round), 0)
    const rounds: Array<Array<BracketMatch>> = []
    
    for (let round = 0; round <= maxRound; round++) {
      const roundMatches = matches
        .filter(m => m.round === round)
        .sort((a, b) => a.matchNumber - b.matchNumber)
      rounds.push(roundMatches)
    }
    return rounds
  }

  const rounds = buildBracket(matches)

  const getRoundName = (roundIndex: number, totalRounds: number) => {
    if (roundIndex === totalRounds - 1) return 'Финал'
    if (roundIndex === totalRounds - 2) return 'Полуфинал'
    if (roundIndex === totalRounds - 3) return 'Четвертьфинал'
    return `Раунд ${roundIndex + 1}`
  }

  // Helper to pair matches for rendering lines
  // Returns array of [match1, match2] or [match1] if odd
  const pairMatches = (matches: BracketMatch[]) => {
    const pairs: Array<Array<BracketMatch>> = []
    for (let i = 0; i < matches.length; i += 2) {
      if (i + 1 < matches.length) {
        pairs.push([matches[i], matches[i + 1]])
      } else {
        pairs.push([matches[i]])
      }
    }
    return pairs
  }

  return (
    <div className="bracket-container">
      <div className="bracket-scroll">
        <div className="bracket-rounds">
          {rounds.map((roundMatches, roundIndex) => {
            const isLastRound = roundIndex === rounds.length - 1
            // Only pair if it's not the last round (or even if it is, for consistency)
            // Actually, for visual structure, we render pairs.
            // But subsequent rounds have fewer matches.
            // The pairing is visual only for the connector.
            
            // Note: In a proper bracket, Round N has M matches. Round N+1 has M/2 matches.
            // We want to render Round N matches in pairs so we can draw the connector between them.
            
            // However, just rendering a flat list with flex space-around works well for alignment 
            // because flexbox distributes space evenly, naturally aligning the single match in next round 
            // between the two matches of previous round.
            
            // Let's stick to flat list rendering but add class for connectors
            
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
                        <div className={`bracket-player ${match.winnerId === match.player1?.id ? 'winner' : ''} ${!match.player1 ? 'empty' : ''}`}>
                           {match.player1?.avatarUrl ? (
                             <img src={match.player1.avatarUrl} className="bracket-avatar" alt="" />
                           ) : (
                             <div className="bracket-avatar-placeholder"><Icon name="user" size={12} /></div>
                           )}
                           <span className="bracket-player-name">{match.player1?.nickname || match.player1?.username || '-'}</span>
                           {match.winnerId === match.player1?.id && <Icon name="trophy" size={12} className="bracket-trophy" />}
                        </div>
                        <div className={`bracket-player ${match.winnerId === match.player2?.id ? 'winner' : ''} ${!match.player2 ? 'empty' : ''}`}>
                           {match.player2?.avatarUrl ? (
                             <img src={match.player2.avatarUrl} className="bracket-avatar" alt="" />
                           ) : (
                             <div className="bracket-avatar-placeholder"><Icon name="user" size={12} /></div>
                           )}
                           <span className="bracket-player-name">{match.player2?.nickname || match.player2?.username || '-'}</span>
                           {match.winnerId === match.player2?.id && <Icon name="trophy" size={12} className="bracket-trophy" />}
                        </div>
                      </div>
                      
                      {/* 
                          Draw lines: 
                          If this is an even index match (0, 2, 4...) and not last round, 
                          we need a connector that goes DOWN and RIGHT.
                          
                          If this is an odd index match (1, 3, 5...) and not last round,
                          we need a connector that goes UP and RIGHT.
                          
                          CSS will handle the shapes based on classes.
                      */}
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
