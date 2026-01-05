import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import BackgammonBoard from '../components/BackgammonBoard'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatRelativeTime } from '../utils/dateUtils'
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
  moveCount: number
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const timezone = user?.timezone || 'Europe/Moscow'
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
  const [selectedAnalysisMoveIndex, setSelectedAnalysisMoveIndex] = useState<number | null>(null)

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
      const game = games.find(g => g.id === gameId);
      if (game) setSelectedGame(game);
      
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
    
    // ВАЖНО: BackgammonBoard теперь ожидает points как массив чисел (-5 до 5)
    // а не массив объектов с checkers[]. Оставляем массив points как есть.
    const points = Array.isArray(gameState.points) ? [...gameState.points] : []
    
    return {
      ...gameState,
      points,
      bar: Array.isArray(gameState.bar) 
        ? { white: gameState.bar[0] || 0, black: gameState.bar[1] || 0 }
        : gameState.bar || { white: 0, black: 0 },
      bearOff: Array.isArray(gameState.borneOff)
        ? { white: gameState.borneOff[0] || 0, black: gameState.borneOff[1] || 0 }
        : (gameState.bearOff || { white: 0, black: 0 }),
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
    if (move && move.dice) {
      return move.dice // Теперь возвращаем массив как есть (может быть 2 или 4 кубика)
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


  const handleExportMAT = () => {
    if (!analysisData || !selectedGame) return;
    
    let mat = `"; [Site "NardGammon"]\n`;
    mat += `; [Variation "${selectedGame.mode === 'long' ? 'LongNarde' : 'ShortNarde'}"]\n`;
    mat += `; [Match ID "${selectedGame.id}"]\n`;
    mat += `; [Player 1 "${user?.username || 'Player 1'}"]\n`;
    mat += `; [Player 2 "${selectedGame.opponent.username || 'Bot'}"]\n`;
    mat += `; [Result "${selectedGame.score.player1}-${selectedGame.score.player2}"]\n\n`;
    
    analysisData.allMoves.forEach((item: any, idx: number) => {
      if (idx % 2 === 0) mat += `${Math.floor(idx / 2) + 1}) `;
      mat += `(${item.move.dice?.join('')}) `;
      mat += item.move.moves?.map((m: any) => `${m.from === -1 ? 'bar' : m.from}/${m.to === -1 || m.to >= 24 ? 'off' : m.to}`).join(' ') || 'no move';
      mat += (idx % 2 === 0) ? ' ' : '\n';
    });
    
    const blob = new Blob([mat], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${selectedGame.id}.mat`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                      {formatRelativeTime(game.createdAt, timezone)} • {formatDuration(game.duration)}
                    </div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      Счет: {game.score.player1}:{game.score.player2} • {game.moveCount} ходов
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
        <div className="modal-overlay" onClick={() => { setAnalysisData(null); setSelectedAnalysisMoveIndex(null); }}>
          <div className="modal analysis-modal-v2" onClick={(e) => e.stopPropagation()}>
            <div className="analysis-header-v2">
              <div className="analysis-title-row">
                <h2>Analysis</h2>
                <div className="analysis-icons">
                  <span className="analysis-icon" onClick={handleExportMAT} title="Скачать MAT">⬇️</span>
                  <span className="analysis-icon" onClick={() => handleAnalyze(selectedGame!.id)}>🔄</span>
                  <span className="analysis-icon">📚</span>
                  <span className="analysis-icon balance">⚖️</span>
                </div>
                <div className="analysis-game-selector">
                  Game 1 ▾
                </div>
              </div>
            </div>

            <div className="analysis-main-content">
              {/* История ходов в стиле MAT */}
              <div className="analysis-moves-grid">
                {analysisData.allMoves.map((item: any, idx: number) => {
                  // Показываем по 2 хода в строке (как в MAT формате)
                  if (idx % 2 !== 0) return null;
                  const move1 = item;
                  const move2 = analysisData.allMoves[idx + 1];
                  
                  return (
                    <div key={idx} className="analysis-move-row-mat">
                      <div className="move-num">{Math.floor(idx / 2) + 1})</div>
                      <div 
                        className={`move-item ${selectedAnalysisMoveIndex === idx ? 'selected' : ''} ${move1.isError ? 'error-' + move1.errorType : ''}`}
                        onClick={() => setSelectedAnalysisMoveIndex(idx)}
                      >
                        <span className="move-dice">({move1.move.dice?.join('')})</span>
                        <span className="move-text">
                          {move1.move.moves?.map((m: any, i: number) => (
                            <span key={i}>{m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}{i < move1.move.moves.length - 1 ? ' ' : ''}</span>
                          )) || 'no move'}
                        </span>
                      </div>
                      {move2 && (
                        <div 
                          className={`move-item ${selectedAnalysisMoveIndex === idx + 1 ? 'selected' : ''} ${move2.isError ? 'error-' + move2.errorType : ''}`}
                          onClick={() => setSelectedAnalysisMoveIndex(idx + 1)}
                        >
                          <span className="move-dice">({move2.move.dice?.join('')})</span>
                          <span className="move-text">
                            {move2.move.moves?.map((m: any, i: number) => (
                              <span key={i}>{m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}{i < move2.move.moves.length - 1 ? ' ' : ''}</span>
                            )) || 'no move'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Детали выбранного хода */}
              {selectedAnalysisMoveIndex !== null && (
                <div className="analysis-move-details-v2">
                  {(() => {
                    const item = analysisData.allMoves[selectedAnalysisMoveIndex];
                    const probs = item.winProbabilities || { win: 0.5, winG: 0, winBG: 0, loseG: 0, loseBG: 0 };
                    
                    return (
                      <>
                        <div className="probs-table">
                          <div className="prob-col"><span>Win</span><strong>{probs.win.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Win G</span><strong>{probs.winG.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Win BG</span><strong>{probs.winBG.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Lose G</span><strong>{probs.loseG.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Lose BG</span><strong>{probs.loseBG.toFixed(3)}</strong></div>
                          <div className="prob-col equity"><span>Equity</span><strong>{item.equity?.toFixed(3)}</strong></div>
                        </div>

                        <div className="analysis-actions-v2">
                          <button className="analysis-tab-btn active">Move</button>
                          <button className="analysis-tab-btn">Cube</button>
                          <div className="analysis-action-icons">
                            <span className="action-icon">🤖</span>
                            <span className="action-icon">⭐</span>
                          </div>
                        </div>

                        <div className="alternatives-table-v2">
                          {item.alternatives?.map((alt: any, aIdx: number) => (
                            <div key={aIdx} className={`alt-row ${alt.isCurrent ? 'current' : ''}`}>
                              <div className="alt-move">
                                <span className="alt-dice">({item.move.dice?.join('')})</span>
                                {alt.moves?.length > 0 ? alt.moves.map((m: any, i: number) => (
                                  <span key={i}>{m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}{i < alt.moves.length - 1 ? ' ' : ''}</span>
                                )) : 'no move'}
                              </div>
                              <div className="alt-equity">
                                {alt.equity.toFixed(3)} ({alt.diff > 0 ? '+' : ''}{alt.diff.toFixed(3)})
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              
              {!selectedAnalysisMoveIndex && (
                <div className="analysis-summary-v2">
                  <div className="summary-title">Результат игры: {analysisData.gameResult === 'win' ? 'Победа' : 'Поражение'}</div>
                  <div className="summary-stats">
                    <div className="summary-stat"><span>Грубых:</span> <strong style={{ color: '#E84142' }}>{analysisData.blunders}</strong></div>
                    <div className="summary-stat"><span>Ошибок:</span> <strong style={{ color: '#FF9800' }}>{analysisData.mistakes}</strong></div>
                    <div className="summary-stat"><span>Неточностей:</span> <strong style={{ color: '#FFD600' }}>{analysisData.inaccuracies}</strong></div>
                  </div>
                  {analysisData.recommendations?.length > 0 && (
                    <div className="summary-recommendations">
                      <h4>Рекомендации:</h4>
                      <ul>
                        {analysisData.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ padding: '16px' }}>
              <button 
                className="history-modal-close-btn"
                onClick={() => { setAnalysisData(null); setSelectedAnalysisMoveIndex(null); }}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#3a3a3a', color: '#FFF', border: 'none', cursor: 'pointer', fontWeight: 600 }}
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
                  gameId={selectedGame.id}
                  gameMode={selectedGame.mode}
                  player1Id={replayData?.game?.player1Id}
                  player2Id={replayData?.game?.player2Id}
                  player1Name={replayData?.game?.player1?.username || replayData?.game?.player1?.nickname}
                  player2Name={replayData?.game?.player2?.username || replayData?.game?.player2?.nickname || 'Бот'}
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
              <div className="replay-move-details">
                <div className="replay-move-header">
                  <div className="replay-move-player">
                    <strong>Ход {replayStep}:</strong> {replayData.moves[replayStep - 1].player.username}
                  </div>
                  <div className="replay-move-dice">
                    🎲 {replayData.moves[replayStep - 1].dice?.join(', ') || 'N/A'}
                  </div>
                </div>
                {replayData.moves[replayStep - 1].moves && replayData.moves[replayStep - 1].moves.length > 0 && (
                  <div className="replay-move-list">
                    {replayData.moves[replayStep - 1].moves.map((m: any, idx: number) => (
                      <div key={idx} className="replay-move-item">
                        {m.from === -1 ? 'бар' : m.from} → {m.to === -1 ? 'вынос' : m.to >= 24 ? 'вынос' : m.to}
                      </div>
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
