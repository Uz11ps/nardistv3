import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import './SandboxControls.css'

interface SandboxControlsProps {
  gameId: string
  gameState: any
  currentPlayer: number
  onBoardUpdate: () => void
  onHistoryPreview?: (gameState: any | null) => void
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
  onHistoryPreview 
}: SandboxControlsProps) {
  const [mode, setMode] = useState<'setup' | 'play'>('setup')
  const [showPanel, setShowPanel] = useState(false)
  const [chapters, setChapters] = useState<SandboxChapter[]>([])
  const [moves, setMoves] = useState<GameMove[]>([])
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  
  // Manual dice state
  const [dice1, setDice1] = useState(1)
  const [dice2, setDice2] = useState(1)
  const [showDiceModal, setShowDiceModal] = useState(false)
  const [diceQueue, setDiceQueue] = useState<number[][]>([])

  // Auto-show dice modal in play mode if no dice
  useEffect(() => {
    if (mode === 'play' && (!gameState.dice || (Array.isArray(gameState.dice) && gameState.dice.length === 0)) && !showDiceModal) {
      if (diceQueue.length > 0) {
        // Use next dice from queue
        const nextDice = diceQueue[0]
        setDiceQueue(prev => prev.slice(1))
        applyDice(nextDice[0], nextDice[1])
      } else {
        setShowDiceModal(true)
      }
    }
  }, [mode, gameState.dice, diceQueue])

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

  const applyDice = async (d1: number, d2: number) => {
    try {
      await apiClient.post(`/games/${gameId}/sandbox/set-dice`, {
        dice: [d1, d2],
        player: currentPlayer,
      })
      setShowDiceModal(false)
      onBoardUpdate()
      loadMoves()
    } catch (e) {
      alert('Ошибка при установке кубиков')
    }
  }

  const handleSetDice = () => {
    applyDice(dice1, dice2)
  }

  const handleAddToQueue = () => {
    setDiceQueue(prev => [...prev, [dice1, dice2]])
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
            onHistoryPreview?.(null)
            setSelectedMoveIndex(null)
          }}
        >
          <span>✏️</span> Расстановка
        </button>
        <button 
          className={`mode-btn ${mode === 'play' ? 'active' : ''}`}
          onClick={() => setMode('play')}
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
                  <span className="move-dice">[{move.dice.join(',')}]</span>
                  <span className="move-details">
                    {move.moves.map((m, i) => (
                      <span key={i} className="move-step">
                        {m.from === -1 ? 'B' : m.from + 1}→{m.to === -1 ? 'B' : m.to + 1}
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
              </div>
            </div>
          )}
        </div>
      )}

      {showDiceModal && (
        <div className="dice-modal-overlay">
          <div className="dice-modal">
            <h3>Укажите значения кубиков</h3>
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
