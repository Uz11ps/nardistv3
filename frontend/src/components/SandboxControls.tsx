import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import './SandboxControls.css'

interface SandboxControlsProps {
  gameId: string
  gameState: any
  currentPlayer: number
  onBoardUpdate: () => void
  onHistoryPreview?: (gameState: any | null) => void
  onModeChange?: (mode: 'setup' | 'play') => void
}

interface SandboxChapter {
  id: string
  name: string
  gameState: any
}

interface GameMove {
  id: string
  moveNumber: number
  dice: number[]
  moves: any[]
  gameStateBefore: any
  gameStateAfter: any
  createdAt: string
}

export default function SandboxControls({ 
  gameId, 
  gameState, 
  currentPlayer, 
  onBoardUpdate,
  onHistoryPreview,
  onModeChange 
}: SandboxControlsProps) {
  const [mode, setMode] = useState<'setup' | 'play'>('setup')
  const [showPanel, setShowPanel] = useState(false)
  const [chapters, setChapters] = useState<SandboxChapter[]>([])
  const [moves, setMoves] = useState<GameMove[]>([])
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  
  // Manual dice state
  const [dice1, setDice1] = useState(1)
  const [dice2, setDice2] = useState(1)
  const [diceTargetPlayer, setDiceTargetPlayer] = useState<number | null>(null)
  const [showDiceModal, setShowDiceModal] = useState(false)
  const [diceQueue, setDiceQueue] = useState<number[][]>([])

  // Auto-show dice modal in play mode if no dice
  useEffect(() => {
    // В Sandbox режиме, если мы в режиме "play" и кубиков нет - показываем окно выбора
    const dice = gameState?.dice;
    const hasDice = !!dice && (Array.isArray(dice) ? dice.length > 0 : (dice.die1 !== undefined && dice.die1 !== null));
    
    // Показываем модалку только если мы в режиме игры, нет кубиков, модалка еще не открыта 
    // и мы НЕ просматриваем историю (selectedMoveIndex === null)
    if (mode === 'play' && !hasDice && !showDiceModal && selectedMoveIndex === null) {
      console.log('🎲 [SandboxControls] Auto-showing dice modal, current player:', currentPlayer);
      
      const timer = setTimeout(() => {
        // Повторная проверка через 100мс, чтобы избежать мерцания при быстрой смене состояния
        const currentDice = gameState?.dice;
        const stillNoDice = !currentDice || (Array.isArray(currentDice) ? currentDice.length === 0 : (currentDice.die1 === undefined || currentDice.die1 === null));
        
        if (stillNoDice) {
          if (diceQueue.length > 0) {
            // Use next dice from queue
            const nextDice = diceQueue[0]
            setDiceQueue(prev => prev.slice(1))
            applyDice(nextDice[0], nextDice[1])
          } else {
            // При автоматическом открытии модалки устанавливаем таргет на текущего игрока
            setDiceTargetPlayer(null)
            setShowDiceModal(true)
          }
        }
      }, 150)
      
      return () => clearTimeout(timer)
    }
  }, [mode, gameState?.dice, diceQueue, showDiceModal, currentPlayer, selectedMoveIndex])

  // Listen for turn change events to trigger dice modal check
  useEffect(() => {
    const handleTurnChange = (event: CustomEvent) => {
      console.log('🔄 [SandboxControls] Turn changed event received:', event.detail);
      // Если мы в режиме игры - принудительно проверяем состояние кубиков
      // Это гарантирует, что модалка покажется даже если основной useEffect не сработал
      if (mode === 'play' && selectedMoveIndex === null) {
        // Небольшая задержка, чтобы состояние успело обновиться после move_made
        setTimeout(() => {
          const currentDice = gameState?.dice;
          const hasDice = !!currentDice && (Array.isArray(currentDice) ? currentDice.length > 0 : (currentDice.die1 !== undefined && currentDice.die1 !== null));
          
          if (!hasDice && !showDiceModal) {
            console.log('🎲 [SandboxControls] Turn changed, no dice - showing modal for player:', event.detail?.currentPlayer ?? currentPlayer);
            if (diceQueue.length > 0) {
              const nextDice = diceQueue[0]
              setDiceQueue(prev => prev.slice(1))
              applyDice(nextDice[0], nextDice[1], event.detail?.currentPlayer ?? null)
            } else {
              // Устанавливаем таргет на игрока из события, если он указан
              setDiceTargetPlayer(event.detail?.currentPlayer !== undefined ? event.detail.currentPlayer : null)
              setShowDiceModal(true)
            }
          }
        }, 400);
      }
    };
    
    window.addEventListener('sandbox-turn-changed', handleTurnChange as EventListener);
    return () => window.removeEventListener('sandbox-turn-changed', handleTurnChange as EventListener);
  }, [mode, selectedMoveIndex, gameState?.dice, showDiceModal, diceQueue, currentPlayer])

  // Chapters logic
  useEffect(() => {
    loadChapters()
    loadMoves()
    
    // Listen for history updates
    const handleHistoryUpdate = () => {
      loadMoves()
    }
    window.addEventListener('sandbox-history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('sandbox-history-updated', handleHistoryUpdate)
  }, [gameId])

  const loadChapters = async () => {
    try {
      const res = await apiClient.get('/games/sandbox/chapters')
      setChapters(res.data)
    } catch (e) {
      console.error('Failed to load chapters', e)
    }
  }

  const loadMoves = async () => {
    if (!gameId) return
    try {
      const res = await apiClient.get(`/games/${gameId}/moves`)
      setMoves(res.data)
    } catch (e) {
      console.error('Failed to load moves', e)
    }
  }

  const handleSaveChapter = async () => {
    const name = prompt('Введите название главы:')
    if (!name) return
    try {
      await apiClient.post('/games/sandbox/chapters', {
        name,
        gameState
      })
      loadChapters()
      alert('Глава сохранена')
    } catch (e) {
      alert('Ошибка при сохранении')
    }
  }

  const handleLoadChapter = async (chapter: SandboxChapter) => {
    try {
      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, chapter.gameState)
      onBoardUpdate()
      setMode('setup')
      alert(`Глава "${chapter.name}" загружена`)
    } catch (e) {
      alert('Ошибка при загрузке главы')
    }
  }

  const handleDeleteChapter = async (id: string) => {
    if (!confirm('Удалить эту главу?')) return
    try {
      await apiClient.delete(`/games/sandbox/chapters/${id}`)
      loadChapters()
    } catch (e) {
      alert('Ошибка при удалении')
    }
  }

  const applyDice = async (d1: number, d2: number, playerIndex?: number | null) => {
    try {
      await apiClient.post(`/games/${gameId}/sandbox/set-dice`, {
        dice: [d1, d2],
        player: playerIndex !== null && playerIndex !== undefined ? playerIndex : currentPlayer,
      })
      setShowDiceModal(false)
      onBoardUpdate()
      loadMoves()
    } catch (e) {
      alert('Ошибка при установке кубиков')
    }
  }

  const handleSetDice = () => {
    applyDice(dice1, dice2, diceTargetPlayer)
  }

  const handleAddToQueue = () => {
    setDiceQueue(prev => [...prev, [dice1, dice2]])
    setShowDiceModal(false)
  }

  const handleSkipTurn = async () => {
    try {
      const nextPlayer = currentPlayer === 0 ? 1 : 0
      await apiClient.post(`/games/${gameId}/sandbox/set-dice`, {
        dice: [],
        player: nextPlayer,
      })
      onBoardUpdate()
    } catch (e) {
      alert('Ошибка при смене хода')
    }
  }

  const handleMoveClick = (index: number) => {
    if (selectedMoveIndex === index) {
      setSelectedMoveIndex(null)
      onHistoryPreview?.(null)
    } else {
      setSelectedMoveIndex(index)
      onHistoryPreview?.(moves[index].gameStateAfter)
    }
  }

  return (
    <div className="sandbox-studio">
      <div className="studio-toolbar">
        <button 
          className={`mode-btn ${mode === 'setup' ? 'active' : ''}`}
          onClick={() => {
            setMode('setup')
            onModeChange?.('setup')
            onHistoryPreview?.(null)
            setSelectedMoveIndex(null)
          }}
        >
          <span>✏️</span> Расстановка
        </button>
        <button 
          className={`mode-btn ${mode === 'play' ? 'active' : ''}`}
          onClick={() => {
            setMode('play')
            onModeChange?.('play')
          }}
        >
          <span>▶️</span> Интерактив
        </button>
        <button className="panel-toggle" onClick={() => setShowPanel(!showPanel)}>
          {showPanel ? 'Скрыть панель' : 'Студия'}
        </button>
      </div>

      {showPanel && (
        <div className="studio-panel">
          <div className="studio-section chapters-section">
            <div className="section-header">
              <h3>Главы</h3>
              <button onClick={handleSaveChapter} title="Сохранить текущую позицию">
                <span>+</span>
              </button>
            </div>
            <div className="chapters-list">
              {chapters.length === 0 && <div className="empty-msg">Нет сохраненных глав</div>}
              {chapters.map(chapter => (
                <div key={chapter.id} className="chapter-item">
                  <span onClick={() => handleLoadChapter(chapter)}>{chapter.name}</span>
                  <button onClick={() => handleDeleteChapter(chapter.id)}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="studio-section history-section">
            <h3>История ходов</h3>
            <div className="moves-list">
              {moves.length === 0 && <div className="empty-msg">Ходов пока нет</div>}
              {moves.map((move, idx) => (
                <div 
                  key={move.id} 
                  className={`move-item ${selectedMoveIndex === idx ? 'active' : ''}`}
                  onClick={() => handleMoveClick(idx)}
                >
                  <span className="move-num">{idx + 1}.</span>
                  <span className="move-dice">[{Array.isArray(move.dice) ? move.dice.join(',') : ''}]</span>
                  <span className="move-details">
                    {Array.isArray(move.moves) && move.moves.map((m, i) => (
                      <span key={i} className="move-step">
                        {(m as any).from === -1 ? 'B' : (m as any).from + 1}→{(m as any).to === -1 ? 'B' : (m as any).to + 1}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {mode === 'play' && (
            <div className="studio-section interactive-section">
              <h3>Интерактив</h3>
              <button className="dice-btn" onClick={() => setShowDiceModal(true)}>
                <span>🎲</span> Установить кубики
              </button>
              {diceQueue.length > 0 && (
                <div className="dice-queue">
                  <div className="queue-label">Очередь:</div>
                  {diceQueue.map((dq, idx) => (
                    <div key={idx} className="queue-item">
                      {dq[0]}:{dq[1]}
                      <button onClick={() => setDiceQueue(prev => prev.filter((_, i) => i !== idx))}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="turn-info">
                Сейчас ход: <strong>{currentPlayer === 0 ? 'Белых' : 'Черных'}</strong>
                <button className="skip-turn-btn" onClick={handleSkipTurn} title="Передать ход другому игроку">
                  <span>🔄</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showDiceModal && (
        <div className="dice-modal-overlay">
          <div className="dice-modal">
            <h3>Установите кубики для {
              diceTargetPlayer === 0 ? 'Белых' : 
              diceTargetPlayer === 1 ? 'Черных' : 
              (currentPlayer === 0 ? 'Белых' : 'Черных')
            }</h3>
            
            <div className="modal-section-label">Выбрать игрока:</div>
          <div className="player-selector">
            <button 
              className={diceTargetPlayer === 0 ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setDiceTargetPlayer(0); }}
              type="button"
            >
              Белые
            </button>
            <button 
              className={diceTargetPlayer === 1 ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setDiceTargetPlayer(1); }}
              type="button"
            >
              Черные
            </button>
            <button 
              className={diceTargetPlayer === null ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setDiceTargetPlayer(null); }}
              type="button"
            >
              Текущий
            </button>
          </div>

            <div className="modal-section-label">Значения:</div>
            <div className="dice-inputs">
              {[1, 2, 3, 4, 5, 6].map(val => (
                <button 
                  key={`d1-${val}`}
                  className={dice1 === val ? 'active' : ''}
                  onClick={() => setDice1(val)}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="dice-inputs">
              {[1, 2, 3, 4, 5, 6].map(val => (
                <button 
                  key={`d2-${val}`}
                  className={dice2 === val ? 'active' : ''}
                  onClick={() => setDice2(val)}
                >
                  {val}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowDiceModal(false)}>Отмена</button>
              <button className="queue-btn" onClick={handleAddToQueue}>В очередь</button>
              <button className="confirm-btn" onClick={handleSetDice}>Бросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
