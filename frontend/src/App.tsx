import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { initTelegram } from './config/telegram'
import { useAuthStore } from './store/authStore'
import { connectWebSocket } from './api/websocket'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import Game from './pages/Game'
import Profile from './pages/Profile'
import City from './pages/City'
import Tournaments from './pages/Tournaments'
import Academy from './pages/Academy'
import History from './pages/History'
import Shop from './pages/Shop'
import Quests from './pages/Quests'
import Clans from './pages/Clans'
import GameSearch from './pages/GameSearch'

function App() {
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const { user, init, token } = useAuthStore()

  useEffect(() => {
    const initialize = async () => {
      try {
        initTelegram()
        await init()
        setInitialized(true)
      } catch (error: any) {
        console.error('Ошибка инициализации:', error)
        setInitError(error.message || 'Ошибка инициализации приложения')
        setInitialized(true) // Устанавливаем true чтобы показать ошибку
      }
    }
    initialize()
  }, [init])

  useEffect(() => {
    if (token && initialized) {
      connectWebSocket(token)
    }
  }, [token, initialized])

  if (!initialized) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: '#1a1a1a',
        color: '#ffffff'
      }}>
        Загрузка...
      </div>
    )
  }

  if (initError && !user) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: '#1a1a1a',
        color: '#ffffff',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ color: '#ff3333', marginBottom: '20px' }}>Ошибка инициализации</h1>
          <p style={{ marginBottom: '20px', color: '#aaaaaa' }}>{initError}</p>
          <div style={{ padding: '16px', background: '#2a2a2a', borderRadius: '12px', textAlign: 'left', fontSize: '14px' }}>
            <p style={{ marginBottom: '12px' }}>Убедитесь что:</p>
            <ul style={{ paddingLeft: '20px', color: '#aaaaaa' }}>
              <li>Вы открыли приложение через Telegram бота</li>
              <li>Домен nardist.site привязан к боту через @BotFather</li>
              <li>На сервере настроены переменные окружения</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Onboarding />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:gameId" element={<Game />} />
        <Route path="/game/new" element={<Game />} />
        <Route path="/game/search" element={<GameSearch />} />
        <Route path="/game/tables" element={<GameSearch />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/city" element={<City />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:tournamentId" element={<Tournaments />} />
        <Route path="/academy" element={<Academy />} />
        <Route path="/academy/:materialId" element={<Academy />} />
        <Route path="/academy/publish" element={<Academy />} />
        <Route path="/history" element={<History />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/inventory" element={<Profile />} />
        <Route path="/notifications" element={<Profile />} />
        <Route path="/settings" element={<Profile />} />
        <Route path="/clans" element={<Clans />} />
        <Route path="/clans/:clanId" element={<Clans />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
