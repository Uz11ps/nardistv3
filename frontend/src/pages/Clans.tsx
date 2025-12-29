import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Clans.css'

export default function Clans() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUserClan()
  }, [user])

  const checkUserClan = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const response = await apiClient.get('/clans/my')
      if (response.data?.clan) {
        // У пользователя есть федерация - перенаправляем на панель управления
        // Но только если мы не на странице /clans (чтобы избежать циклов)
        const currentPath = window.location.pathname
        if (currentPath === '/clans' || currentPath.startsWith('/clans/')) {
          navigate(`/clans/${response.data.clan.id}/manage`, { replace: true })
        }
        return
      }
    } catch (error) {
      // Пользователь не в федерации - показываем обычный интерфейс
      console.log('User has no federation')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  if ((user?.level || 0) < 10) {
    return (
      <PageLayout title="Федерации" showBack={true}>
        <div className="clans-unavailable">
          <img src="/img/кланы.png" alt="Federations" className="clans-unavailable-icon" />
          <h2 className="clans-unavailable-title">Федерации недоступны</h2>
          <p className="clans-unavailable-text">
            Федерации открываются с 10 уровня, прокачайся, играй в турнирах и зарабатывай очки
          </p>
          <button className="clans-play-button" onClick={() => navigate('/')}>
            Играть
          </button>
        </div>
      </PageLayout>
    )
  }

  if (loading) {
    return (
      <PageLayout title="Федерации" showBack={true}>
        <div className="clans-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout 
      title="Федерации" 
      subtitle={`создать федерацию можно с 15 уровня, а вступить в федерацию можно с 10 уровня, прокачайся, играй в турнирах и зарабатывай очки`}
      showBack={true}
    >
      <div className="federations-welcome">
        <div className="federations-welcome-shield">
          <img src="/img/кланы.png" alt="Federations" />
        </div>
        
        <button className="federations-welcome-btn" onClick={() => navigate('/clans/search')}>
          Играть
        </button>
      </div>
    </PageLayout>
  )
}
