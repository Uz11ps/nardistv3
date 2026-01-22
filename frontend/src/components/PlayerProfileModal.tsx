import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { apiClient } from '../api/client'
import Icon from './Icon'
import PlayerName from './PlayerName'

interface PlayerProfileModalProps {
  isOpen: boolean
  player: any
  onClose: () => void
}

export default function PlayerProfileModal({ isOpen, player, onClose }: PlayerProfileModalProps) {
  const [playerStats, setPlayerStats] = useState<any>(null)
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false)
  const [statsModeFilter, setStatsModeFilter] = useState<'all' | 'short' | 'long'>('all')
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)

  useEffect(() => {
    if (isOpen && player?.id) {
      setSelectedPlayer(player)
      setStatsModeFilter('all')
      loadPlayerInfo()
    }
  }, [isOpen, player])

  useEffect(() => {
    if (isOpen && selectedPlayer?.id) {
      loadPlayerStats(selectedPlayer.id, statsModeFilter)
    }
  }, [statsModeFilter, isOpen, selectedPlayer?.id])

  const loadPlayerInfo = async () => {
    if (!player?.id) return
    
    try {
      const userResponse = await apiClient.get(`/users/${player.id}`).catch(() => ({ data: null }))
      setSelectedPlayer(userResponse.data || player)
    } catch (error) {
      console.error('Failed to load player info:', error)
    }
  }

  const loadPlayerStats = async (playerId: string, mode: 'all' | 'short' | 'long' = statsModeFilter) => {
    setLoadingPlayerStats(true)
    try {
      const params = new URLSearchParams()
      if (mode !== 'all') {
        params.append('mode', mode)
      }
      
      const statsResponse = await apiClient.get(`/games/statistics/${playerId}${params.toString() ? '?' + params.toString() : ''}`).catch(() => ({ data: null }))
      setPlayerStats(statsResponse.data)
    } catch (error) {
      console.error('Failed to load player stats:', error)
    } finally {
      setLoadingPlayerStats(false)
    }
  }

  if (!isOpen || !selectedPlayer) return null

  return createPortal(
    <div className="game-player-modal-overlay" onClick={onClose}>
      <div className="game-player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="game-player-modal-header">
          <h3 className="game-player-modal-title">Профиль игрока</h3>
          <button className="game-player-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="game-player-modal-content">
          {/* Аватар и основная информация */}
          <div className="game-player-modal-profile">
            <div className="game-player-modal-avatar">
              {selectedPlayer?.avatarUrl ? (
                <img src={selectedPlayer.avatarUrl} alt={selectedPlayer.username} />
              ) : (
                <Icon name="user" size={80} />
              )}
            </div>
            <div className="game-player-modal-name">
              <PlayerName 
                nickname={selectedPlayer?.nickname}
                username={selectedPlayer?.username}
                hasPremium={selectedPlayer?.hasPremium}
                fallback="Игрок"
              />
            </div>
            {selectedPlayer?.username && selectedPlayer?.nickname && (
              <div className="game-player-modal-username">@{selectedPlayer.username}</div>
            )}
            <div className="game-player-modal-level">
              Уровень {selectedPlayer?.level || 0}
            </div>
          </div>

          {/* Фильтры статистики */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#FFF', fontSize: '16px', fontWeight: '600', marginBottom: '12px', marginTop: 0 }}>Режим:</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className={`filter-btn ${statsModeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatsModeFilter('all')}
                style={{ padding: '8px 16px', fontSize: '14px', background: statsModeFilter === 'all' ? '#2a2a2a' : '#3a3a3a', border: `1px solid ${statsModeFilter === 'all' ? '#FFF' : '#4a4a4a'}`, borderRadius: '8px', color: statsModeFilter === 'all' ? '#FFF' : '#B6B6B6', cursor: 'pointer' }}
              >
                Все
              </button>
              <button
                className={`filter-btn ${statsModeFilter === 'long' ? 'active' : ''}`}
                onClick={() => setStatsModeFilter('long')}
                style={{ padding: '8px 16px', fontSize: '14px', background: statsModeFilter === 'long' ? '#2a2a2a' : '#3a3a3a', border: `1px solid ${statsModeFilter === 'long' ? '#FFF' : '#4a4a4a'}`, borderRadius: '8px', color: statsModeFilter === 'long' ? '#FFF' : '#B6B6B6', cursor: 'pointer' }}
              >
                Длинные
              </button>
              <button
                className={`filter-btn ${statsModeFilter === 'short' ? 'active' : ''}`}
                onClick={() => setStatsModeFilter('short')}
                style={{ padding: '8px 16px', fontSize: '14px', background: statsModeFilter === 'short' ? '#2a2a2a' : '#3a3a3a', border: `1px solid ${statsModeFilter === 'short' ? '#FFF' : '#4a4a4a'}`, borderRadius: '8px', color: statsModeFilter === 'short' ? '#FFF' : '#B6B6B6', cursor: 'pointer' }}
              >
                Короткие
              </button>
            </div>
          </div>

          {/* Статистика */}
          {loadingPlayerStats ? (
            <div className="game-player-modal-loading">Загрузка статистики...</div>
          ) : playerStats ? (
            <div className="game-player-modal-stats">
              <div className="game-player-modal-stats-section">
                <div className="game-player-modal-stats-title">
                  {statsModeFilter === 'all' ? 'Общая статистика' : 
                   statsModeFilter === 'long' ? 'Длинные нарды' : 
                   'Короткие нарды'}
                </div>
                <div className="game-player-modal-stats-item">
                  <span className="game-player-modal-stats-label">Матчей:</span>
                  <span className="game-player-modal-stats-value">{playerStats.totalMatches || playerStats.matches || 0}</span>
                </div>
                <div className="game-player-modal-stats-item">
                  <span className="game-player-modal-stats-label">Побед:</span>
                  <span className="game-player-modal-stats-value" style={{ color: '#4CAF50' }}>{playerStats.wins || 0}</span>
                </div>
                <div className="game-player-modal-stats-item">
                  <span className="game-player-modal-stats-label">Поражений:</span>
                  <span className="game-player-modal-stats-value" style={{ color: '#E84142' }}>{playerStats.losses || 0}</span>
                </div>
                <div className="game-player-modal-stats-item">
                  <span className="game-player-modal-stats-label">Винрейт:</span>
                  <span className="game-player-modal-stats-value" style={{ color: '#FFD700', fontWeight: '600', fontSize: '18px' }}>
                    {(() => {
                      const wins = playerStats.wins || 0
                      const losses = playerStats.losses || 0
                      const total = wins + losses
                      return total > 0 ? Math.round((wins / total) * 100) : (playerStats.winrate || 0)
                    })()}%
                  </span>
                </div>
                {statsModeFilter === 'all' && playerStats.overallRating !== undefined && (
                  <div className="game-player-modal-stats-item">
                    <span className="game-player-modal-stats-label">Общий рейтинг:</span>
                    <span className="game-player-modal-stats-value" style={{ color: '#4A9EFF', fontWeight: '600', fontSize: '18px' }}>
                      {playerStats.overallRating}
                    </span>
                  </div>
                )}
                {statsModeFilter === 'short' && playerStats.short?.rating !== undefined && (
                  <div className="game-player-modal-stats-item">
                    <span className="game-player-modal-stats-label">Рейтинг (короткие):</span>
                    <span className="game-player-modal-stats-value" style={{ color: '#4A9EFF', fontWeight: '600', fontSize: '18px' }}>
                      {playerStats.short.rating}
                    </span>
                  </div>
                )}
                {statsModeFilter === 'long' && playerStats.long?.rating !== undefined && (
                  <div className="game-player-modal-stats-item">
                    <span className="game-player-modal-stats-label">Рейтинг (длинные):</span>
                    <span className="game-player-modal-stats-value" style={{ color: '#4A9EFF', fontWeight: '600', fontSize: '18px' }}>
                      {playerStats.long.rating}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="game-player-modal-no-stats">Статистика недоступна</div>
          )}
        </div>

        <div className="game-player-modal-footer">
          <button
            className="game-player-modal-btn"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

