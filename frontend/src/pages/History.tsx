import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import BackgammonBoard from '../components/BackgammonBoard'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import './History.css'

interface GameHistory {
  id: string
  mode: 'short' | 'long'
  type: 'vs_player' | 'vs_bot' | 'tournament'
  opponent: {
    id: string
    username: string
    avatarUrl?: string
  }
  result: 'win' | 'loss' | 'draw'
  score: { player1: number; player2: number }
  duration: number
  createdAt: string
  moves: any[]
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [games, setGames] = useState<GameHistory[]>([])
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'bot'>('all')
  const [modeFilter, setModeFilter] = useState<'all' | 'short' | 'long'>('all')
  const [selectedGame, setSelectedGame] = useState<GameHistory | null>(null)
  const [replayData, setReplayData] = useState<any>(null)
  const [replayStep, setReplayStep] = useState(0)
  const [isReplaying, setIsReplaying] = useState(false)
  const [loadingReplay, setLoadingReplay] = useState(false)
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [hasPremium, setHasPremium] = useState(false)

  useEffect(() => {
    loadHistory()
    checkPremium()
  }, [filter, modeFilter])

  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status')
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }
  
  const handleAnalyze = async (gameId: string) => {
    try {
      setLoadingAnalysis(true)
      const response = await apiClient.get(`/analysis/game/${gameId}`)
      setAnalysisData(response.data)
    } catch (error: any) {
      console.error('Failed to analyze game:', error)
      alert(error.response?.data?.message || 'Ошибка анализа. Доступно только для премиум пользователей.')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.append('result', filter)
      if (modeFilter !== 'all') params.append('mode', modeFilter)

      const response = await apiClient.get(`/history?${params.toString()}`)
      setGames(response.data || [])
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const handleReplay = async (game: GameHistory) => {
    try {
      setLoadingReplay(true)
      setSelectedGame(game)
      setReplayStep(0)
      setIsReplaying(true)
      
      // Загружаем полные данные реплея
      const response = await apiClient.get(`/history/replay/${game.id}`)
      setReplayData(response.data)
    } catch (error) {
      console.error('Failed to load replay:', error)
      alert('Не удалось загрузить реплей игры')
      setIsReplaying(false)
    } finally {
      setLoadingReplay(false)
    }
  }
  
  // Преобразуем gameState из формата БД (points как числа) в формат для BackgammonBoard (points как объекты)
  const convertGameStateForBoard = (gameState: any) => {
    if (!gameState) return null
    
    const points = gameState.points || []
    const convertedPoints = points.map((pointValue: number, index: number) => {
      const checkers: number[] = []
      const absValue = Math.abs(pointValue)
      
      // Создаем массив checkers на основе значения точки
      for (let i = 0; i < absValue; i++) {
        checkers.push(pointValue > 0 ? 0 : 1) // 0 = белые, 1 = черные
      }
      
      return {
        index,
        checkers,
        color: pointValue > 0 ? 'white' : pointValue < 0 ? 'black' : null,
      }
    })
    
    return {
      ...gameState,
      points: convertedPoints,
      bar: Array.isArray(gameState.bar) 
        ? { white: gameState.bar[0] || 0, black: gameState.bar[1] || 0 }
        : gameState.bar || { white: 0, black: 0 },
      bearOff: Array.isArray(gameState.borneOff)
        ? { white: gameState.borneOff[0] || 0, black: gameState.borneOff[1] || 0 }
        : gameState.bearOff || { white: 0, black: 0 },
    }
  }
  
  // Получаем текущее состояние игры для отображения
  const getCurrentGameState = () => {
    if (!replayData || !replayData.game) return null
    
    const { game, moves } = replayData
    let currentState: any = null
    
    if (replayStep === 0) {
      // Начальное состояние
      currentState = game.initialGameState || game.gameState
    } else if (moves && moves[replayStep - 1]) {
      // Состояние после хода replayStep
      currentState = moves[replayStep - 1].gameStateAfter
    } else {
      currentState = game.initialGameState || game.gameState
    }
    
    // Преобразуем в формат для BackgammonBoard
    return convertGameStateForBoard(currentState)
  }
  
  // Определяем, кто ходит на текущем шаге
  const getCurrentPlayer = () => {
    if (!replayData || !replayData.game) return 0
    if (replayStep === 0) return 0
    
    const { moves } = replayData
    if (moves && moves[replayStep - 1]) {
      const move = moves[replayStep - 1]
      // После хода игрока, следующий ход противоположного игрока
      return move.player.id === replayData.game.player1.id ? 1 : 0
    }
    
    return 0
  }
  
  // Получаем кубики для текущего хода
  const getCurrentDice = () => {
    if (!replayData || !replayData.moves || replayStep === 0) return null
    
    const move = replayData.moves[replayStep - 1]
    if (move && move.dice && move.dice.length >= 2) {
      return { die1: move.dice[0], die2: move.dice[1] }
    }
    
    return null
  }

  const handleReplayStep = (step: number) => {
    if (!selectedGame) return
    const maxStep = selectedGame.moves.length
    const newStep = Math.max(0, Math.min(maxStep, replayStep + step))
    setReplayStep(newStep)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Сегодня'
    if (days === 1) return 'Вчера'
    if (days < 7) return `${days} дней назад`
    return date.toLocaleDateString('ru-RU')
  }

  return (
    <div className="app-container">
      <PageHeader title="История игр" />
      
      <div style={{ padding: '20px' }}>
        {/* Фильтры */}
        <div className="history-filters">
          <div className="filter-group">
            <div className="filter-label">Результат:</div>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Все
              </button>
              <button
                className={`filter-btn ${filter === 'wins' ? 'active' : ''}`}
                onClick={() => setFilter('wins')}
              >
                Победы
              </button>
              <button
                className={`filter-btn ${filter === 'losses' ? 'active' : ''}`}
                onClick={() => setFilter('losses')}
              >
                Поражения
              </button>
              <button
                className={`filter-btn ${filter === 'bot' ? 'active' : ''}`}
                onClick={() => setFilter('bot')}
              >
                С ботом
              </button>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-label">Режим:</div>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${modeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setModeFilter('all')}
              >
                Все
              </button>
              <button
                className={`filter-btn ${modeFilter === 'short' ? 'active' : ''}`}
                onClick={() => setModeFilter('short')}
              >
                Короткие
              </button>
              <button
                className={`filter-btn ${modeFilter === 'long' ? 'active' : ''}`}
                onClick={() => setModeFilter('long')}
              >
                Длинные
              </button>
            </div>
          </div>
        </div>

        {/* Список игр */}
        <div className="games-list">
          {games.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
                Нет сыгранных игр
              </div>
            </Card>
          ) : (
            games.map((game) => (
              <Card key={game.id} className="game-history-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className={`result-badge ${game.result}`}>
                    {game.result === 'win' ? '✓' : game.result === 'loss' ? '✗' : '='}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="card-title">
                        {game.type === 'vs_bot' ? '🤖 Бот' : game.opponent.username}
                      </span>
                      <span className="mode-badge">{game.mode === 'long' ? 'Длинные' : 'Короткие'}</span>
                    </div>
                    <div className="card-subtitle">
                      {formatDate(game.createdAt)} • {formatDuration(game.duration)}
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      Счет: {game.score.player1}:{game.score.player2}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => handleReplay(game)}>
                      Реплей
                    </Button>
                    {hasPremium && (
                      <Button 
                        variant="primary" 
                        onClick={() => handleAnalyze(game.id)}
                        disabled={loadingAnalysis}
                      >
                        Анализ
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Модальное окно анализа */}
      {analysisData && (
        <div className="modal-overlay" onClick={() => setAnalysisData(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-title">Анализ игры</div>
            <div className="modal-description">
              Найдено ошибок: {analysisData.errors.length} 
              ({analysisData.blunders} грубых, {analysisData.mistakes} ошибок, {analysisData.inaccuracies} неточностей)
            </div>
            
            {analysisData.errors.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div className="card-title" style={{ marginBottom: '12px' }}>Ошибки:</div>
                {analysisData.errors.slice(0, 10).map((error: any, idx: number) => (
                  <Card key={idx} style={{ marginBottom: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="card-title" style={{ fontSize: '14px' }}>
                          Ход {error.moveNumber}
                        </div>
                        <div className="card-subtitle" style={{ fontSize: '12px' }}>
                          {error.errorDescription}
                        </div>
                        {error.scoreChange && (
                          <div style={{ fontSize: '11px', color: '#ff3333', marginTop: '4px' }}>
                            Упущено: {error.scoreChange} очков
                          </div>
                        )}
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: error.errorType === 'blunder' ? '#ff3333' : 
                                   error.errorType === 'mistake' ? '#ff8833' : '#ffaa33',
                        color: '#fff'
                      }}>
                        {error.errorType === 'blunder' ? 'Грубая' : error.errorType === 'mistake' ? 'Ошибка' : 'Неточность'}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            {analysisData.recommendations && analysisData.recommendations.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div className="card-title" style={{ marginBottom: '12px' }}>Рекомендации:</div>
                {analysisData.recommendations.map((rec: string, idx: number) => (
                  <Card key={idx} style={{ marginBottom: '8px', padding: '12px' }}>
                    <div className="card-subtitle">• {rec}</div>
                  </Card>
                ))}
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <Button fullWidth variant="secondary" onClick={() => setAnalysisData(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно реплея */}
      {selectedGame && isReplaying && (
        <div className="replay-overlay" onClick={() => setIsReplaying(false)}>
          <div className="replay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="replay-header">
              <h3>Реплей игры</h3>
              <button className="close-btn" onClick={() => setIsReplaying(false)}>×</button>
            </div>
            <div className="replay-info">
              <div>
                Ход {replayStep} из {replayData?.moves?.length || selectedGame.moves.length}
                {replayData?.moves && replayData.moves[replayStep - 1] && (
                  <span style={{ marginLeft: '12px', color: '#ffffff' }}>
                    {replayData.moves[replayStep - 1].player.username}
                  </span>
                )}
              </div>
              <div>{selectedGame.mode === 'long' ? 'Длинные' : 'Короткие'} нарды</div>
            </div>
            <div className="replay-board">
              {loadingReplay ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
                  Загрузка реплея...
                </div>
              ) : replayData && getCurrentGameState() ? (
                <BackgammonBoard
                  gameState={getCurrentGameState()}
                  currentPlayer={getCurrentPlayer()}
                  dice={getCurrentDice()}
                  onMove={() => {}} // В реплее ходы не делаются
                  onRollDice={() => {}} // В реплее кубики не бросаются
                  canMove={false}
                  isMyTurn={false}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#aaaaaa' }}>
                  Нет данных для отображения
                </div>
              )}
            </div>
            <div className="replay-controls">
              <button
                className="replay-btn"
                onClick={() => setReplayStep(0)}
                disabled={replayStep === 0}
              >
                ⏮
              </button>
              <button
                className="replay-btn"
                onClick={() => handleReplayStep(-1)}
                disabled={replayStep === 0}
              >
                ⏪
              </button>
              <button
                className="replay-btn"
                onClick={() => handleReplayStep(1)}
                disabled={replayStep >= (replayData?.moves?.length || selectedGame.moves.length)}
              >
                ⏩
              </button>
              <button
                className="replay-btn"
                onClick={() => setReplayStep(replayData?.moves?.length || selectedGame.moves.length)}
                disabled={replayStep >= (replayData?.moves?.length || selectedGame.moves.length)}
              >
                ⏭
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
