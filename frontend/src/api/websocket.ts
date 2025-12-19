import { io, Socket } from 'socket.io-client'

// Для production используем wss://, для dev - ws://
const WS_URL = import.meta.env.VITE_WS_URL || (import.meta.env.PROD ? `wss://${window.location.host}` : 'ws://localhost:3000')

let socket: Socket | null = null

export function connectWebSocket(token: string): Socket {
  if (socket?.connected) {
    return socket
  }

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
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

