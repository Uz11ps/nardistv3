import WebApp from '@twa-dev/sdk'

export function initTelegram() {
  WebApp.ready()
  WebApp.expand()
  
  if (WebApp.colorScheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
  
  return WebApp
}

export function getInitData(): string {
  return WebApp.initData || ''
}

