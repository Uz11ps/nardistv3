import WebApp from '@twa-dev/sdk'

// Проверяем что мы в Telegram WebView
const isTelegramWebView = typeof window !== 'undefined' && 
  (window as any).Telegram?.WebApp !== undefined

export function initTelegram() {
  if (!isTelegramWebView) {
    console.warn('Приложение запущено не в Telegram WebView')
    // Устанавливаем темную тему по умолчанию
    document.documentElement.setAttribute('data-theme', 'dark')
    return null
  }
  
  try {
    WebApp.ready()
    WebApp.expand()
    
    if (WebApp.colorScheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    
    return WebApp
  } catch (error) {
    console.error('Ошибка инициализации Telegram WebApp:', error)
    document.documentElement.setAttribute('data-theme', 'dark')
    return null
  }
}

export function getInitData(): string {
  if (!isTelegramWebView) {
    return ''
  }
  
  try {
    return WebApp.initData || ''
  } catch (error) {
    console.error('Ошибка получения initData:', error)
    return ''
  }
}

