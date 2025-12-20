import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { initTelegram } from './config/telegram'
import { useAuthStore } from './store/authStore'
import { connectWebSocket } from './api/websocket'
import ErrorBoundary from './components/ErrorBoundary'
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
import Admin from './pages/Admin'
import Inventory from './pages/Inventory'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Leaderboard from './pages/Leaderboard'
import GameModes from './pages/GameModes'
import Achievements from './pages/Achievements'
import GameResult from './pages/GameResult'
import Welcome from './pages/Welcome'
import CreateProfile from './pages/CreateProfile'
import StarterKit from './pages/StarterKit'
import ClanSearch from './pages/ClanSearch'
import ClanDetail from './pages/ClanDetail'
import ClanCreate from './pages/ClanCreate'
import ClanManage from './pages/ClanManage'
import ClanTreasury from './pages/ClanTreasury'
import ClanUpgrades from './pages/ClanUpgrades'
import ClanMembers from './pages/ClanMembers'

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
      try {
        connectWebSocket(token)
      } catch (error) {
        console.error('Ошибка подключения WebSocket:', error)
      }
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

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Админ-панель доступна без авторизации Telegram */}
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/*" element={<Admin />} />
          
          {/* Роуты онбординга */}
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/onboarding/profile" element={<Onboarding />} />
          <Route path="/onboarding/starter-kit" element={<Onboarding />} />
          
          {/* Остальные маршруты требуют авторизации */}
          {!user ? (
            <Route path="*" element={<Onboarding />} />
          ) : (
            <>
              <Route path="/" element={<Home />} />
              <Route path="/game/:gameId" element={<Game />} />
              <Route path="/game/new" element={<Game />} />
              <Route path="/game/search" element={<GameSearch />} />
              <Route path="/game/tables" element={<GameSearch />} />
              <Route path="/game/modes" element={<GameModes />} />
              <Route path="/game/result" element={<GameResult />} />
              <Route path="/game/result/:gameId" element={<GameResult />} />
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
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/clans" element={<Clans />} />
              <Route path="/clans/search" element={<ClanSearch />} />
              <Route path="/clans/create" element={<ClanCreate />} />
              <Route path="/clans/:clanId/manage" element={<ClanManage />} />
              <Route path="/clans/:clanId/treasury" element={<ClanTreasury />} />
              <Route path="/clans/:clanId/upgrades" element={<ClanUpgrades />} />
              <Route path="/clans/:clanId/members" element={<ClanMembers />} />
              <Route path="/clans/:clanId" element={<ClanDetail />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
