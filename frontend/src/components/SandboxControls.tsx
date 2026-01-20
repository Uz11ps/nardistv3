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
  const [isHidden, setIsHidden] = useState(true)
  const [chapters, setChapters] = useState<SandboxChapter[]>([])
  const [moves, setMoves] = useState<GameMove[]>([])
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  
  // Manual dice state
  const [dice1, setDice1] = useState(1)
  const [dice2, setDice2] = useState(1)
  const [diceTargetPlayer, setDiceTargetPlayer] = useState<number | null>(null)
  const [showDiceModal, setShowDiceModal] = useState(false)
  const [diceQueue, setDiceQueue] = useState<number[][]>([])
  const [diceModalDismissed, setDiceModalDismissed] = useState(false) // Флаг для предотвращения повторного открытия после отмены

  // Auto-show dice modal in play mode if no dice
  useEffect(() => {
    // В Sandbox режиме, если мы в режиме "play" и кубиков нет - показываем окно выбора
    const dice = gameState?.dice;
    const hasDice = !!dice && (Array.isArray(dice) ? dice.length > 0 : (dice.die1 !== undefined && dice.die1 !== null));
    
    // Показываем модалку только если мы в режиме игры, нет кубиков, модалка еще не открыта 
    // и мы НЕ просматриваем историю (selectedMoveIndex === null) и модалка не была закрыта пользователем
    if (mode === 'play' && !hasDice && !showDiceModal && selectedMoveIndex === null && !diceModalDismissed) {
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
  const [initialChapterCreated, setInitialChapterCreated] = useState(false)
  const initialChapterCreatedRef = useRef(false)
  
  useEffect(() => {
    loadChapters()
    loadMoves()
    
    // Listen for history updates
    const handleHistoryUpdate = async () => {
      const moves = await loadMoves()
      
      // Автоматически создаем начальную главу при первом ходе
      if (!initialChapterCreatedRef.current && mode === 'play' && moves && moves.length > 0) {
        try {
          console.log('📖 [SandboxControls] Auto-creating initial chapter after first move');
          
          // Создаем начальную главу с текущим состоянием доски
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
  
  // Сбрасываем флаг при смене игры
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

  const [isLockedAfterSave, setIsLockedAfterSave] = useState(false) // Флаг блокировки после сохранения
  
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
      // Блокируем изменения после сохранения - разблокировка произойдет при переключении режима или загрузке другой главы
      setIsLockedAfterSave(true)
    } catch (e) {
      alert('Ошибка при сохранении')
    }
  }
  
  // Разблокировка при переключении режима или загрузке главы
  useEffect(() => {
    setIsLockedAfterSave(false)
  }, [mode, gameId])

  const handleLoadChapter = async (chapter: SandboxChapter) => {
    try {
      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, chapter.gameState)
      onBoardUpdate()
      setMode('setup')
      setIsLockedAfterSave(false) // Разблокируем при загрузке главы
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

  // В sandbox режиме показываем только кнопку с тремя точками, которая открывает меню с подтверждением хода
  if (isHidden) {
    return (
      <div className="sandbox-studio-menu-toggle">
        <button className="menu-toggle-btn" onClick={() => setIsHidden(false)} title="Меню">
          <span>⋯</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="sandbox-modal-overlay" onClick={() => setIsHidden(true)}>
        <div className="sandbox-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sandbox-modal-header">
            <h2>Песочница</h2>
            <button 
              className="modal-close-btn"
              onClick={() => setIsHidden(true)}
              title="Закрыть"
            >
              <span>✕</span>
            </button>
          </div>
          
          <div className="sandbox-modal-content">
            {/* Кнопка подтверждения хода */}
            <button 
              className="sandbox-confirm-btn"
              onClick={() => {
                // Вызываем handleConfirm через событие, так как у нас нет прямого доступа к нему
                window.dispatchEvent(new CustomEvent('sandbox-confirm-move'))
                setIsHidden(true)
              }}
              disabled={!gameState?.canMove || (gameState?.dice && Array.isArray(gameState.dice) && gameState.dice.length === 0)}
            >
              <span>✓</span> Подтвердить ход
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
