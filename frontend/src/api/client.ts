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
  // Для админ-запросов используем admin_token, иначе обычный token
  const adminToken = localStorage.getItem('admin_token')
  const userToken = localStorage.getItem('token')
  const token = adminToken || userToken
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
  
  // Если путь начинается с /uploads/, нужно добавить /api префикс
  // потому что бэкенд отдает файлы через /api/uploads/ prefix
  if (imageUrl.startsWith('/uploads/')) {
    // Убираем ведущий слэш для consistency
    const path = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl
    
    if (import.meta.env.PROD) {
      // В production используем /api/uploads/... (nginx проксирует на бэкенд)
      return `/api/${path}`
    } else {
      // В dev добавляем полный URL бэкенда
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const baseURL = API_URL.replace('/api', '')
      return `${baseURL}/api/${path}`
    }
  }
  
  // Если путь уже содержит /api/uploads/, возвращаем как есть
  if (imageUrl.startsWith('/api/uploads/')) {
    if (import.meta.env.PROD) {
      return imageUrl
    } else {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const baseURL = API_URL.replace('/api', '')
      return `${baseURL}${imageUrl}`
    }
  }
  
  // Для других путей (если вдруг есть)
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
}

export default apiClient

