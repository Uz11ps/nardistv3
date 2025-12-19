import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'

interface OnboardingStep {
  id: string
  title: string
  subtitle: string
  completed: boolean
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, login, init } = useAuthStore()
  const [step, setStep] = useState(0)
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'bot_training',
      title: 'Познакомься с доской',
      subtitle: 'Пройти тренировку с AI',
      completed: false,
    },
    {
      id: 'first_online',
      title: 'Сделай первый ход онлайн',
      subtitle: 'Сыграй матч 1х1',
      completed: false,
    },
    {
      id: 'view_city',
      title: 'Загляни в город',
      subtitle: 'Открыть экран города',
      completed: false,
    },
  ])

  useEffect(() => {
    const initialize = async () => {
      try {
        await init()
        if (!user) {
          try {
            await login()
          } catch (loginError: any) {
            console.error('Ошибка входа:', loginError)
            // Продолжаем работу даже если вход не удался
          }
        }
        // Загружаем прогресс онбординга только если пользователь есть
        if (user) {
          loadOnboardingProgress()
        }
      } catch (error: any) {
        console.error('Ошибка инициализации:', error)
        // Ошибка будет обработана в компоненте
      }
    }
    initialize()
  }, [init, login, user])

  const loadOnboardingProgress = async () => {
    try {
      const response = await apiClient.get('/users/onboarding-progress')
      const progress = response.data
      setSteps((prev) =>
        prev.map((s) => ({
          ...s,
          completed: progress[s.id] || false,
        }))
      )
    } catch (error) {
      console.error('Failed to load onboarding progress:', error)
    }
  }

  const handleStepClick = async (stepId: string, index: number) => {
    if (steps[index].completed) return

    switch (stepId) {
      case 'bot_training':
        navigate('/game/new?mode=bot')
        break
      case 'first_online':
        navigate('/game/search')
        break
      case 'view_city':
        navigate('/city')
        // Отмечаем как выполненное после просмотра
        try {
          await apiClient.post('/users/complete-onboarding-step', { stepId })
          setSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, completed: true } : s))
          )
        } catch (error) {
          console.error('Failed to complete step:', error)
        }
        break
    }
  }

  const allCompleted = steps.every((s) => s.completed)

  if (!user) {
    return (
      <div className="app-container" style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Добро пожаловать в Нарды!</h1>
        <p style={{ marginTop: '20px', color: '#ff3333' }}>
          ⚠️ Ошибка авторизации через Telegram
        </p>
        <div style={{ marginTop: '20px', padding: '16px', background: '#2a2a2a', borderRadius: '12px', textAlign: 'left' }}>
          <p style={{ fontSize: '14px', marginBottom: '12px' }}>
            Убедитесь что:
          </p>
          <ul style={{ fontSize: '14px', paddingLeft: '20px', color: '#aaaaaa' }}>
            <li>Вы открыли приложение через Telegram бота</li>
            <li>Домен nardist.site привязан к боту через @BotFather</li>
            <li>На сервере настроены TELEGRAM_BOT_TOKEN и TELEGRAM_SECRET_KEY</li>
          </ul>
          <p style={{ fontSize: '12px', marginTop: '16px', color: '#666666' }}>
            Если проблема сохраняется, обратитесь к администратору.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <PageHeader title="Обучение" showBack={false} />
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          {steps.map((s, i) => (
            <Card
              key={s.id}
              onClick={() => handleStepClick(s.id, i)}
              style={{
                marginBottom: '12px',
                opacity: s.completed ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: s.completed ? '#4a4a4a' : '#3a3a3a',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                  }}
                >
                  {s.completed ? '✓' : '○'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="card-title">{s.title}</div>
                  <div className="card-subtitle">{s.subtitle}</div>
                </div>
                <div style={{ fontSize: '20px', color: '#666666' }}>→</div>
              </div>
            </Card>
          ))}
        </div>

        <div
          style={{
            padding: '16px',
            background: '#2a2a2a',
            borderRadius: '12px',
            textAlign: 'center',
            marginTop: '32px',
          }}
        >
          <div style={{ fontSize: '14px', color: '#aaaaaa', marginBottom: '8px' }}>
            За каждый шаг ты получаешь:
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <span className="gold">NAR-coin</span>
            <span>+</span>
            <span style={{ color: '#ff3333' }}>XP</span>
          </div>
        </div>

        {allCompleted && (
          <Button
            fullWidth
            onClick={() => navigate('/')}
            style={{ marginTop: '24px' }}
          >
            Начать игру
          </Button>
        )}
      </div>
    </div>
  )
}
