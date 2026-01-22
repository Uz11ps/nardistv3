import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import BackgammonBoard from '../components/BackgammonBoard'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatRelativeTime } from '../utils/dateUtils'
import { StarIcon, RobotIcon, DownloadIcon, RefreshIcon, BookIcon, ScaleIcon, WarningIcon, TrophyIcon, XIcon } from '../components/Icons'
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
  updatedAt?: string
  finishedAt?: string
  moves: any[]
  moveCount: number
  winnerId?: string | null
  stake?: number
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const timezone = user?.timezone || 'Europe/Moscow'
  const [games, setGames] = useState<GameHistory[]>([])
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses' | 'bot' | 'players_only'>('all')
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
  const [selectedGameDetails, setSelectedGameDetails] = useState<GameHistory | null>(null)
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  useEffect(() => {
    checkPremium()
  }, [])

  useEffect(() => {
    if (hasPremium !== undefined) {
      loadHistory()
    }
  }, [filter, modeFilter, hasPremium])

  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status')
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }
  
  const handleAnalyze = async (gameId: string) => {
    if (!hasPremium) {
      setShowPremiumModal(true)
      return
    }
    
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
      if (filter !== 'all') {
        if (filter === 'players_only') {
          params.append('type', 'vs_player')
        } else {
          params.append('result', filter)
        }
      }
      if (modeFilter !== 'all') params.append('mode', modeFilter)

      const response = await apiClient.get(`/history?${params.toString()}`)
      let allGames = response.data || []
      
      // Если фильтр players_only, дополнительно фильтруем на клиенте (на случай если бэкенд не поддерживает)
      if (filter === 'players_only') {
        allGames = allGames.filter((game: GameHistory) => game.type === 'vs_player' || game.type === 'tournament')
      }
      
      // Без премиума показываем только 5 последних матчей
      if (!hasPremium) {
        setGames(allGames.slice(0, 5))
      } else {
        setGames(allGames)
      }
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
    if (!seconds || seconds === 0) return '0:00'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
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
              <button
                className={`filter-btn ${filter === 'players_only' ? 'active' : ''}`}
                onClick={() => setFilter('players_only')}
              >
                Только с игроками
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
            games.map((game) => {
              // Исправляем логику результата: для игр с ботом, если winnerId null, это loss (бот победил)
              const displayResult = game.result === 'draw' && game.type === 'vs_bot' && !game.winnerId 
                ? 'loss' 
                : game.result;
              
              return (
                <Card
                  key={game.id} 
                  className="game-history-card"
                  onClick={() => setSelectedGameDetails(game)}
                >
                  <div className="game-history-card-content">
                    <div className={`result-badge ${displayResult}`}>
                      {displayResult === 'win' ? (
                        <TrophyIcon size={24} style={{ color: '#FFD700' }} />
                      ) : displayResult === 'loss' ? (
                        <span style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1' }}>✕</span>
                      ) : (
                        <span style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1' }}>＝</span>
                      )}
                    </div>
                    <div className="game-history-card-main">
                      <div className="game-history-card-header">
                        <span className="card-title game-history-opponent-name">
                          {game.type === 'vs_bot' ? (
                            <>
                              <RobotIcon size={16} style={{ marginRight: '4px', verticalAlign: 'middle', flexShrink: 0 }} /> Бот
                            </>
                          ) : (
                            game.opponent.username
                          )}
                        </span>
                      </div>
                      <div className="card-subtitle">
                        {formatRelativeTime(game.createdAt, timezone)} • {formatDuration(game.duration)}
                      </div>
                      <div className="card-subtitle" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Счет: {game.score.player1}:{game.score.player2}</span>
                        <span>•</span>
                        <span>{game.moveCount} ходов</span>
                        <span>•</span>
                        <span className="mode-badge" style={{ fontSize: '11px', padding: '2px 6px' }}>{game.mode === 'long' ? 'Длинные' : 'Короткие'}</span>
                      </div>
                    </div>
                    <div className="game-history-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="history-action-btn history-action-btn-replay" onClick={() => handleReplay(game)}>
                        Реплей
                      </button>
                      {hasPremium ? (
                      <button 
                        className="history-action-btn history-action-btn-analyze"
                        onClick={() => handleAnalyze(game.id)}
                        disabled={loadingAnalysis}
                      >
                        Анализ
                      </button>
                      ) : (
                        <button 
                          className="history-action-btn history-action-btn-analyze"
                          onClick={() => setShowPremiumModal(true)}
                          disabled={false}
                          style={{ opacity: 0.5, cursor: 'pointer' }}
                        >
                          Анализ
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Модальное окно анализа */}
      {analysisData && createPortal(
        <div 
          onClick={() => { setAnalysisData(null); setSelectedAnalysisMoveIndex(null); }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div className="analysis-modal-v2" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
            <div className="analysis-header-v2">
              <div className="analysis-title-row">
                <h2>Analysis</h2>
                <div className="analysis-icons">
                  <span className="analysis-icon" onClick={handleExportMAT} title="Скачать MAT">
                    <DownloadIcon size={18} style={{ color: '#707579' }} />
                  </span>
                  <span className="analysis-icon" onClick={() => {
                    if (hasPremium) {
                      handleAnalyze(selectedGame!.id)
                    } else {
                      setShowPremiumModal(true)
                    }
                  }}>
                    <RefreshIcon size={18} style={{ color: '#707579' }} />
                  </span>
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
                        className={`move-item ${selectedAnalysisMoveIndex === idx ? 'selected' : ''} ${move1.isError ? 'error-' + move1.errorType : ''} ${move1.isBestMove ? 'best-move' : ''}`}
                        onClick={() => setSelectedAnalysisMoveIndex(idx)}
                        title={move1.isBestMove ? 'Лучший ход!' : (move1.isError ? `${move1.errorDescription || ''}${move1.bestMove ? ' Лучший ход: ' + move1.bestMove.map((m: any) => `${m.from === -1 ? 'bar' : m.from}/${m.to === -1 || m.to >= 24 ? 'off' : m.to}`).join(' ') : ''}` : '')}
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
                          className={`move-item ${selectedAnalysisMoveIndex === idx + 1 ? 'selected' : ''} ${move2.isError ? 'error-' + move2.errorType : ''} ${move2.isBestMove ? 'best-move' : ''}`}
                          onClick={() => setSelectedAnalysisMoveIndex(idx + 1)}
                          title={move2.isBestMove ? 'Лучший ход!' : (move2.isError ? `${move2.errorDescription || ''}${move2.bestMove ? ' Лучший ход: ' + move2.bestMove.map((m: any) => `${m.from === -1 ? 'bar' : m.from}/${m.to === -1 || m.to >= 24 ? 'off' : m.to}`).join(' ') : ''}` : '')}
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

                        {/* Отображение ошибки и лучшего хода */}
                        {item.isError && (
                          <div className="analysis-error-info" style={{
                            padding: '12px',
                            background: item.errorType === 'blunder' ? 'rgba(232, 65, 66, 0.15)' :
                                         item.errorType === 'mistake' ? 'rgba(255, 152, 0, 0.15)' :
                                         'rgba(255, 214, 0, 0.15)',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: `1px solid ${item.errorType === 'blunder' ? 'rgba(232, 65, 66, 0.3)' :
                                                    item.errorType === 'mistake' ? 'rgba(255, 152, 0, 0.3)' :
                                                    'rgba(255, 214, 0, 0.3)'}`
                          }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              marginBottom: '8px',
                              color: item.errorType === 'blunder' ? '#E84142' :
                                     item.errorType === 'mistake' ? '#FF9800' : '#FFD600'
                            }}>
                              {item.errorType === 'blunder' ? 'Грубая ошибка' :
                               item.errorType === 'mistake' ? 'Ошибка' : 'Неточность'}
                            </div>
                            {item.errorDescription && (
                              <div style={{ fontSize: '13px', color: '#B6B6B6', marginBottom: '8px' }}>
                                {item.errorDescription}
                              </div>
                            )}
                            {item.bestMove && item.bestMove.length > 0 && (
                              <div style={{ fontSize: '13px', color: '#FFF', marginTop: '8px' }}>
                                <span style={{ color: '#B6B6B6' }}>Лучший ход по equity: </span>
                                <span style={{ fontWeight: '600', color: '#4CAF50' }}>
                                  {item.bestMove.map((m: any, i: number) => (
                                    <span key={i}>
                                      {i > 0 ? ' ' : ''}
                                      {m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

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
        </div>,
        document.body
      )}

      {/* Модальное окно реплея */}
      {selectedGame && isReplaying && createPortal(
        <div 
          className="replay-overlay" 
          onClick={() => setIsReplaying(false)}
          style={{
            position: 'fixed',
            top: '0px',
            left: '0px',
            right: '0px',
            bottom: '0px',
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <WarningIcon size={14} style={{ color: 'inherit' }} />
                              {error.errorType === 'blunder' ? 'Грубая ошибка' :
                               error.errorType === 'mistake' ? 'Ошибка' : 'Неточность'}
                            </span>
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
        </div>,
        document.body
      )}

      {/* Модальное окно деталей игры */}
      {selectedGameDetails && createPortal(
        <div 
          className="history-game-details-overlay" 
          onClick={() => setSelectedGameDetails(null)}
        >
          <div className="history-game-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="history-game-details-header">
              <h3>Детали матча</h3>
              <button 
                className="history-game-details-close" 
                onClick={() => setSelectedGameDetails(null)}
              >
                ×
              </button>
            </div>
            <div className="history-game-details-content">
              <div className="history-game-details-section">
                {/* Результат - выделенный блок */}
                <div className="history-game-details-result-card">
                  <div className={`result-badge-large ${selectedGameDetails.result === 'draw' && selectedGameDetails.type === 'vs_bot' && !selectedGameDetails.winnerId ? 'loss' : selectedGameDetails.result}`}>
                    {(selectedGameDetails.result === 'draw' && selectedGameDetails.type === 'vs_bot' && !selectedGameDetails.winnerId ? 'loss' : selectedGameDetails.result) === 'win' ? (
                      <TrophyIcon size={32} style={{ color: '#FFD700' }} />
                    ) : (selectedGameDetails.result === 'draw' && selectedGameDetails.type === 'vs_bot' && !selectedGameDetails.winnerId ? 'loss' : selectedGameDetails.result) === 'loss' ? (
                      <span style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1' }}>✕</span>
                    ) : (
                      <span style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1' }}>＝</span>
                    )}
                  </div>
                  <div className="result-text">
                    <span className="result-title">
                      {(selectedGameDetails.result === 'draw' && selectedGameDetails.type === 'vs_bot' && !selectedGameDetails.winnerId ? 'loss' : selectedGameDetails.result) === 'win' ? 'Победа' : (selectedGameDetails.result === 'draw' && selectedGameDetails.type === 'vs_bot' && !selectedGameDetails.winnerId ? 'loss' : selectedGameDetails.result) === 'loss' ? 'Поражение' : 'Ничья'}
                    </span>
                    <span className="result-score">
                      {selectedGameDetails.score.player1}:{selectedGameDetails.score.player2}
                    </span>
                  </div>
                </div>

                {/* Основная информация - в две колонки */}
                <div className="history-game-details-grid">
                  <div className="history-game-details-item">
                    <div className="history-game-details-label">Против</div>
                    <div className="history-game-details-value">
                      {selectedGameDetails.type === 'vs_bot' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <RobotIcon size={20} style={{ color: '#B6B6B6' }} />
                          <span className="card-title">Бот</span>
                        </div>
                      ) : (
                        <span className="card-title">{selectedGameDetails.opponent.username}</span>
                      )}
                    </div>
                  </div>

                  <div className="history-game-details-item">
                    <div className="history-game-details-label">Режим</div>
                    <div className="history-game-details-value">
                      <span className="mode-badge" style={{ fontSize: '14px', padding: '6px 12px' }}>
                        {selectedGameDetails.mode === 'long' ? 'Длинные нарды' : 'Короткие нарды'}
                      </span>
                    </div>
                  </div>

                  <div className="history-game-details-item">
                    <div className="history-game-details-label">Ходов</div>
                    <div className="history-game-details-value">
                      <span className="card-title" style={{ fontSize: '18px', fontWeight: '600' }}>{selectedGameDetails.moveCount}</span>
                    </div>
                  </div>

                  <div className="history-game-details-item">
                    <div className="history-game-details-label">Длительность</div>
                    <div className="history-game-details-value">
                      <span className="card-title" style={{ fontSize: '18px', fontWeight: '600' }}>{formatDuration(selectedGameDetails.duration)}</span>
                    </div>
                  </div>

                  {selectedGameDetails.stake && selectedGameDetails.stake > 0 && (
                    <div className="history-game-details-item">
                      <div className="history-game-details-label">Ставка</div>
                      <div className="history-game-details-value">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src="/img/narCoin.png" alt="coin" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                          <span className="card-title" style={{ fontSize: '18px', fontWeight: '600', color: '#FFD700' }}>{selectedGameDetails.stake}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="history-game-details-item">
                    <div className="history-game-details-label">Начало игры</div>
                    <div className="history-game-details-value">
                      <span className="card-title" style={{ fontSize: '14px', fontWeight: '500' }}>
                        {new Date(selectedGameDetails.createdAt).toLocaleString('ru-RU', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: timezone
                        })}
                      </span>
                    </div>
                  </div>

                  {(selectedGameDetails.updatedAt || selectedGameDetails.finishedAt) && (
                    <div className="history-game-details-item">
                      <div className="history-game-details-label">Окончание игры</div>
                      <div className="history-game-details-value">
                        <span className="card-title" style={{ fontSize: '14px', fontWeight: '500' }}>
                          {new Date(selectedGameDetails.updatedAt || selectedGameDetails.finishedAt!).toLocaleString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: timezone
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="history-game-details-actions">
              <button 
                className="history-modal-close-btn"
                onClick={() => setSelectedGameDetails(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модальное окно премиум */}
      {showPremiumModal && createPortal(
        <div 
          className="analysis-modal-overlay" 
          onClick={() => setShowPremiumModal(false)}
        >
          <div className="modal analysis-modal-v2" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="analysis-header-v2">
              <div className="analysis-title-row">
                <h2>Премиум функция</h2>
                <button 
                  className="close-btn" 
                  onClick={() => setShowPremiumModal(false)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#333', fontSize: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="analysis-main-content" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👑</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '12px' }}>
                Анализ доступен только для премиум подписчиков
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '24px', lineHeight: '1.5' }}>
                Оформите премиум подписку, чтобы получить доступ к детальному анализу ваших игр
              </div>
              <button 
                onClick={() => {
                  setShowPremiumModal(false)
                  navigate('/shop', { state: { tab: 'subscription' } })
                }}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  background: 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)',
                  color: '#FFF',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '16px'
                }}
              >
                Перейти к подписке
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
