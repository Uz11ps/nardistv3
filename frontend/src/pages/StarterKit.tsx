import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './StarterKit.css'

export default function StarterKit() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
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
    if (loading || claimed) return
    
    try {
      setLoading(true)
      await apiClient.post('/onboarding/claim-starter-kit')
      await apiClient.post('/onboarding/complete')
      setClaimed(true)
      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (error: any) {
      console.error('Failed to claim starter kit:', error)
      alert(error.response?.data?.message || 'Ошибка получения набора')
      setLoading(false)
    }
  }

  return (
    <PageLayout 
      title="Твой стартовый набор!" 
      subtitle="С этого набора начинается твоя легенда"
      showBack={true}
    >
      <div className="starter-kit-content">
        {/* Контент набора - пустая область для изображения */}
        <div className="starter-kit-image-placeholder">
          {/* Здесь будет изображение набора */}
        </div>

        {/* Кнопка забрать набор */}
        {claimed ? (
          <div className="starter-kit-claimed">
            <div className="starter-kit-claimed-title">Набор получен!</div>
            <div className="starter-kit-claimed-subtitle">Перенаправление на главный экран...</div>
          </div>
        ) : (
          <button
            className="starter-kit-claim-btn"
            onClick={handleClaim}
            disabled={loading}
          >
            {loading ? 'Получение...' : 'Забрать набор'}
          </button>
        )}
      </div>
    </PageLayout>
  )
}
