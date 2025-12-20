import { io, Socket } from 'socket.io-client'

// Для production используем wss://, для dev - ws://
const WS_URL = import.meta.env.VITE_WS_URL || (import.meta.env.PROD ? `wss://${window.location.host}` : 'ws://localhost:3000')

let socket: Socket | null = null

export function connectWebSocket(token: string): Socket {
  if (socket?.connected) {
    return socket
  }

  // Подключаемся к namespace /games для игровых событий
  socket = io(`${WS_URL}/games`, {
    auth: { token },
    transports: ['websocket'],
  })

  socket.on('connect', () => {
    console.log('✅ WebSocket подключен к /games')
  })

  socket.on('disconnect', () => {
    console.log('❌ WebSocket отключен')
  })

  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket ошибка подключения:', error)
  })

  return socket
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket(): Socket | null {
  return socket
}

