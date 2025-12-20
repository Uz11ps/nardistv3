import axios from 'axios'

// Для production используем относительный путь /api, для dev - полный URL
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000')

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Формирует полный URL для изображения
 * Если imageUrl уже полный URL - возвращает как есть
 * Если относительный путь - добавляет базовый URL
 */
export const getImageUrl = (imageUrl?: string | null): string | undefined => {
  if (!imageUrl) return undefined
  
  // Если это уже полный URL (http:// или https://)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // Если путь начинается с /uploads/, в production это идет напрямую через nginx
  // В dev нужно добавить базовый URL бэкенда
  if (imageUrl.startsWith('/uploads/')) {
    if (import.meta.env.PROD) {
      // В production используем относительный путь (nginx проксирует)
      return imageUrl
    } else {
      // В dev добавляем полный URL бэкенда
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const baseURL = API_URL.replace('/api', '')
      return `${baseURL}${imageUrl}`
    }
  }
  
  // Для других путей (если вдруг есть)
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
}

export default apiClient

