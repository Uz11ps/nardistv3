import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient, getImageUrl } from '../api/client'
import './StarterKit.css'

interface StarterKitItem {
  id: string
  name: string
  imageUrl?: string
}

export default function StarterKit() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [starterKit, setStarterKit] = useState<{
    narCoin: number
    starterKit: {
      board: StarterKitItem
      dice: StarterKitItem
      checkers: StarterKitItem
    }
  } | null>(null)

  useEffect(() => {
    checkOnboardingStatus()
    loadStarterKitInfo()
  }, [])

  const loadStarterKitInfo = async () => {
    try {
      const response = await apiClient.get('/onboarding/starter-kit-info')
      setStarterKit(response.data)
    } catch (error) {
      console.error('Failed to load starter kit info:', error)
    }
  }

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
        {/* Элементы стартового набора */}
        {starterKit && (
          <div className="starter-kit-items">
            {/* Базовая доска */}
            <div className="starter-kit-item">
              <div className="starter-kit-item-image">
                {starterKit.starterKit.board.imageUrl ? (
                  <img src={getImageUrl(starterKit.starterKit.board.imageUrl)} alt={starterKit.starterKit.board.name} />
                ) : (
                  <div className="starter-kit-item-placeholder">📋</div>
                )}
              </div>
              <div className="starter-kit-item-name">{starterKit.starterKit.board.name}</div>
            </div>

            {/* Базовые кости */}
            <div className="starter-kit-item">
              <div className="starter-kit-item-image">
                {starterKit.starterKit.dice.imageUrl ? (
                  <img src={getImageUrl(starterKit.starterKit.dice.imageUrl)} alt={starterKit.starterKit.dice.name} />
                ) : (
                  <div className="starter-kit-item-placeholder">🎲</div>
                )}
              </div>
              <div className="starter-kit-item-name">{starterKit.starterKit.dice.name}</div>
            </div>

            {/* Базовые шашки */}
            <div className="starter-kit-item">
              <div className="starter-kit-item-image">
                {starterKit.starterKit.checkers.imageUrl ? (
                  <img src={getImageUrl(starterKit.starterKit.checkers.imageUrl)} alt={starterKit.starterKit.checkers.name} />
                ) : (
                  <div className="starter-kit-item-placeholder">⚫</div>
                )}
              </div>
              <div className="starter-kit-item-name">{starterKit.starterKit.checkers.name}</div>
            </div>

            {/* 1000 NAR койнов */}
            <div className="starter-kit-item starter-kit-item-coin">
              <div className="starter-kit-item-image">
                <div className="starter-kit-item-placeholder">💰</div>
              </div>
              <div className="starter-kit-item-name">{starterKit.narCoin.toLocaleString()} NAR</div>
            </div>
          </div>
        )}

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
