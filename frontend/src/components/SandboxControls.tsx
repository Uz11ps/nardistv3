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

  // Кнопка с тремя точками больше не нужна - она в header
  // Модальное окно меню тоже больше не нужно - оно в Game.tsx
  // Этот компонент теперь только для истории и глав
  // Возвращаем null - вся логика меню перенесена в Game.tsx
  return null
}
