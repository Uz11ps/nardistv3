import { io, Socket } from 'socket.io-client'

// Для production используем wss://, для dev - ws://
const WS_URL = import.meta.env.VITE_WS_URL || (import.meta.env.PROD ? `wss://${window.location.host}` : 'ws://localhost:3000')

let gamesSocket: Socket | null = null
let matchmakingSocket: Socket | null = null

export function connectWebSocket(token: string) {
  // Подключаемся к namespace /games для игровых событий
  if (!gamesSocket?.connected) {
    gamesSocket = io(`${WS_URL}/games`, {
      auth: { token },
      transports: ['websocket'],
    })

    gamesSocket.on('connect', () => {
      console.log('✅ WebSocket подключен к /games')
    })

    gamesSocket.on('disconnect', () => {
      console.log('❌ WebSocket отключен от /games')
    })

    gamesSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket ошибка подключения к /games:', error)
    })
  }

  // Подключаемся к namespace /matchmaking для поиска игр и столов
  if (!matchmakingSocket?.connected) {
    matchmakingSocket = io(`${WS_URL}/matchmaking`, {
      auth: { token },
      transports: ['websocket'],
    })

    matchmakingSocket.on('connect', () => {
      console.log('✅ WebSocket подключен к /matchmaking')
    })

    matchmakingSocket.on('disconnect', () => {
      console.log('❌ WebSocket отключен от /matchmaking')
    })

    matchmakingSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket ошибка подключения к /matchmaking:', error)
    })
  }

  return gamesSocket
}

export function disconnectWebSocket() {
  if (gamesSocket) {
    gamesSocket.disconnect()
    gamesSocket = null
  }
  if (matchmakingSocket) {
    matchmakingSocket.disconnect()
    matchmakingSocket = null
  }
}

export function getSocket(): Socket | null {
  return gamesSocket
}

export function getMatchmakingSocket(): Socket | null {
  return matchmakingSocket
}

