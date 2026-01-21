import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api/client'
import Welcome from './Welcome'
import CreateProfile from './CreateProfile'
import StarterKit from './StarterKit'

type OnboardingStep = 'welcome' | 'profile' | 'starter-kit' | 'complete'

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, init } = useAuthStore()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [onboardingStatus, setOnboardingStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initialize = async () => {
      try {
        await init()
        const currentUser = useAuthStore.getState().user
        
        if (currentUser) {
          // Если это мок-гость, пропускаем онбординг и переходим на главную
          if (currentUser.isGuest) {
            console.log('✅ Мок-гость обнаружен, пропускаем онбординг')
            navigate('/')
            setLoading(false)
            return
          }
          
          // Проверяем статус онбординга
          try {
            const response = await apiClient.get('/onboarding/status')
            const status = response.data
            
            setOnboardingStatus(status)
            
            // Определяем текущий шаг
            // Пользователь считается зарегистрированным только после получения стартового набора
            if (status.starterKitClaimed || status.onboardingCompleted) {
              // Стартовый набор получен - пользователь зарегистрирован, онбординг завершен
              navigate('/')
              return
            } else if (status.profileSetupCompleted) {
              // Профиль заполнен, но стартовый набор еще не получен - показываем стартовый набор
              setCurrentStep('starter-kit')
            } else {
              // Нужно заполнить профиль
              setCurrentStep('profile')
            }
          } catch (error: any) {
            console.error('Failed to load onboarding status:', error)
            // Если ошибка сети и это мок-гость, пропускаем онбординг
            if (currentUser.isGuest && (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error'))) {
              console.log('✅ Мок-гость, пропускаем онбординг из-за недоступности сервера')
              navigate('/')
              return
            }
            // Если ошибка, показываем welcome
            setCurrentStep('welcome')
          }
        } else {
          // Пользователь не авторизован, показываем welcome
          setCurrentStep('welcome')
        }
      } catch (error: any) {
        console.error('Ошибка инициализации:', error)
        setCurrentStep('welcome')
      } finally {
        setLoading(false)
      }
    }
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(26, 26, 26, 0.95) 0%, rgba(11, 12, 14, 0.98) 100%), url(/img/App2.png) no-repeat center center fixed',
          backgroundSize: '100% 100%, cover',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(26, 26, 26, 0.7)',
            zIndex: 0,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>Загрузка...</div>
      </div>
    )
  }

  // Роутинг по шагам онбординга
  switch (currentStep) {
    case 'welcome':
      // Если пользователь авторизован, переходим на профиль
      if (user && onboardingStatus && !onboardingStatus.profileSetupCompleted) {
        // Автоматически переходим на заполнение профиля после welcome
        return <CreateProfile />
      }
      return <Welcome />
    case 'profile':
      return <CreateProfile />
    case 'starter-kit':
      return <StarterKit />
    default:
      // Онбординг завершен или ошибка - переходим на главную
      if (user && onboardingStatus?.onboardingCompleted) {
        navigate('/')
        return null
      }
      return <Welcome />
  }
}
