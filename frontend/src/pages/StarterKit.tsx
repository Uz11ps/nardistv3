import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'

export default function StarterKit() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    // Проверяем статус онбординга
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    try {
      const response = await apiClient.get('/onboarding/status')
      if (response.data.starterKitClaimed) {
        setClaimed(true)
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
    }
  }

  const handleClaim = async () => {
    try {
      setLoading(true)
      const response = await apiClient.post('/onboarding/claim-starter-kit')
      
      // Завершаем онбординг
      await apiClient.post('/onboarding/complete')
      
      setClaimed(true)
      
      // Переход на главный экран через небольшую задержку
      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (error: any) {
      console.error('Failed to claim starter kit:', error)
      alert(error.response?.data?.message || 'Ошибка получения набора')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Твой стартовый набор!" />
      
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p
          style={{
            fontSize: '16px',
            color: '#aaaaaa',
            marginBottom: '32px',
          }}
        >
          С этого набора начинается твоя легенда!
        </p>

        <Card
          style={{
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)',
            border: '2px solid #ffd700',
          }}
        >
          <div style={{ padding: '24px' }}>
            {/* Базовая доска */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  width: '100%',
                  height: '200px',
                  background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  border: '2px solid #654321',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Упрощенное изображение доски */}
                <Icon name="board" size={64} />
              </div>
              <div className="card-title">Базовая доска</div>
              <div className="card-subtitle">Классический дизайн</div>
            </div>

            {/* Разделитель */}
            <div
              style={{
                width: '100%',
                height: '1px',
                background: '#3a3a3a',
                margin: '24px 0',
              }}
            />

            {/* Базовые кости */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <div
                    key={num}
                    style={{
                      width: '50px',
                      height: '50px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 600,
                      color: '#000000',
                      border: '2px solid #cccccc',
                    }}
                  >
                    {num}
                  </div>
                ))}
              </div>
              <div className="card-title">Базовые кости</div>
              <div className="card-subtitle">Набор из 6 костей</div>
            </div>

            {/* Разделитель */}
            <div
              style={{
                width: '100%',
                height: '1px',
                background: '#3a3a3a',
                margin: '24px 0',
              }}
            />

            {/* 1000 койнов */}
            <div>
              <Icon name="coin" size={48} style={{ marginBottom: '12px' }} />
              <div className="card-title" style={{ fontSize: '32px', marginBottom: '8px' }}>
                1 000 NAR
              </div>
              <div className="card-subtitle">Стартовый капитал</div>
            </div>
          </div>
        </Card>

        {claimed ? (
          <div style={{ padding: '20px' }}>
            <Icon name="party" size={64} style={{ marginBottom: '16px' }} />
            <div className="card-title" style={{ marginBottom: '8px' }}>
              Набор получен!
            </div>
            <div className="card-subtitle">Перенаправление на главный экран...</div>
          </div>
        ) : (
          <Button
            variant="primary"
            fullWidth
            onClick={handleClaim}
            disabled={loading}
            style={{
              padding: '16px',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            {loading ? 'Получение...' : 'Забрать набор'}
          </Button>
        )}
      </div>
    </div>
  )
}

