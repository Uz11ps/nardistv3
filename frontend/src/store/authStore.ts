import { create } from 'zustand'
import apiClient from '../api/client'
import { getInitData } from '../config/telegram'

interface User {
  id: string
  username: string
  firstName?: string
  lastName?: string
  nickname?: string
  country?: string
  avatarUrl?: string
  level: number
  xp: number | bigint
  narCoin: number | bigint
  energy?: number
  maxEnergy?: number
  isTrainer?: boolean
  isAdmin?: boolean
  isGuest?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  init: () => Promise<void>
  login: () => Promise<void>
  loginAsGuest: () => Promise<void>
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
    console.log('🔐 Попытка входа, initData:', initData ? `есть (${initData.length} символов)` : 'отсутствует')
    
    if (!initData) {
      console.error('❌ initData не доступен!')
      console.error('Проверьте:')
      console.error('1. Открыли ли вы приложение через Telegram бота')
      console.error('2. Привязан ли домен nardist.site к боту через @BotFather')
      console.error('3. Настроен ли TELEGRAM_BOT_TOKEN на сервере')
      console.error('4. Используете ли вы HTTPS (не HTTP)')
      
      // Дополнительная диагностика
      if (typeof window !== 'undefined') {
        console.error('URL:', window.location.href)
        console.error('User Agent:', navigator.userAgent)
        console.error('Telegram объект:', (window as any).Telegram)
      }
      
      const error = new Error('Telegram initData не доступен. Убедитесь что вы открыли приложение через Telegram бота.')
      ;(error as any).code = 'NO_INIT_DATA'
      throw error
    }

    try {
      console.log('📤 Отправка запроса на /auth/login...')
      if (typeof initData === 'string' && initData.length > 0) {
        console.log('initData первые 50 символов:', initData.substring(0, 50))
      } else {
        console.log('initData тип:', typeof initData, 'значение:', initData)
      }
      const response = await apiClient.post('/auth/login', { initData })
      console.log('✅ Авторизация успешна!')
      const { access_token, user } = response.data

      localStorage.setItem('token', access_token)
      set({ token: access_token, user })
    } catch (error: any) {
      console.error('❌ Ошибка авторизации:', error)
      console.error('Статус:', error.response?.status)
      console.error('Данные ответа:', error.response?.data)
      console.error('Заголовки запроса:', error.config?.headers)
      
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || 'Ошибка авторизации Telegram'
        console.error('Детали ошибки 401:', errorMessage)
        
        const telegramError = new Error(errorMessage || 'Ошибка авторизации Telegram. Проверьте настройки бота и домена.')
        ;(telegramError as any).code = 'TELEGRAM_AUTH_ERROR'
        throw telegramError
      }
      throw error
    }
  },

  loginAsGuest: async () => {
    try {
      console.log('👤 Вход как гость...')
      const response = await apiClient.post('/auth/guest')
      console.log('✅ Гостевой вход успешен!')
      const { access_token, user } = response.data

      localStorage.setItem('token', access_token)
      set({ token: access_token, user })
    } catch (error: any) {
      console.error('❌ Ошибка гостевого входа:', error)
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },
}))

