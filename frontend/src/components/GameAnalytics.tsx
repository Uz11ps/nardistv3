import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import { StarIcon, RobotIcon, ScaleIcon } from './Icons'
import './GameAnalytics.css'

interface GameAnalyticsProps {
  gameId: string
}

export default function GameAnalytics({ gameId }: GameAnalyticsProps) {
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)

  useEffect(() => {
    loadAnalysis()
  }, [gameId])

  const loadAnalysis = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/analysis/game/${gameId}`)
      setAnalysisData(response.data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка загрузки аналитики')
      console.error('Failed to load analysis:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportMat = () => {
    if (!analysisData) return;
    const text = analysisData.allMoves.map((m: any) => {
      const dice = m.move.dice?.join('') || '';
      const moves = m.move.moves?.map((mv: any) => `${mv.from}/${mv.to}`).join(' ') || '';
      return `${m.moveNumber}. ${dice} ${moves}`;
    }).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${gameId}.mat`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="game-analytics-loading-v2">Загрузка подробной аналитики...</div>
  }

  if (error) {
    return <div className="game-analytics-error-v2">{error}</div>
  }

  if (!analysisData || !analysisData.allMoves) {
    return <div className="game-analytics-error-v2">Данные аналитики отсутствуют</div>
  }

  return (
    <div className="game-analytics-v2">
      <div className="analysis-header-v2">
        <div className="analysis-title-row">
          <h2>Аналитика матча</h2>
          <div className="analysis-icons">
            <div className="analysis-icon" onClick={handleExportMat} title="Экспорт в .mat">M</div>
            <div className="analysis-icon" onClick={loadAnalysis} title="Обновить">↻</div>
          </div>
        </div>
      </div>

      <div className="analysis-main-content">
        <div className="analysis-moves-grid">
          {analysisData.allMoves.reduce((acc: any[], move: any, idx: number) => {
            if (idx % 2 === 0) {
              acc.push([move]);
            } else {
              acc[acc.length - 1].push(move);
            }
            return acc;
          }, []).map((pair: any[], idx: number) => {
            const move1 = pair[0];
            const move2 = pair[1];
            return (
              <div key={idx} className="analysis-move-row-mat">
                <span className="move-num">{idx + 1}.</span>
                <div 
                  className={`move-item ${selectedMoveIndex === idx * 2 ? 'selected' : ''} ${move1.isError ? 'error-' + move1.errorType : ''} ${move1.isBestMove ? 'best-move' : ''}`}
                  onClick={() => setSelectedMoveIndex(idx * 2)}
                  title={move1.isBestMove ? 'Лучший ход!' : (move1.isError ? `${move1.errorDescription || ''}` : '')}
                >
                  {move1.isBestMove && <span className="best-move-badge"><img src="/img/crown.png" alt="best" style={{ width: '16px', height: '16px', objectFit: 'contain' }} /></span>}
                  <span className="move-dice">({move1.move.dice?.join('')})</span>
                  <span className="move-text">
                    {move1.move.moves?.map((m: any, i: number) => (
                      <span key={i}>{m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}{i < move1.move.moves.length - 1 ? ' ' : ''}</span>
                    )) || 'no move'}
                  </span>
                </div>
                {move2 && (
                  <div 
                    className={`move-item ${selectedMoveIndex === idx * 2 + 1 ? 'selected' : ''} ${move2.isError ? 'error-' + move2.errorType : ''} ${move2.isBestMove ? 'best-move' : ''}`}
                    onClick={() => setSelectedMoveIndex(idx * 2 + 1)}
                    title={move2.isBestMove ? 'Лучший ход!' : (move2.isError ? `${move2.errorDescription || ''}` : '')}
                  >
                    {move2.isBestMove && (
                      <span className="best-move-badge">
                        <img src="/img/crown.png" alt="best" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                      </span>
                    )}
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

        {selectedMoveIndex !== null && (
          <div className="analysis-move-details-v2">
            {(() => {
              const item = analysisData.allMoves[selectedMoveIndex];
              
              return (
                <>
                  {/* Отображение equity и вероятностей */}
                  {(item.equity !== undefined || item.winProbabilities) && (
                    <div className="probs-table" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      marginBottom: '16px',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                    }}>
                      {item.winProbabilities && (
                        <>
                          <div className="prob-col"><span>Win</span><strong>{item.winProbabilities.win.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Win G</span><strong>{item.winProbabilities.winG.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Win BG</span><strong>{item.winProbabilities.winBG.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Lose G</span><strong>{item.winProbabilities.loseG.toFixed(3)}</strong></div>
                          <div className="prob-col"><span>Lose BG</span><strong>{item.winProbabilities.loseBG.toFixed(3)}</strong></div>
                        </>
                      )}
                      {item.equity !== undefined && (
                        <div className="prob-col equity"><span>Equity</span><strong>{item.equity.toFixed(3)}</strong></div>
                      )}
                      {item.scoreChange !== undefined && item.scoreChange !== 0 && (
                        <div className="prob-col" style={{
                          gridColumn: 'span 3',
                          color: item.scoreChange > 0 ? '#E84142' : '#4CAF50'
                        }}>
                          <span>Изменение equity</span>
                          <strong>{item.scoreChange > 0 ? '+' : ''}{item.scoreChange.toFixed(3)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Отображение ошибки */}
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
                        <div style={{ fontSize: '13px', color: '#B6B6B6', lineHeight: '1.5' }}>
                          {item.errorDescription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Лучший ход */}
                  {item.bestMove && (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(76, 175, 80, 0.1)',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      border: '1px solid rgba(76, 175, 80, 0.3)'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#4CAF50'
                      }}>
                        Лучший ход:
                      </div>
                      <div style={{ fontSize: '13px', color: '#FFF' }}>
                        {Array.isArray(item.bestMove) 
                          ? item.bestMove.map((m: any, i: number) => (
                              <span key={i}>
                                {i > 0 ? ' ' : ''}
                                {m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}
                              </span>
                            ))
                          : item.bestMove}
                      </div>
                    </div>
                  )}

                  {/* Альтернативные ходы */}
                  {item.alternatives && item.alternatives.length > 0 && (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#FFF'
                      }}>
                        Альтернативные ходы:
                      </div>
                      <div className="alternatives-table-v2">
                        {item.alternatives.map((alt: any, aIdx: number) => (
                          <div key={aIdx} className="alt-row">
                            <div className="alt-move">
                              <span className="alt-dice">({item.move.dice?.join('')})</span>
                              {alt.moves?.length > 0 ? alt.moves.map((m: any, i: number) => (
                                <span key={i}>
                                  {m.from === -1 ? 'bar' : m.from}/{m.to === -1 || m.to >= 24 ? 'off' : m.to}
                                  {i < alt.moves.length - 1 ? ' ' : ''}
                                </span>
                              )) : 'no move'}
                            </div>
                            <div className="alt-equity">
                              {alt.equity.toFixed(3)} ({alt.diff > 0 ? '+' : ''}{alt.diff.toFixed(3)})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
        
        {selectedMoveIndex === null && (
          <div className="analysis-summary-v2">
            <div className="summary-title">Общая статистика матча</div>
            <div className="summary-stats">
              <div className="summary-stat"><span>Грубых:</span> <strong style={{ color: '#E84142' }}>{analysisData.blunders}</strong></div>
              <div className="summary-stat"><span>Ошибок:</span> <strong style={{ color: '#FF9800' }}>{analysisData.mistakes}</strong></div>
              <div className="summary-stat"><span>Неточностей:</span> <strong style={{ color: '#FFD600' }}>{analysisData.inaccuracies}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
