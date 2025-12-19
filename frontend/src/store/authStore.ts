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
      const error = new Error('Telegram initData не доступен. Убедитесь что вы открыли приложение через Telegram бота.')
      ;(error as any).code = 'NO_INIT_DATA'
      throw error
    }

    try {
      const response = await apiClient.post('/auth/login', { initData })
      const { access_token, user } = response.data

      localStorage.setItem('token', access_token)
      set({ token: access_token, user })
    } catch (error: any) {
      if (error.response?.status === 401) {
        const telegramError = new Error('Ошибка авторизации Telegram. Проверьте настройки бота и домена.')
        ;(telegramError as any).code = 'TELEGRAM_AUTH_ERROR'
        throw telegramError
      }
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },
}))

