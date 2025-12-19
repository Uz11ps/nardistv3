import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'

export default function Welcome() {
  const navigate = useNavigate()
  const { user, login } = useAuthStore()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: '40px' }}>
        <h1
          style={{
            fontSize: '48px',
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: '16px',
            textShadow: '0 4px 12px rgba(255, 51, 51, 0.3)',
          }}
        >
          НАРДИСТ
        </h1>
        <p
          style={{
            fontSize: '18px',
            color: '#aaaaaa',
            maxWidth: '400px',
            lineHeight: '1.6',
          }}
        >
          Добро пожаловать в мир нард
        </p>
      </div>

      <Button
        variant="primary"
        onClick={async () => {
          if (user) {
            navigate('/onboarding/profile')
          } else {
            try {
              await login()
              navigate('/onboarding/profile')
            } catch (error: any) {
              console.error('Ошибка авторизации:', error)
              alert('Ошибка авторизации. Убедитесь что вы открыли приложение через Telegram бота.')
            }
          }
        }}
        style={{
          padding: '16px 48px',
          fontSize: '18px',
          fontWeight: 600,
          borderRadius: '12px',
          minWidth: '200px',
        }}
      >
        Начать
      </Button>
    </div>
  )
}

