import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
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
    
    // Если есть currentGameState из сервера, используем его
    if (replayData.currentGameState) {
      return convertGameStateForBoard(replayData.currentGameState)
    }
    
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

  const handleReplayStep = async (step: number) => {
    if (!selectedGame || !replayData) return
    const maxStep = replayData.moves?.length || selectedGame.moves.length
    const newStep = Math.max(0, Math.min(maxStep, replayStep + step))
    setReplayStep(newStep)
    
    // Загружаем состояние для нового шага с сервера
    try {
      const response = await apiClient.get(`/history/replay/${selectedGame.id}?step=${newStep}`)
      if (response.data && response.data.currentGameState) {
        // Обновляем replayData с новым состоянием
        setReplayData({
          ...replayData,
          currentGameState: response.data.currentGameState,
          currentStep: newStep,
        })
      }
    } catch (error) {
      console.error('Failed to load replay step:', error)
    }
  }

  const handleReplayStepChange = async (newStep: number) => {
    if (!selectedGame || !replayData) return
    const maxStep = replayData.moves?.length || selectedGame.moves.length
    const step = Math.max(0, Math.min(maxStep, newStep))
    setReplayStep(step)
    
    // Загружаем состояние для нового шага с сервера
    try {
      const response = await apiClient.get(`/history/replay/${selectedGame.id}?step=${step}`)
      if (response.data && response.data.currentGameState) {
        setReplayData({
          ...replayData,
          currentGameState: response.data.currentGameState,
          currentStep: step,
        })
      }
    } catch (error) {
      console.error('Failed to load replay step:', error)
    }
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
    <PageLayout title="История игр" showBack={true}>
      <div className="history-content">
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
            <div className="history-empty">
              Нет сыгранных игр
            </div>
          ) : (
            games.map((game) => (
              <div key={game.id} className="game-history-card">
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
                    <button className="history-action-btn history-action-btn-replay" onClick={() => handleReplay(game)}>
                      Реплей
                    </button>
                    {hasPremium && (
                      <button 
                        className="history-action-btn history-action-btn-analyze"
                        onClick={() => handleAnalyze(game.id)}
                        disabled={loadingAnalysis}
                      >
                        Анализ
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
                  <div key={idx} className="history-error-card" style={{ marginBottom: '8px', padding: '12px' }}>
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
                  </div>
                ))}
              </div>
            )}
            
            {analysisData.recommendations && analysisData.recommendations.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div className="card-title" style={{ marginBottom: '12px' }}>Рекомендации:</div>
                {analysisData.recommendations.map((rec: string, idx: number) => (
                  <div key={idx} className="history-recommendation-card" style={{ marginBottom: '8px', padding: '12px' }}>
                    <div className="card-subtitle">• {rec}</div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button 
                className="history-modal-close-btn"
                onClick={() => setAnalysisData(null)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#3a3a3a', color: '#FFF', border: 'none', cursor: 'pointer', fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: '16px', fontWeight: 600 }}
              >
                Закрыть
              </button>
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
                onClick={() => handleReplayStepChange(0)}
                disabled={replayStep === 0}
                title="В начало"
              >
                ⏮
              </button>
              <button
                className="replay-btn"
                onClick={() => handleReplayStep(-1)}
                disabled={replayStep === 0}
                title="Назад"
              >
                ⏪
              </button>
              
              {/* Слайдер для перемотки */}
              <div style={{ flex: 1, margin: '0 16px', display: 'flex', alignItems: 'center' }}>
                <input
                  type="range"
                  min="0"
                  max={replayData?.moves?.length || selectedGame.moves.length || 0}
                  value={replayStep}
                  onChange={(e) => handleReplayStepChange(parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
              </div>
              
              <button
                className="replay-btn"
                onClick={() => handleReplayStep(1)}
                disabled={replayStep >= (replayData?.moves?.length || selectedGame.moves.length)}
                title="Вперед"
              >
                ⏩
              </button>
              <button
                className="replay-btn"
                onClick={() => handleReplayStepChange(replayData?.moves?.length || selectedGame.moves.length)}
                disabled={replayStep >= (replayData?.moves?.length || selectedGame.moves.length)}
                title="В конец"
              >
                ⏭
              </button>
            </div>
            
            {/* Информация о текущем ходе */}
            {replayData?.moves && replayData.moves[replayStep - 1] && (
              <div style={{ 
                padding: '12px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '8px',
                marginTop: '12px',
                fontSize: '14px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Ход {replayStep}:</strong> {replayData.moves[replayStep - 1].player.username}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  Кубики: {replayData.moves[replayStep - 1].dice?.join(', ') || 'N/A'}
                </div>
                {replayData.moves[replayStep - 1].moves && replayData.moves[replayStep - 1].moves.length > 0 && (
                  <div>
                    Ходы: {replayData.moves[replayStep - 1].moves.map((m: any, idx: number) => (
                      <span key={idx}>
                        {idx > 0 ? ', ' : ''}
                        {m.from === -1 ? 'бар' : m.from} → {m.to === -1 ? 'вынос' : m.to >= 24 ? 'вынос' : m.to}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Аналитика для премиум пользователей */}
                {hasPremium && analysisData && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    {analysisData.errors
                      .filter((error: any) => error.moveNumber === replayStep)
                      .map((error: any, idx: number) => (
                        <div key={idx} style={{
                          padding: '8px',
                          background: error.errorType === 'blunder' ? 'rgba(255, 51, 51, 0.2)' :
                                     error.errorType === 'mistake' ? 'rgba(255, 136, 51, 0.2)' :
                                     'rgba(255, 170, 51, 0.2)',
                          borderRadius: '4px',
                          marginTop: '8px'
                        }}>
                          <div style={{ 
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: error.errorType === 'blunder' ? '#ff3333' :
                                   error.errorType === 'mistake' ? '#ff8833' : '#ffaa33'
                          }}>
                            {error.errorType === 'blunder' ? '⚠️ Грубая ошибка' :
                             error.errorType === 'mistake' ? '⚠️ Ошибка' : '⚠️ Неточность'}
                          </div>
                          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.9 }}>
                            {error.errorDescription}
                          </div>
                          {error.scoreChange && (
                            <div style={{ fontSize: '11px', marginTop: '4px', color: '#ff3333' }}>
                              Упущено: {error.scoreChange.toFixed(1)} очков
                            </div>
                          )}
                          {error.bestMove && error.bestMove.length > 0 && (
                            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                              Лучший ход: {error.bestMove.map((m: any, i: number) => (
                                <span key={i}>
                                  {i > 0 ? ', ' : ''}
                                  {m.from === -1 ? 'бар' : m.from} → {m.to === -1 ? 'вынос' : m.to >= 24 ? 'вынос' : m.to}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
