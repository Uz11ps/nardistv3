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

// Interceptor для обработки ошибок (включая бан пользователя)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Обрабатываем только ошибки 401 для пользовательских токенов (не админских)
    if (error.response?.status === 401 && !localStorage.getItem('admin_token')) {
      const errorMessage = error.response?.data?.message || ''
      
      // Проверяем, является ли ошибка баном
      if (errorMessage.includes('забанены') || errorMessage.includes('забанен')) {
        // Импортируем store динамически чтобы избежать циклических зависимостей
        import('../store/authStore').then(({ useAuthStore }) => {
          const { setBanReason } = useAuthStore.getState()
          
          // Извлекаем причину из сообщения
          const banMatch = errorMessage.match(/по причине:\s*(.+)/i)
          const reason = banMatch ? banMatch[1] : errorMessage.replace(/Вы были забанены\s*/i, '')
          
          // Удаляем токен и устанавливаем причину бана
          localStorage.removeItem('token')
          setBanReason(reason)
        })
      }
    }
    
    return Promise.reject(error)
  }
)

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
  
  // Если путь начинается с /uploads/, возвращаем как есть
  // Nginx отдает файлы напрямую без /api префикса
  if (imageUrl.startsWith('/uploads/')) {
    return imageUrl
  }
  
  // Если путь начинается с /skins/, возвращаем как есть (файлы из public/skins/)
  if (imageUrl.startsWith('/skins/')) {
    return imageUrl
  }
  
  // Если путь уже содержит /api/uploads/, убираем /api (для старых записей в БД)
  if (imageUrl.startsWith('/api/uploads/')) {
    return imageUrl.replace('/api/uploads/', '/uploads/')
  }
  
  // Для других путей (если вдруг есть)
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
}

export default apiClient

