import { create } from 'zustand'
import apiClient from '../api/client'
import { getInitData } from '../config/telegram'

interface User {
  id: string
  username: string
  firstName?: string
  lastName?: string
  nickname?: string
  avatarUrl?: string
  level: number
  xp: number | bigint
  narCoin: number | bigint
  isTrainer?: boolean
  isAdmin?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  init: () => Promise<void>
  login: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  
  init: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ token: null, user: null })
      return
    }

    try {
      const response = await apiClient.get('/auth/me')
      set({ user: response.data, token })
    } catch (error) {
      localStorage.removeItem('token')
      set({ user: null, token: null })
    }
  },

  login: async () => {
    const initData = getInitData()
    if (!initData) {
      throw new Error('Telegram initData не доступен')
    }

    const response = await apiClient.post('/auth/login', { initData })
    const { access_token, user } = response.data

    localStorage.setItem('token', access_token)
    set({ token: access_token, user })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },
}))

