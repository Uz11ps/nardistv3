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
  const { user, init, token } = useAuthStore()

  useEffect(() => {
    initTelegram()
    init().then(() => setInitialized(true))
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
