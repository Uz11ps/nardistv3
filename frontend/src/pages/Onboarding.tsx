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
          // Проверяем статус онбординга
          try {
            const response = await apiClient.get('/onboarding/status')
            const status = response.data
            
            setOnboardingStatus(status)
            
            // Определяем текущий шаг
            if (status.onboardingCompleted) {
              // Онбординг завершен, переходим на главную
              navigate('/')
              return
            } else if (status.starterKitClaimed) {
              // Набор получен, но что-то не так
              navigate('/')
              return
            } else if (status.profileSetupCompleted) {
              // Профиль заполнен, показываем стартовый набор
              setCurrentStep('starter-kit')
            } else {
              // Нужно заполнить профиль
              setCurrentStep('profile')
            }
          } catch (error) {
            console.error('Failed to load onboarding status:', error)
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
          background: '#1a1a1a',
          color: '#ffffff',
        }}
      >
        Загрузка...
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
