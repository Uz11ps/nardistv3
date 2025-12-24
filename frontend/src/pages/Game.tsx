import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import BackgammonBoard from '../components/BackgammonBoard'
import Dice from '../components/Dice'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { getSocket, getMatchmakingSocket, connectWebSocket } from '../api/websocket'
import './Game.css'

interface GameState {
  points: any[]
  bar: { white: number; black: number }
  bearOff: { white: number; black: number }
  currentPlayer: number
  dice: { die1: number; die2: number } | null
  canMove: boolean
  verificationSalt?: string
  p1Rolls?: number[][]
  p2Rolls?: number[][]
}

export default function Game() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameInfo, setGameInfo] = useState<any>(null)
  const [opponent, setOpponent] = useState<any>(null)
  const [score, setScore] = useState({ player1: 0, player2: 0 })
  const [gameStatus, setGameStatus] = useState<string>('waiting')
  const [player1Timer, setPlayer1Timer] = useState<number>(30)
  const [player2Timer, setPlayer2Timer] = useState<number>(30)
  const [moveTimer, setMoveTimer] = useState<number>(30) // Таймер на ход (30 секунд)
  const [overtimeTimer, setOvertimeTimer] = useState<number>(60) // Овертайм (1 минута)
  const [pipCounts, setPipCounts] = useState({ player1: 0, player2: 0 })
  const [pipDiff, setPipDiff] = useState<{ player1: number | null; player2: number | null }>({ player1: null, player2: null })
  const lastPipCounts = useRef({ player1: 0, player2: 0 })
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)

  // Обновление ориентации
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Расчет Pip Count (очков до финиша)
  const calculatePipCount = useCallback((points: number[], bar: any, bearOff: any, player: number, mode: string) => {
    let count = 0
    const isLong = mode === 'LONG' || mode === 'long'
    
    points.forEach((val, idx) => {
      if (player === 0 && val > 0) {
        // Белые
        if (isLong) {
          // В длинных: 0 -> 23. Расстояние = 24 - idx
          count += val * (24 - idx)
        } else {
          // В коротких: 23 -> 0. Расстояние = idx + 1
          count += val * (idx + 1)
        }
      } else if (player === 1 && val < 0) {
        // Черные
        if (isLong) {
          // В длинных: 12 -> 11 (через 23). Расстояние = (11 - idx + 24) % 24 + 1
          const dist = (11 - idx + 24) % 24 + 1
          count += Math.abs(val) * dist
        } else {
          // В коротких: 0 -> 23. Расстояние = 24 - idx
          count += Math.abs(val) * (24 - idx)
        }
      }
    })
    
    // Добавляем шашки на баре (максимальное расстояние)
    if (player === 0 && bar.white > 0) count += bar.white * 24
    if (player === 1 && bar.black > 0) count += bar.black * 24
    
    return count
  }, [])

  // Обновление Pip Count при изменении состояния игры
  useEffect(() => {
    if (!gameState || !gameInfo) return
    
    const p1Count = calculatePipCount(gameState.points, gameState.bar, gameState.bearOff, 0, gameInfo.mode)
    const p2Count = calculatePipCount(gameState.points, gameState.bar, gameState.bearOff, 1, gameInfo.mode)
    
    setPipCounts({ player1: p1Count, player2: p2Count })
    
    // Считаем разницу, если это наш ход
    if (lastPipCounts.current.player1 !== 0) {
      setPipDiff({
        player1: p1Count - lastPipCounts.current.player1,
        player2: p2Count - lastPipCounts.current.player2
      })
    }
    
    lastPipCounts.current = { player1: p1Count, player2: p2Count }
  }, [gameState, gameInfo?.mode, calculatePipCount])

  const [isInOvertime, setIsInOvertime] = useState<boolean>(false) // Флаг овертайма
  const [showExitModal, setShowExitModal] = useState<boolean>(false) // Модальное окно выхода
  const [diceAnimating, setDiceAnimating] = useState<boolean>(false)
  const [playerSkins, setPlayerSkins] = useState<{ player1: any; player2: any; mySkins: any }>({ player1: null, player2: null, mySkins: null })
  const [player1Ready, setPlayer1Ready] = useState<boolean>(false)
  const [player2Ready, setPlayer2Ready] = useState<boolean>(false)
  const [myReady, setMyReady] = useState<boolean>(false)
  const [myOffset, setMyOffset] = useState<number>(1)
  const [opponentOffset, setOpponentOffset] = useState<number>(1)
  const [pendingMoves, setPendingMoves] = useState<Array<{ from: number; to: number; die: number }>>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overtimeRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const mode = searchParams.get('mode')
  const isBotGame = mode === 'bot'
  const createdBotGameRef = useRef(false)

  useEffect(() => {
    if (gameId) {
      loadGame()
      connectToGame()
      createdBotGameRef.current = false
    } else if (isBotGame && !createdBotGameRef.current) {
      createdBotGameRef.current = true
      createBotGame()
    } else if (!isBotGame && !gameId) {
      navigate('/game/modes')
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current)
      }
      const socket = getSocket()
      if (socket) {
        socket.off('game_state')
        socket.off('move_made')
        socket.off('dice_rolled')
        socket.off('game_finished')
      }
      const matchmakingSocket = getMatchmakingSocket()
      if (matchmakingSocket) {
        matchmakingSocket.off('ready_status')
        matchmakingSocket.off('game_started')
        matchmakingSocket.off('opponent_joined')
      }
    }
  }, [gameId, isBotGame])
  
  // Перезагружаем скины при изменении gameInfo (когда присоединяется соперник)
  useEffect(() => {
    if (gameInfo?.player1Id && gameInfo?.player2Id) {
      console.log('🔄 gameInfo updated, reloading skins...', { player1Id: gameInfo.player1Id, player2Id: gameInfo.player2Id })
      loadPlayerSkins(gameInfo.player1Id, gameInfo.player2Id)
    }
  }, [gameInfo?.player1Id, gameInfo?.player2Id])

  // Таймер на ход: 30 секунд, затем 1 минута овертайм
  useEffect(() => {
    // Очищаем предыдущие таймеры
    if (moveTimerRef.current) {
      clearInterval(moveTimerRef.current)
      moveTimerRef.current = null
    }
    if (overtimeRef.current) {
      clearInterval(overtimeRef.current)
      overtimeRef.current = null
    }

    // Если это мой ход и игра идет, запускаем таймер
    if (gameState?.canMove && gameStatus === 'in_progress' && gameState?.dice && !isBotGame) {
      moveTimerRef.current = setInterval(() => {
        setMoveTimer((prev) => {
          if (prev <= 1) {
            // Основной таймер закончился - переходим в овертайм
            setIsInOvertime(true)
            if (!overtimeRef.current) {
              overtimeRef.current = setInterval(() => {
                setOvertimeTimer((prevOvertime) => {
                  if (prevOvertime <= 1) {
                    // Овертайм закончился - техническое поражение
                    handleAutoMove()
                    if (overtimeRef.current) {
                      clearInterval(overtimeRef.current)
                      overtimeRef.current = null
                    }
                    return 0
                  }
                  return prevOvertime - 1
                })
              }, 1000)
            }
            if (moveTimerRef.current) {
              clearInterval(moveTimerRef.current)
              moveTimerRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // Не мой ход или игра не идет - сбрасываем таймеры
      setIsInOvertime(false)
      setMoveTimer(30)
      setOvertimeTimer(60)
    }

    return () => {
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current)
        moveTimerRef.current = null
      }
      if (overtimeRef.current) {
        clearInterval(overtimeRef.current)
        overtimeRef.current = null
      }
    }
  }, [gameState?.canMove, gameStatus, !!gameState?.dice, isBotGame])

  // Функция автолуза
  const handleAutoMove = async () => {
    if (!gameId) return

    console.log('⏱️ Таймер истек! Оформляем техническое поражение...')
    try {
      await apiClient.post(`/games/${gameId}/resign`)
      setGameStatus('finished')
    } catch (error) {
      console.error('❌ Ошибка при автоматической сдаче:', error)
    }
  }
  
  const loadGame = async () => {
    try {
      const response = await apiClient.get(`/games/${gameId}`)
      const game = response.data
      setGameInfo(game)
      const diceData = game.gameState?.dice
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2
        ? { die1: diceData[0], die2: diceData[1] }
        : diceData || null
      
      const barRaw = game.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = game.gameState?.bearOff || game.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      setGameState({
        points: game.gameState?.points || [],
        bar,
        bearOff,
        currentPlayer: game.currentPlayer || 0,
        dice: formattedDice,
        canMove: game.player1Id === user?.id ? game.currentPlayer === 0 : game.currentPlayer === 1,
        verificationSalt: game.verificationSalt,
        p1Rolls: game.p1Rolls,
        p2Rolls: game.p2Rolls,
      })
      setOpponent(game.player1Id === user?.id ? game.player2 : game.player1)
      setScore({ player1: game.player1Score || 0, player2: game.player2Score || 0 })
      setGameStatus(game.status)
      
      if (game.status === 'in_progress') {
        const timeLimitSeconds = game.moveTimeLimit ? Math.floor(game.moveTimeLimit / 1000) : 60
        setPlayer1Timer(timeLimitSeconds)
        setPlayer2Timer(timeLimitSeconds)
      } else {
        setPlayer1Timer(0)
        setPlayer2Timer(0)
      }
      
      if (game.status === 'waiting' && game.type === 'vs_player' && !isBotGame) {
        setPlayer1Ready(false)
        setPlayer2Ready(false)
        setMyReady(false)
      }
      
      await loadPlayerSkins(game.player1Id, game.player2Id)
    } catch (error) {
      // Игнорируем ошибки загрузки
    }
  }

  const loadPlayerSkins = async (player1Id: string, player2Id: string) => {
    try {
      const currentUser = useAuthStore.getState().user
      const myId = currentUser?.id
      
      const loadDefaultSkins = async () => {
        try {
          const allSkinsRes = await apiClient.get('/skins').catch(() => ({ data: [] }))
          const allSkins = allSkinsRes.data || []
          const defaultBoard = allSkins.find((s: any) => s.type === 'board' && s.isDefault)
          const defaultDice = allSkins.find((s: any) => s.type === 'dice' && s.isDefault)
          const defaultCheckers = allSkins.find((s: any) => s.type === 'checkers' && s.isDefault)
          return {
            board: defaultBoard || null,
            dice: defaultDice || null,
            checkers: defaultCheckers || null,
          }
        } catch (error) {
          console.error('Failed to load default skins:', error)
          return { board: null, dice: null, checkers: null }
        }
      }
      
      const isBotPlayer2 = !player2Id || isBotGame || gameInfo?.type === 'vs_bot'
      
      const loadPlayerSkinsWithFallback = async (userId: string, isMyId: boolean) => {
        try {
          const explicitRes = await apiClient.get('/skins/selected/explicit').catch(() => ({ data: {} }))
          const explicitSkins = explicitRes.data || {}
          
          if (explicitSkins.board || explicitSkins.dice || explicitSkins.checkers) {
            return explicitSkins
          }
          
          const selectedRes = await apiClient.get(isMyId ? '/skins/selected' : `/skins/user/${userId}/selected`).catch(() => ({ data: {} }))
          const selectedSkins = selectedRes.data || {}
          return selectedSkins
        } catch (error) {
          console.error(`Failed to load skins for user ${userId}:`, error)
          return {}
        }
      }
      
      const promises = [
        myId === player1Id 
          ? loadPlayerSkinsWithFallback(player1Id, true)
          : loadPlayerSkinsWithFallback(player1Id, false),
        isBotPlayer2
          ? loadDefaultSkins().then(defaultSkins => defaultSkins)
          : (player2Id
              ? loadPlayerSkinsWithFallback(player2Id, myId === player2Id)
              : Promise.resolve({})),
        myId ? loadPlayerSkinsWithFallback(myId, true) : Promise.resolve({}),
      ]
      
      const [player1Skins, player2Skins, mySkins] = await Promise.all(promises)
      
      setPlayerSkins({
        player1: player1Skins,
        player2: player2Skins,
        mySkins: mySkins,
      })
    } catch (error) {
      console.error('Failed to load player skins:', error)
      setPlayerSkins({
        player1: {},
        player2: {},
        mySkins: {},
      })
    }
  }

  const createBotGame = async () => {
    try {
      const response = await apiClient.post('/games/create-bot')
      navigate(`/game/${response.data.id}`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка'
      alert(`Не удалось создать игру с ботом: ${errorMessage}`)
    }
  }

  const connectToGame = () => {
    const socket = getSocket()
    if (!socket || !gameId) {
      const { token } = useAuthStore.getState()
      if (token) {
        connectWebSocket(token)
        setTimeout(() => {
          const newSocket = getSocket()
          if (newSocket && gameId) {
            newSocket.emit('join_game', { gameId })
          }
        }, 1000)
      }
      return
    }

    socket.emit('join_game', { gameId })

    socket.on('game_state', (data: any) => {
      const diceData = data.gameState?.dice
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
        ? { die1: diceData[0], die2: diceData[1] } 
        : (Array.isArray(diceData) && diceData.length === 0) || !diceData
        ? null
        : diceData
      
      const canMove = data.currentPlayer === (data.player1Id === user?.id ? 0 : 1)
      const isMyTurnNow = canMove
      const wasMyTurn = gameState?.canMove || false
      
      const barRaw = data.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      setGameState({
        points: data.gameState?.points || [],
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
        verificationSalt: data.verificationSalt,
        p1Rolls: data.p1Rolls,
        p2Rolls: data.p2Rolls,
      })
      const newStatus = data.status || 'waiting'
      setGameStatus(newStatus)
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
      
      if (isMyTurnNow && !wasMyTurn) {
        setMoveTimer(30)
      }

      if (newStatus === 'in_progress' && isMyTurnNow && !wasMyTurn && !formattedDice && !isBotGame) {
        setTimeout(() => {
          const socket = getSocket()
          if (socket) {
            socket.emit('roll_dice', { gameId })
          }
        }, 500)
      }
      
      if (newStatus === 'in_progress') {
        loadGame()
      }
    })

    socket.on('move_made', (data: any) => {
      setPendingMoves([])
      const diceData = data.gameState?.dice
      const formattedDice = Array.isArray(diceData) && diceData.length >= 2 
        ? { die1: diceData[0], die2: diceData[1] } 
        : (Array.isArray(diceData) && diceData.length === 0) || !diceData
        ? null
        : diceData
      
      const canMove = data.currentPlayer === (data.player1Id === user?.id ? 0 : 1)
      const isMyTurnNow = canMove
      const wasMyTurn = gameState?.canMove || false
      
      const timeLimitSeconds = gameInfo?.moveTimeLimit ? Math.floor(gameInfo.moveTimeLimit / 1000) : 60
      if (data.currentPlayer === 0) {
        setPlayer1Timer(timeLimitSeconds)
        setPlayer2Timer(timeLimitSeconds)
      } else {
        setPlayer2Timer(timeLimitSeconds)
        setPlayer1Timer(timeLimitSeconds)
      }
      
      const barRaw = data.gameState?.bar || [0, 0]
      const bar = Array.isArray(barRaw) 
        ? { white: barRaw[0] || 0, black: barRaw[1] || 0 }
        : barRaw
        
      const bearOffRaw = data.gameState?.bearOff || data.gameState?.borneOff || [0, 0]
      const bearOff = Array.isArray(bearOffRaw)
        ? { white: bearOffRaw[0] || 0, black: bearOffRaw[1] || 0 }
        : bearOffRaw
      
      setGameState({
        points: data.gameState?.points || [],
        bar,
        bearOff,
        currentPlayer: data.currentPlayer || 0,
        dice: formattedDice,
        canMove: canMove,
        verificationSalt: data.verificationSalt,
        p1Rolls: data.p1Rolls,
        p2Rolls: data.p2Rolls,
      })
      setGameStatus(data.status || 'in_progress')
      
      if (isMyTurnNow && !wasMyTurn) {
        setMoveTimer(30)
      }

      if (data.status === 'in_progress' && isMyTurnNow && !wasMyTurn && !formattedDice && !isBotGame) {
        setTimeout(() => {
          const socket = getSocket()
          if (socket) {
            socket.emit('roll_dice', { gameId })
          }
        }, 500)
      }
    })

    socket.on('dice_rolled', (data: any) => {
      setDiceAnimating(true)
      setTimeout(() => {
        setDiceAnimating(false)
        if (data.dice && Array.isArray(data.dice) && data.dice.length >= 2) {
          const formattedDice = { die1: data.dice[0], die2: data.dice[1] }
          setGameState(prev => prev ? ({ ...prev, dice: formattedDice }) : null)
        }
        loadGame()
      }, 1500) // Увеличили время для красивой 3D анимации
    })

    socket.on('offset_updated', (data: any) => {
      const isP1 = gameInfo?.player1Id === user?.id
      if (isP1) {
        setMyOffset(data.player1Offset)
        setOpponentOffset(data.player2Offset)
      } else {
        setMyOffset(data.player2Offset)
        setOpponentOffset(data.player1Offset)
      }
    })

    socket.on('timer_update', (data: any) => {
      if (data.gameId === gameId) {
        const timeRemaining = data.timeRemaining !== undefined ? data.timeRemaining : Math.max(0, 60 - (data.timeElapsed || 0))
        const timeLimitSeconds = gameInfo?.moveTimeLimit ? Math.floor(gameInfo.moveTimeLimit / 1000) : 60
        
        if (data.currentPlayer === 0) {
          setPlayer1Timer(timeRemaining)
          setPlayer2Timer(timeLimitSeconds)
        } else {
          setPlayer2Timer(timeRemaining)
          setPlayer1Timer(timeLimitSeconds)
        }
      }
    })

    socket.on('game_finished', (data: any) => {
      setGameStatus('finished')
      setScore({ player1: data.player1Score || 0, player2: data.player2Score || 0 })
    })

    const matchmakingSocket = getMatchmakingSocket()
    if (matchmakingSocket && gameId && !isBotGame) {
      matchmakingSocket.on('ready_status', (data: any) => {
        if (data.gameId === gameId) {
          setPlayer1Ready(data.player1Ready || false)
          setPlayer2Ready(data.player2Ready || false)
          const isP1 = gameInfo?.player1Id === user?.id
          setMyReady(isP1 ? (data.player1Ready || false) : (data.player2Ready || false))
        }
      })

      matchmakingSocket.on('game_started', (data: any) => {
        if (data.gameId === gameId) {
          setGameStatus('in_progress')
          setPlayer1Ready(true)
          setPlayer2Ready(true)
          setMyReady(true)
          if (data.game) setGameInfo(data.game)
          loadGame()
        }
      })

      matchmakingSocket.on('opponent_joined', (data: any) => {
        if (data.gameId === gameId) {
          if (data.game) {
            setGameInfo(data.game)
            setOpponent(data.game.player1Id === user?.id ? data.game.player2 : data.game.player1)
            setGameStatus(data.game.status || 'waiting')
            setPlayer1Ready(false)
            setPlayer2Ready(false)
            setMyReady(false)
            if (data.game.player1Id && data.game.player2Id) {
              loadPlayerSkins(data.game.player1Id, data.game.player2Id)
            }
          }
          loadGame()
        }
      })

      matchmakingSocket.on('player_timeout', (data: any) => {
        if (data.gameId === gameId && data.timeoutPlayerId !== user?.id) {
          alert('Соперник не подтвердил готовность в течение минуты и был исключен. Ожидание нового соперника...')
          setPlayer1Ready(false)
          setPlayer2Ready(false)
          setMyReady(false)
          loadGame()
        }
      })
    }
  }

  const handleMove = async (from: number, to: number, die: number) => {
    if (!gameId || !gameState?.canMove) return

    const diceArray = gameState.dice 
      ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2])
      : []
    
    const usedCount = pendingMoves.filter(m => m.die === die).length
    const availableCount = diceArray.filter(d => d === die).length
    
    if (usedCount >= availableCount) {
      alert(`Кубик ${die} уже использован максимальное количество раз`)
      return
    }

    setPendingMoves(prev => [...prev, { from, to, die }])
  }

  const handleUndo = () => {
    if (pendingMoves.length > 0) {
      setPendingMoves(prev => prev.slice(0, -1))
    }
  }

  const handleRollDice = async () => {
    if (!gameId) return
    const socket = getSocket()
    if (!socket) return
    socket.emit('roll_dice', { gameId })
  }

  const handleReadyToStart = async () => {
    if (!gameId) return
    const ms = getMatchmakingSocket()
    if (!ms) {
      alert('WebSocket не подключен. Перезагрузите страницу.')
      return
    }
    ms.emit('ready_to_start', { gameId })
    setMyReady(true)
  }

  const handleOffsetChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (isNaN(val) || val < 1 || val > 100) return
    setMyOffset(val)
    try {
      await apiClient.post(`/games/${gameId}/offset`, { offset: val })
    } catch (error) {}
  }

  const handleConfirm = async () => {
    if (!gameId) return

    if (gameStatus === 'waiting' && !isBotGame && gameInfo?.type === 'vs_player') return

    if (gameStatus === 'waiting' && isBotGame) {
      try {
        let socket = getSocket()
        if (!socket || !socket.connected) {
          const { token } = useAuthStore.getState()
          if (token) {
            connectWebSocket(token)
            await new Promise(resolve => setTimeout(resolve, 500))
            socket = getSocket()
          }
          if (!socket || !socket.connected) {
            alert('Ошибка подключения. Попробуйте обновить страницу.')
            return
          }
        }
        socket.emit('roll_dice', { gameId })
        setTimeout(() => loadGame(), 2000)
      } catch (error) {
        alert('Ошибка начала игры: ' + (error as Error).message)
      }
      return
    }

    if (gameStatus === 'in_progress' && gameState?.canMove && pendingMoves.length > 0) {
      const socket = getSocket()
      if (!socket) {
        alert('Ошибка подключения. Перезагрузите страницу.')
        return
      }
      try {
        setMoveTimer(30)
        socket.emit('make_move', { gameId, moves: pendingMoves })
        setPendingMoves([])
      } catch (error) {
        alert('Ошибка отправки ходов: ' + (error as Error).message)
      }
    }
  }

  if (!gameState || !gameInfo) {
    return (
      <div className="app-container">
        <PageHeader title="Игра" />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div className="loading-spinner" />
          <p>Загрузка игры...</p>
        </div>
      </div>
    )
  }

  const isMyTurn = gameState.canMove
  const isPlayer1 = gameInfo.player1Id === user?.id
  const myPlayer = isPlayer1 ? gameInfo.player1 : gameInfo.player2
  const opponentPlayer = isPlayer1 ? gameInfo.player2 : gameInfo.player1

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getGameModeName = (mode: string) => {
    return mode === 'LONG' ? 'Длинные' : 'Короткие'
  }

  const tableNumber = gameId?.slice(-2) || '0'
  const gameMode = gameInfo.mode || 'LONG'
  const stake = Number(gameInfo.stake || 0)

  const handleBack = async () => {
    if (isBotGame && gameInfo?.type === 'vs_bot') {
      navigate('/game/modes')
      return
    }
    if (gameStatus === 'in_progress' && gameId && gameInfo?.type !== 'vs_bot') {
      setShowExitModal(true)
      return
    }
    if (gameStatus !== 'finished' && gameId && gameInfo?.type !== 'vs_bot') {
      try {
        await apiClient.post(`/games/${gameId}/resign`)
      } catch (error) {}
    }
    navigate('/')
  }

  const handleConfirmExit = async () => {
    setShowExitModal(false)
    if (gameId) {
      try {
        await apiClient.post(`/games/${gameId}/resign`)
      } catch (error) {}
    }
    navigate('/')
  }

  return (
    <div className={`app-container game-container page-transition ${isLandscape ? 'landscape-mode' : ''}`}>
      <PageHeader 
        title={`Table ${tableNumber} - ${getGameModeName(gameMode)}${stake > 0 ? ` - ${stake} NAR` : ''}`}
        onBack={handleBack}
      />
      
      <div className="game-main-layout">
        {/* Левая панель (ландшафт) */}
        {isLandscape && (
          <div className="game-side-panel left">
            <div className={`game-player ${!isPlayer1 ? 'game-player-me' : ''}`}>
              <div className="game-player-name">
                {opponentPlayer?.nickname || opponentPlayer?.username || 'Соперник'}
                <div className="pip-count-display">
                  {pipCounts.player2}
                  {pipDiff.player2 !== null && pipDiff.player2 !== 0 && (
                    <span className={`pip-diff ${pipDiff.player2 < 0 ? 'good' : 'bad'}`}>
                      ({pipDiff.player2 > 0 ? '+' : ''}{pipDiff.player2})
                    </span>
                  )}
                </div>
              </div>
              <div className={`game-player-avatar ${!isPlayer1 && isMyTurn ? 'game-player-active' : ''}`}>
                {opponentPlayer?.avatarUrl ? <img src={opponentPlayer.avatarUrl} alt={opponentPlayer.username} /> : <Icon name="user" size={48} />}
                <div className={`game-player-timer ${!isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
                  {formatTime(!isPlayer1 ? player1Timer : player2Timer)}
                </div>
              </div>
            </div>
            
            <div className="game-score-side">
              <div className="game-score-label">до 3</div>
              <div className="game-score">{score.player1}:{score.player2}</div>
            </div>
          </div>
        )}

        <div className="game-center-content">
          {!isLandscape && (
            <div className="game-players-section">
              <div className={`game-player ${!isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">{opponentPlayer?.nickname || opponentPlayer?.username || 'Соперник'}</div>
                <div className={`game-player-avatar ${!isPlayer1 && isMyTurn ? 'game-player-active' : ''}`}>
                  {opponentPlayer?.avatarUrl ? <img src={opponentPlayer.avatarUrl} alt={opponentPlayer.username} /> : <Icon name="user" size={48} />}
                  <div className={`game-player-timer ${!isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
                    {formatTime(!isPlayer1 ? player1Timer : player2Timer)}
                  </div>
                </div>
              </div>
              <div className="game-score-section">
                <div className="game-score-label">до 3</div>
                <div className="game-score">{score.player1}:{score.player2}</div>
              </div>
              <div className={`game-player ${isPlayer1 ? 'game-player-me' : ''}`}>
                <div className="game-player-name">{myPlayer?.nickname || myPlayer?.username || 'Вы'}</div>
                <div className={`game-player-avatar ${isMyTurn && isPlayer1 ? 'game-player-active' : ''}`}>
                  {myPlayer?.avatarUrl ? <img src={myPlayer.avatarUrl} alt={myPlayer.username} /> : <Icon name="user" size={48} />}
                  <div className={`game-player-timer ${isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
                    {formatTime(isPlayer1 ? player1Timer : player2Timer)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Состояние ожидания (только в портрете или если не в процессе) */}
          {gameStatus === 'waiting' && !isBotGame && gameInfo?.type === 'vs_player' && (
            <div className="game-waiting-section">
              {!gameInfo?.player2Id ? (
                <div>⏳ Ожидание соперника...</div>
              ) : (
                <div className="fair-play-setup">
                  <h3>Контроль честности</h3>
                  <div className="hash-display">
                    <div>Хеш последовательности (SHA-256):</div>
                    <code>{gameInfo.rngHash ? (JSON.parse(gameInfo.rngHash).p1Hash.substring(0, 16) + '...') : '---'}</code>
                  </div>
                  
                  <div className="offset-selector">
                    <label>Ваше смещение (1-100):</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={myOffset} 
                      onChange={handleOffsetChange}
                      disabled={myReady}
                    />
                    <div className="offset-values">
                      <span>Вы: {myOffset}</span>
                      <span>Соперник: {opponentOffset}</span>
                    </div>
                  </div>

                  {!myReady ? (
                    <Button variant="primary" onClick={handleReadyToStart} className="ready-btn">Начать игру</Button>
                  ) : (
                    <div className="ready-status">✅ Вы готовы. Ожидание соперника...</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Доска */}
          {(gameStatus === 'in_progress' || gameStatus === 'finished') && (
            <div className="board-wrapper">
              <BackgammonBoard
                key={`board-${gameState?.points?.join(',')}-${gameState?.currentPlayer}-${pendingMoves.length}`}
                player1Skins={playerSkins.player1}
                player2Skins={playerSkins.player2}
                mySkins={playerSkins.mySkins}
                gameState={gameState}
                currentPlayer={gameState.currentPlayer}
                dice={gameState.dice ? (Array.isArray(gameState.dice) ? gameState.dice : [gameState.dice.die1, gameState.dice.die2]) : null}
                onMove={handleMove}
                onRollDice={handleRollDice}
                canMove={gameState.canMove}
                isMyTurn={isMyTurn}
                gameId={gameId}
                gameMode={gameInfo?.mode || 'long'}
                pendingMoves={pendingMoves}
                diceAnimating={diceAnimating}
                myPlayerId={user?.id}
                player1Id={gameInfo?.player1Id}
                player2Id={gameInfo?.player2Id}
                player1Name={gameInfo?.player1?.nickname || gameInfo?.player1?.username}
                player2Name={gameInfo?.player2?.nickname || gameInfo?.player2?.username || 'Бот'}
              />
            </div>
          )}

          {/* Подтверждение хода (только в портрете) */}
          {!isLandscape && gameStatus === 'in_progress' && isMyTurn && gameState?.dice && (
            <div className="game-confirm-section">
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                {!isInOvertime ? (
                  <div className="game-move-timer">⏱️ {moveTimer}с</div>
                ) : (
                  <div className="game-overtime-timer">⚠️ {overtimeTimer}с</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {pendingMoves.length > 0 && (
                  <Button variant="secondary" onClick={handleUndo} style={{ flex: 1 }}>
                    Отменить
                  </Button>
                )}
                <Button 
                  variant="primary" 
                  onClick={handleConfirm}
                  disabled={pendingMoves.length === 0}
                  style={{ flex: 2 }}
                >
                  {pendingMoves.length > 0 ? `Подтвердить (${pendingMoves.length})` : 'Подтвердить ход'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Правая панель (ландшафт) */}
        {isLandscape && (
          <div className="game-side-panel right">
            <div className={`game-player ${isPlayer1 ? 'game-player-me' : ''}`}>
              <div className="game-player-name">
                {myPlayer?.nickname || myPlayer?.username || 'Вы'}
                <div className="pip-count-display">
                  {pipCounts.player1}
                  {pipDiff.player1 !== null && pipDiff.player1 !== 0 && (
                    <span className={`pip-diff ${pipDiff.player1 < 0 ? 'good' : 'bad'}`}>
                      ({pipDiff.player1 > 0 ? '+' : ''}{pipDiff.player1})
                    </span>
                  )}
                </div>
              </div>
              <div className={`game-player-avatar ${isMyTurn && isPlayer1 ? 'game-player-active' : ''}`}>
                {myPlayer?.avatarUrl ? <img src={myPlayer.avatarUrl} alt={myPlayer.username} /> : <Icon name="user" size={48} />}
                <div className={`game-player-timer ${isPlayer1 && isMyTurn ? 'game-player-timer-active' : ''}`}>
                  {formatTime(isPlayer1 ? player1Timer : player2Timer)}
                </div>
              </div>
            </div>

            {/* Подтверждение хода в сайдбаре */}
            {gameStatus === 'in_progress' && isMyTurn && gameState?.dice && (
              <div className="game-confirm-sidebar">
                <div className="sidebar-timers">
                  {!isInOvertime ? (
                    <div className="game-move-timer-sidebar">⏱️ {moveTimer}с</div>
                  ) : (
                    <div className="game-overtime-timer-sidebar">⚠️ {overtimeTimer}с</div>
                  )}
                </div>
                <div className="sidebar-buttons">
                  <Button 
                    variant="primary" 
                    onClick={handleConfirm}
                    disabled={pendingMoves.length === 0}
                    className="sidebar-ok-btn"
                  >
                    OK {pendingMoves.length > 0 ? `(${pendingMoves.length})` : ''}
                  </Button>
                  {pendingMoves.length > 0 && (
                    <Button variant="secondary" onClick={handleUndo} className="sidebar-undo-btn">↩️</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showExitModal && (
        <div className="modal-overlay" onClick={() => setShowExitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Выход из игры</h2>
            <p>Вы уверены? Вам засчитается поражение!</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <Button variant="primary" onClick={handleConfirmExit} style={{ flex: 1 }}>Да, сдаться</Button>
              <Button variant="secondary" onClick={() => setShowExitModal(false)} style={{ flex: 1 }}>Нет</Button>
            </div>
          </div>
        </div>
      )}

      {gameStatus === 'finished' && (
        <div className="game-overlay">
          <div className="game-result">
            <h2>Игра завершена!</h2>
            <p>Победитель: {score.player1 > score.player2 ? (isPlayer1 ? 'Вы' : myPlayer?.username) : (isPlayer1 ? opponentPlayer?.username : 'Вы')}</p>
            
            <div className="fair-play-verification">
              <h4>Контроль честности</h4>
              <div className="verification-item">
                <span>Ваше смещение:</span>
                <strong>{myOffset}</strong>
              </div>
              <div className="verification-item">
                <span>Смещение соперника:</span>
                <strong>{opponentOffset}</strong>
              </div>
              <div className="verification-item">
                <span>Итоговый индекс:</span>
                <strong>{((myOffset - 1) * 2 + opponentOffset)}</strong>
              </div>
              {gameState?.verificationSalt && (
                <div className="verification-details">
                  <div className="salt-display">
                    Соль: <code>{gameState.verificationSalt}</code>
                  </div>
                  <button 
                    className="verify-btn"
                    onClick={() => {
                      alert('Для проверки: HASH(Sequence + Salt) должен совпадать с хешем в начале игры.')
                    }}
                  >
                    Как проверить?
                  </button>
                </div>
              )}
            </div>

            <button className="result-close-btn" onClick={() => navigate('/game/result/' + gameId)}>К результатам</button>
          </div>
        </div>
      )}
    </div>
  )
}
