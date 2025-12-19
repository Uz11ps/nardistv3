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
    console.warn('⚠️ Telegram WebView не обнаружен')
    console.warn('window.Telegram:', (window as any).Telegram)
    console.warn('WebApp:', (window as any).Telegram?.WebApp)
    return ''
  }
  
  try {
    const initData = WebApp.initData || ''
    if (!initData) {
      console.error('❌ WebApp.initData пустой!')
      console.error('WebApp объект:', WebApp)
      console.error('Проверьте что:')
      console.error('1. Домен nardist.site привязан к боту через @BotFather')
      console.error('2. Вы открыли приложение через кнопку бота в Telegram')
    } else {
      console.log('✅ initData получен, длина:', initData.length)
    }
    return initData
  } catch (error) {
    console.error('Ошибка получения initData:', error)
    return ''
  }
}

