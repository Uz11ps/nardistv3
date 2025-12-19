import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Глобальная обработка необработанных ошибок
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанное обещание:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

