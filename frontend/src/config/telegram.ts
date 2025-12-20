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
  // Проверяем разные способы получения initData
  let initData = ''
  
  // Способ 1: через @twa-dev/sdk
  if (isTelegramWebView) {
    try {
      initData = WebApp.initData || ''
      if (initData) {
        console.log('✅ initData получен через WebApp.initData, длина:', initData.length)
        return initData
      }
    } catch (error) {
      console.warn('Ошибка получения через WebApp.initData:', error)
    }
  }
  
  // Способ 2: через window.Telegram.WebApp напрямую
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    try {
      const telegramWebApp = (window as any).Telegram.WebApp
      initData = telegramWebApp.initData || telegramWebApp.initDataUnsafe || ''
      if (initData) {
        console.log('✅ initData получен через window.Telegram.WebApp, длина:', initData.length)
        return initData
      }
    } catch (error) {
      console.warn('Ошибка получения через window.Telegram.WebApp:', error)
    }
  }
  
  // Способ 3: через URL параметры (если есть)
  if (typeof window !== 'undefined' && window.location.search) {
    const urlParams = new URLSearchParams(window.location.search)
    initData = urlParams.get('tgWebAppData') || urlParams.get('initData') || ''
    if (initData) {
      console.log('✅ initData получен из URL параметров, длина:', initData.length)
      return initData
    }
  }
  
  // Если ничего не найдено
  console.error('❌ WebApp.initData не доступен!')
  console.error('Проверка окружения:')
  console.error('- isTelegramWebView:', isTelegramWebView)
  console.error('- window.Telegram:', typeof window !== 'undefined' ? (window as any).Telegram : 'undefined')
  console.error('- WebApp:', typeof WebApp !== 'undefined' ? WebApp : 'undefined')
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    console.error('- WebApp.initData:', (window as any).Telegram.WebApp.initData)
    console.error('- WebApp.initDataUnsafe:', (window as any).Telegram.WebApp.initDataUnsafe)
    console.error('- WebApp.version:', (window as any).Telegram.WebApp.version)
    console.error('- WebApp.platform:', (window as any).Telegram.WebApp.platform)
  }
  console.error('')
  console.error('Проверьте что:')
  console.error('1. Домен nardist.site привязан к боту через @BotFather')
  console.error('2. Вы открыли приложение через кнопку бота в Telegram (не через прямой URL)')
  console.error('3. В @BotFather для вашего бота указан домен: nardist.site')
  
  return ''
}

