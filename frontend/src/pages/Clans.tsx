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
        // У пользователя есть клан - перенаправляем на панель управления
        navigate(`/clans/${response.data.clan.id}/manage`)
        return
      }
    } catch (error) {
      // Пользователь не в клане - показываем обычный интерфейс
      console.log('User has no clan')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  if ((user?.level || 0) < 20) {
    return (
      <PageLayout title="Кланы" showBack={true}>
        <div className="clans-unavailable">
          <img src="/img/кланы.png" alt="Clans" className="clans-unavailable-icon" />
          <h2 className="clans-unavailable-title">Кланы недоступны</h2>
          <p className="clans-unavailable-text">
            Кланы открываются с 20 уровня, прокачайся, играй в турнирах и зарабатывай очки
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
      <PageLayout title="Кланы" showBack={true}>
        <div className="clans-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Кланы" showBack={true}>
      <div className="clans-content">
        {/* Профиль пользователя */}
        <div className="clans-profile">
          <div className="clans-avatar-container">
            <div className="clans-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} />
              ) : (
                <img src="/img/челувек.png" alt="User" className="clans-avatar-placeholder" />
              )}
            </div>
          </div>
          <div className="clans-username">{user?.nickname || user?.firstName || user?.username || 'Игрок'}</div>
          <div className="clans-level">Уровень {user.level || 1}</div>
        </div>

        {/* Кнопки действий */}
        <div className="clans-actions">
          <button className="clans-action-button clans-action-create" onClick={() => navigate('/clans/create')}>
            Создать клан
          </button>
          <button className="clans-action-button clans-action-find" onClick={() => navigate('/clans/search')}>
            Найти клан
          </button>
        </div>
      </div>
    </PageLayout>
  )
}
