import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
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
            <div className="analysis-icon balance">⚖️</div>
          </div>
          <div className="analysis-game-selector">
            Game 1 of 1
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
                  className={`move-item ${selectedMoveIndex === idx * 2 ? 'selected' : ''} ${move1.isError ? 'error-' + move1.errorType : ''}`}
                  onClick={() => setSelectedMoveIndex(idx * 2)}
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
                    className={`move-item ${selectedMoveIndex === idx * 2 + 1 ? 'selected' : ''} ${move2.isError ? 'error-' + move2.errorType : ''}`}
                    onClick={() => setSelectedMoveIndex(idx * 2 + 1)}
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

        {selectedMoveIndex !== null && (
          <div className="analysis-move-details-v2">
            {(() => {
              const item = analysisData.allMoves[selectedMoveIndex];
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
        
        {selectedMoveIndex === null && (
          <div className="analysis-summary-v2">
            <div className="summary-title">Общая статистика матча</div>
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
    </div>
  )
}
