// Пробуем импортировать SDK, но не падаем если его нет
let WebApp: any = null
try {
  WebApp = require('@twa-dev/sdk').default || require('@twa-dev/sdk')
} catch (e) {
  console.warn('@twa-dev/sdk не найден, используем window.Telegram.WebApp')
}

// Проверяем что мы в Telegram WebView
const isTelegramWebView = typeof window !== 'undefined' && 
  ((window as any).Telegram?.WebApp !== undefined || WebApp !== null)

export function initTelegram() {
  // Пробуем получить WebApp объект разными способами
  let telegramWebApp: any = null
  
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    telegramWebApp = (window as any).Telegram.WebApp
    console.log('✅ Telegram.WebApp найден через window.Telegram.WebApp')
  } else if (WebApp) {
    telegramWebApp = WebApp
    console.log('✅ Telegram.WebApp найден через @twa-dev/sdk')
  }
  
  if (!telegramWebApp) {
    console.warn('⚠️ Приложение запущено не в Telegram WebView')
    console.warn('window.Telegram:', typeof window !== 'undefined' ? (window as any).Telegram : 'undefined')
    // Устанавливаем темную тему по умолчанию
    document.documentElement.setAttribute('data-theme', 'dark')
    return null
  }
  
  try {
    if (telegramWebApp.ready) {
      telegramWebApp.ready()
    }
    if (telegramWebApp.expand) {
      telegramWebApp.expand()
    }
    
    if (telegramWebApp.colorScheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    
    console.log('✅ Telegram WebApp инициализирован')
    console.log('WebApp версия:', telegramWebApp.version)
    console.log('WebApp платформа:', telegramWebApp.platform)
    
    return telegramWebApp
  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram WebApp:', error)
    document.documentElement.setAttribute('data-theme', 'dark')
    return null
  }
}

export function getInitData(): string {
  // Проверяем разные способы получения initData
  let initData = ''
  
  // Способ 1: через window.Telegram.WebApp напрямую (приоритет)
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    try {
      const telegramWebApp = (window as any).Telegram.WebApp
      initData = telegramWebApp.initData || telegramWebApp.initDataUnsafe || ''
      if (initData) {
        console.log('✅ initData получен через window.Telegram.WebApp.initData, длина:', initData.length)
        return initData
      }
    } catch (error) {
      console.warn('Ошибка получения через window.Telegram.WebApp:', error)
    }
  }
  
  // Способ 2: через @twa-dev/sdk
  if (WebApp && isTelegramWebView) {
    try {
      initData = WebApp.initData || ''
      if (initData) {
        console.log('✅ initData получен через WebApp.initData (SDK), длина:', initData.length)
        return initData
      }
    } catch (error) {
      console.warn('Ошибка получения через WebApp.initData (SDK):', error)
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

