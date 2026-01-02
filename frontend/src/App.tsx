import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { initTelegram } from './config/telegram'
import { useAuthStore } from './store/authStore'
import { connectWebSocket } from './api/websocket'
import { apiClient } from './api/client'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import Game from './pages/Game'
import Profile from './pages/Profile'
import City from './pages/City'
import Tournaments from './pages/Tournaments'
import TournamentDetail from './pages/TournamentDetail'
import Academy from './pages/Academy'
import History from './pages/History'
import Shop from './pages/Shop'
import Subscription from './pages/Subscription'
import Quests from './pages/Quests'
import Clans from './pages/Clans'
import GameSearch from './pages/GameSearch'
import GameTables from './pages/GameTables'
import CreateTable from './pages/CreateTable'
import Admin from './pages/Admin'
import Inventory from './pages/Inventory'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Leaderboard from './pages/Leaderboard'
import GameModes from './pages/GameModes'
import BotGameMode from './pages/BotGameMode'
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
import Policy from './pages/Policy'
import Referrals from './pages/Referrals'
import FairPlayVerification from './pages/FairPlayVerification'
import Business from './pages/Business'

function App() {
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const { user, init, token, banReason } = useAuthStore()

  useEffect(() => {
    const initialize = async () => {
      try {
        initTelegram()
        await init()
        
        // Если нет пользователя и нет Telegram initData, автоматически входим как гость
        const { user, loginAsGuest } = useAuthStore.getState()
        const initData = (window as any).Telegram?.WebApp?.initData
        
        if (!user && !initData) {
          console.log('🌐 Telegram не обнаружен, выполняем гостевой вход...')
          try {
            await loginAsGuest()
          } catch (error) {
            console.error('Ошибка гостевого входа:', error)
            // Продолжаем работу даже если гостевой вход не удался
          }
        }
        
        setInitialized(true)
      } catch (error: any) {
        console.error('Ошибка инициализации:', error)
        // Если ошибка связана с отсутствием Telegram, пробуем гостевой вход
        if (error.code === 'NO_INIT_DATA' || error.message?.includes('initData')) {
          try {
            const { loginAsGuest } = useAuthStore.getState()
            await loginAsGuest()
            setInitialized(true)
            return
          } catch (guestError) {
            console.error('Ошибка гостевого входа:', guestError)
          }
        }
        setInitError(error.message || 'Ошибка инициализации приложения')
        setInitialized(true) // Устанавливаем true чтобы показать ошибку
      }
    }
    initialize()
  }, [init])

  useEffect(() => {
    if (token && initialized) {
      const { user } = useAuthStore.getState()
      // Пропускаем подключение WebSocket для мок-гостей (сервер недоступен)
      if (user?.isGuest) {
        console.log('⚠️ Мок-гость обнаружен, пропускаем подключение WebSocket')
        return
      }
      try {
        connectWebSocket(token)
      } catch (error) {
        console.error('Ошибка подключения WebSocket:', error)
      }
    }
  }, [token, initialized])

  // Проверяем активную игру при инициализации
  useEffect(() => {
    const checkActiveGame = async () => {
      if (!user || !initialized) return

      // Проверяем, не находимся ли мы уже на странице игры
      const currentPath = window.location.pathname
      if (currentPath.startsWith('/game/') && currentPath !== '/game/search' && currentPath !== '/game/tables' && currentPath !== '/game/tables/create' && currentPath !== '/game/modes' && currentPath !== '/game/result') {
        // Уже на странице игры, не перенаправляем
        return
      }

      try {
        const response = await apiClient.get('/games/active')
        // Поддержка нового формата { game: {...} } и старого формата (прямой объект)
        const activeGame = response.data?.game || response.data

        if (activeGame && activeGame.id) {
          console.log('🎮 Найдена активная игра:', activeGame.id, 'Перенаправляем...')
          // Перенаправляем на страницу игры
          window.location.href = `/game/${activeGame.id}`
        }
      } catch (error: any) {
        // Если ошибка 404 или 500 - игнорируем (значит нет активной игры)
        if (error.response?.status !== 404 && error.response?.status !== 500) {
          console.error('Ошибка при проверке активной игры:', error)
        }
      }
    }

    // Небольшая задержка, чтобы дать время для инициализации роутера
    const timer = setTimeout(() => {
      checkActiveGame()
    }, 500)

    return () => clearTimeout(timer)
  }, [user, initialized])

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

  // Заглушка для забаненных пользователей
  if (banReason) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)',
        color: '#ffffff',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚫</div>
          <h1 style={{ color: '#ff3333', marginBottom: '20px', fontSize: '28px', fontWeight: 'bold' }}>
            Доступ запрещен
          </h1>
          <div style={{ 
            padding: '24px', 
            background: '#2a2a2a', 
            borderRadius: '16px', 
            marginBottom: '20px',
            border: '2px solid #ff3333'
          }}>
            <p style={{ fontSize: '18px', marginBottom: '12px', color: '#ffffff' }}>
              Вы были забанены по причине:
            </p>
            <p style={{ fontSize: '16px', color: '#ff6666', fontWeight: '500' }}>
              {banReason}
            </p>
          </div>
          <p style={{ color: '#aaaaaa', fontSize: '14px' }}>
            Если вы считаете, что это ошибка, свяжитесь с администрацией
          </p>
        </div>
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
              <Route path="/game/:gameId/verification" element={<FairPlayVerification />} />
              <Route path="/game/new" element={<Game />} />
              <Route path="/game/search" element={<GameSearch />} />
              <Route path="/game/tables" element={<GameTables />} />
              <Route path="/game/tables/create" element={<CreateTable />} />
              <Route path="/game/modes" element={<GameModes />} />
              <Route path="/game/bot/mode" element={<BotGameMode />} />
              <Route path="/game/result" element={<GameResult />} />
              <Route path="/game/result/:gameId" element={<GameResult />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/city" element={<City />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/:tournamentId" element={<TournamentDetail />} />
              <Route path="/academy" element={<Academy />} />
              <Route path="/academy/:materialId" element={<Academy />} />
              <Route path="/academy/publish" element={<Academy />} />
              <Route path="/history" element={<History />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/subscription" element={<Subscription />} />
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
              <Route path="/policy/:type" element={<Policy />} />
              <Route path="/business" element={<Business />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
