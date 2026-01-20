import { useState, useEffect, useRef } from 'react'
import { apiClient } from '../api/client'
import './SandboxControls.css'

interface SandboxControlsProps {
  gameId: string
  gameState: any
  currentPlayer: number
  onBoardUpdate: () => void
  onHistoryPreview?: (gameState: any | null) => void
  onModeChange?: (mode: 'setup' | 'play') => void
  requireConfirmMove?: boolean
  onToggleConfirmMove?: () => void
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
  onModeChange,
  requireConfirmMove = false,
  onToggleConfirmMove
}: SandboxControlsProps) {
  const [mode, setMode] = useState<'setup' | 'play'>('setup')
  const [showMenu, setShowMenu] = useState(false)
  const [chapters, setChapters] = useState<SandboxChapter[]>([])
  const [moves, setMoves] = useState<GameMove[]>([])
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  
  // Manual dice state
  const [dice1, setDice1] = useState(1)
  const [dice2, setDice2] = useState(1)
  const [diceTargetPlayer, setDiceTargetPlayer] = useState<number | null>(null)
  const [showDiceModal, setShowDiceModal] = useState(false)
  const [diceQueue, setDiceQueue] = useState<number[][]>([])
  const [diceModalDismissed, setDiceModalDismissed] = useState(false)
  const [diceModalMode, setDiceModalMode] = useState<'set' | 'queue' | 'random'>('set')

  // Auto-show dice modal in play mode if no dice
  useEffect(() => {
    const dice = gameState?.dice;
    const hasDice = !!dice && (Array.isArray(dice) ? dice.length > 0 : (dice.die1 !== undefined && dice.die1 !== null));
    
    if (mode === 'play' && !hasDice && !showDiceModal && selectedMoveIndex === null && !diceModalDismissed) {
      console.log('🎲 [SandboxControls] Auto-showing dice modal, current player:', currentPlayer);
      
      const timer = setTimeout(() => {
        const currentDice = gameState?.dice;
        const stillNoDice = !currentDice || (Array.isArray(currentDice) ? currentDice.length === 0 : (currentDice.die1 === undefined || currentDice.die1 === null));
        
        if (stillNoDice) {
          if (diceQueue.length > 0) {
            const nextDice = diceQueue[0]
            setDiceQueue(prev => prev.slice(1))
            applyDice(nextDice[0], nextDice[1])
          } else {
            setDiceTargetPlayer(null)
            setShowDiceModal(true)
          }
        }
      }, 150)
      
      return () => clearTimeout(timer)
    }
  }, [mode, gameState?.dice, diceQueue, showDiceModal, currentPlayer, selectedMoveIndex])

  // Listen for turn change events
  useEffect(() => {
    const handleTurnChange = (event: CustomEvent) => {
      console.log('🔄 [SandboxControls] Turn changed event received:', event.detail);
      if (mode === 'play' && selectedMoveIndex === null) {
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
  const [initialChapterCreated, setInitialChapterCreated] = useState(false)
  const initialChapterCreatedRef = useRef(false)
  
  useEffect(() => {
    loadChapters()
    loadMoves()
    
    const handleHistoryUpdate = async () => {
      const moves = await loadMoves()
      
      if (!initialChapterCreatedRef.current && mode === 'play' && moves && moves.length > 0) {
        try {
          console.log('📖 [SandboxControls] Auto-creating initial chapter after first move');
          
          const initialGameState = {
            points: gameState?.points || Array(24).fill(0),
            bar: gameState?.bar || { white: 0, black: 0 },
            bearOff: gameState?.bearOff || { white: 0, black: 0 },
            currentPlayer: gameState?.currentPlayer || 0,
            dice: null,
            canMove: false
          };
          
          await apiClient.post('/games/sandbox/chapters', {
            name: 'Начальная позиция',
            gameState: initialGameState
          });
          
          initialChapterCreatedRef.current = true;
          setInitialChapterCreated(true);
          loadChapters();
          console.log('✅ [SandboxControls] Initial chapter created');
        } catch (e) {
          console.error('Failed to auto-create initial chapter', e);
        }
      }
    }
    window.addEventListener('sandbox-history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('sandbox-history-updated', handleHistoryUpdate)
  }, [gameId, mode])

  useEffect(() => {
    initialChapterCreatedRef.current = false
    setInitialChapterCreated(false)
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
    if (!gameId) return null
    try {
      const res = await apiClient.get(`/games/${gameId}/moves`)
      setMoves(res.data)
      return res.data
    } catch (e) {
      console.error('Failed to load moves', e)
      return null
    }
  }

  const handleModeChange = (newMode: 'setup' | 'play') => {
    setMode(newMode)
    onModeChange?.(newMode)
    setShowMenu(false)
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
    if (diceModalMode === 'set') {
      applyDice(dice1, dice2, diceTargetPlayer)
    } else if (diceModalMode === 'queue') {
      setDiceQueue(prev => [...prev, [dice1, dice2]])
      setShowDiceModal(false)
    } else if (diceModalMode === 'random') {
      // Рандомизация как в реальной игре
      const d1 = Math.floor(Math.random() * 6) + 1
      const d2 = Math.floor(Math.random() * 6) + 1
      applyDice(d1, d2, diceTargetPlayer)
    }
  }

  const handleRandomDice = () => {
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    setDice1(d1)
    setDice2(d2)
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

  // Кнопка с тремя точками
  if (!showMenu) {
    return (
      <div className="sandbox-menu-toggle">
        <button 
          className="sandbox-three-dots-btn" 
          onClick={() => setShowMenu(true)} 
          title="Меню"
        >
          <span>...</span>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Модальное окно меню */}
      <div className="sandbox-menu-overlay" onClick={() => setShowMenu(false)}>
        <div className="sandbox-menu" onClick={(e) => e.stopPropagation()}>
          <div className="sandbox-menu-header">
            <h3>Песочница</h3>
            <button 
              className="sandbox-menu-close"
              onClick={() => setShowMenu(false)}
              title="Закрыть"
            >
              ✕
            </button>
          </div>
          
          <div className="sandbox-menu-content">
            {/* 1. Свободное перемещение */}
            <button
              className={`sandbox-menu-item ${mode === 'setup' ? 'active' : ''}`}
              onClick={() => handleModeChange('setup')}
            >
              <span>🆓</span>
              <div>
                <div className="sandbox-menu-item-title">Свободное перемещение</div>
                <div className="sandbox-menu-item-desc">Перемещайте шашки без ограничений</div>
              </div>
            </button>

            {/* 2. Игра */}
            <button
              className={`sandbox-menu-item ${mode === 'play' ? 'active' : ''}`}
              onClick={() => handleModeChange('play')}
            >
              <span>🎮</span>
              <div>
                <div className="sandbox-menu-item-title">Игра</div>
                <div className="sandbox-menu-item-desc">Имитация игры со всеми правилами и ограничениями</div>
              </div>
            </button>

            {/* 3. Установка кубиков */}
            <button
              className="sandbox-menu-item"
              onClick={() => {
                setShowDiceModal(true)
                setDiceModalMode('set')
                setDiceTargetPlayer(null)
              }}
            >
              <span>🎲</span>
              <div>
                <div className="sandbox-menu-item-title">Установка кубиков</div>
                <div className="sandbox-menu-item-desc">Установить кубики для черных или белых</div>
              </div>
            </button>

            {/* 4. Подтверждение хода (только в режиме игры) */}
            {mode === 'play' && (
              <button
                className="sandbox-menu-item"
                onClick={() => {
                  onToggleConfirmMove?.()
                  setShowMenu(false)
                }}
              >
                <span>{requireConfirmMove ? '✓' : '✗'}</span>
                <div>
                  <div className="sandbox-menu-item-title">
                    {requireConfirmMove ? 'Отключить подтверждение' : 'Включить подтверждение'}
                  </div>
                  <div className="sandbox-menu-item-desc">
                    {requireConfirmMove ? 'Ходы будут применяться сразу' : 'Требовать подтверждение перед применением хода'}
                  </div>
                </div>
              </button>
            )}

            {/* Кнопка подтверждения хода (если есть pending moves и включено подтверждение) */}
            {mode === 'play' && requireConfirmMove && gameState?.canMove && gameState?.dice && (
              <button
                className="sandbox-confirm-move-btn"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('sandbox-confirm-move'))
                  setShowMenu(false)
                }}
                disabled={!gameState?.canMove || (gameState?.dice && Array.isArray(gameState.dice) && gameState.dice.length === 0)}
              >
                <span>✓</span> Подтвердить ход
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно установки кубиков */}
      {showDiceModal && (
        <div className="sandbox-dice-modal-overlay" onClick={() => {
          setShowDiceModal(false)
          setDiceModalDismissed(true)
        }}>
          <div className="sandbox-dice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sandbox-dice-modal-header">
              <h3>Установка кубиков</h3>
              <button 
                className="sandbox-dice-modal-close"
                onClick={() => {
                  setShowDiceModal(false)
                  setDiceModalDismissed(true)
                }}
              >
                ✕
              </button>
            </div>
            
            <div className="sandbox-dice-modal-content">
              {/* Выбор игрока */}
              <div className="sandbox-dice-player-select">
                <label>Игрок:</label>
                <div className="sandbox-dice-player-buttons">
                  <button
                    className={diceTargetPlayer === 0 ? 'active' : ''}
                    onClick={() => setDiceTargetPlayer(0)}
                  >
                    Белые
                  </button>
                  <button
                    className={diceTargetPlayer === 1 ? 'active' : ''}
                    onClick={() => setDiceTargetPlayer(1)}
                  >
                    Черные
                  </button>
                  <button
                    className={diceTargetPlayer === null ? 'active' : ''}
                    onClick={() => setDiceTargetPlayer(null)}
                  >
                    Текущий ({currentPlayer === 0 ? 'Белые' : 'Черные'})
                  </button>
                </div>
              </div>

              {/* Выбор режима */}
              <div className="sandbox-dice-mode-select">
                <label>Режим:</label>
                <div className="sandbox-dice-mode-buttons">
                  <button
                    className={diceModalMode === 'set' ? 'active' : ''}
                    onClick={() => setDiceModalMode('set')}
                  >
                    Установить
                  </button>
                  <button
                    className={diceModalMode === 'queue' ? 'active' : ''}
                    onClick={() => setDiceModalMode('queue')}
                  >
                    В очередь
                  </button>
                  <button
                    className={diceModalMode === 'random' ? 'active' : ''}
                    onClick={() => setDiceModalMode('random')}
                  >
                    Рандом
                  </button>
                </div>
              </div>

              {/* Выбор значений кубиков */}
              {diceModalMode !== 'random' && (
                <div className="sandbox-dice-values">
                  <div className="sandbox-dice-input-group">
                    <label>Кубик 1:</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={dice1}
                      onChange={(e) => setDice1(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                    />
                    <button onClick={handleRandomDice}>🎲</button>
                  </div>
                  <div className="sandbox-dice-input-group">
                    <label>Кубик 2:</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={dice2}
                      onChange={(e) => setDice2(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                    />
                    <button onClick={handleRandomDice}>🎲</button>
                  </div>
                </div>
              )}

              {/* Кнопка применения */}
              <button
                className="sandbox-dice-apply-btn"
                onClick={handleSetDice}
              >
                {diceModalMode === 'set' ? 'Установить' : diceModalMode === 'queue' ? 'Добавить в очередь' : 'Бросить кубики'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
