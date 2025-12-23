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
  // Проверяем, является ли это админским эндпоинтом
  const isAdminEndpoint = config.url?.startsWith('/admin') || false
  
  if (isAdminEndpoint) {
    // Для админ-запросов используем admin_token
    const adminToken = localStorage.getItem('admin_token')
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`
    }
  } else {
    // Для обычных запросов используем user token (НЕ admin_token!)
    const userToken = localStorage.getItem('token')
    if (userToken) {
      config.headers.Authorization = `Bearer ${userToken}`
    }
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
 * ВСЕ скины используют единый путь /uploads/skins/
 * Если imageUrl уже полный URL - возвращает как есть
 * Если относительный путь - добавляет базовый URL
 */
export const getImageUrl = (imageUrl?: string | null): string | undefined => {
  if (!imageUrl) return undefined
  
  // Если это уже полный URL (http:// или https://)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // ЕДИНЫЙ ПУТЬ: ВСЕ скины через /uploads/skins/
  // Nginx отдает файлы напрямую из /app/uploads/skins/ через /uploads/skins/
  if (imageUrl.startsWith('/uploads/')) {
    return imageUrl
  }
  
  // Если путь начинается с /api/uploads/, убираем /api (для старых записей в БД)
  if (imageUrl.startsWith('/api/uploads/')) {
    return imageUrl.replace('/api/uploads/', '/uploads/')
  }
  
  // Если путь начинается с /img/ - это иконки интерфейса и дефолтные изображения, оставляем как есть
  if (imageUrl.startsWith('/img/')) {
    return imageUrl
  }
  
  // Если путь начинается с /skins/ - это дефолтные скины из public/skins/, оставляем как есть
  // Они должны быть доступны напрямую через веб-сервер
  if (imageUrl.startsWith('/skins/')) {
    return imageUrl
  }
  
  // Для других путей (если вдруг есть)
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
}

export default apiClient

