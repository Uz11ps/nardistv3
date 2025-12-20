import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Icon from '../components/Icon'
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
      <div className="app-container">
        <PageHeader title="Кланы" />
        <div className="clans-locked">
          <Icon name="shield" size={64} />
          <div className="clans-locked-title">Кланы недоступны</div>
          <div className="clans-locked-subtitle">
            Кланы открываются с 20 уровня, прокачайся, играй в турнирах и зарабатывай очки
          </div>
          <Button onClick={() => navigate('/')}>Играть</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-container">
        <PageHeader title="Кланы" />
        <div className="clans-locked">Загрузка...</div>
      </div>
    )
  }

  const handleCreateClan = async () => {
    try {
      setLoading(true)
      // Переход на страницу создания клана
      navigate('/clans/create')
    } catch (error) {
      console.error('Failed to navigate:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFindClan = async () => {
    navigate('/clans/search')
  }

  return (
    <div className="app-container">
      <PageHeader title="Кланы" />
      
      <div className="clans-content">
        {/* Профиль пользователя */}
        <div className="clans-profile">
          <div className="clans-avatar-container">
            <div className="avatar avatar-large">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} />
              ) : (
                <Icon name="user" size={64} />
              )}
            </div>
          </div>
          <div className="clans-username">{user?.nickname || user?.username || 'Игрок'}</div>
          <div className="clans-level">Уровень {user.level || 1}</div>
        </div>

        {/* Кнопки действий */}
        <div className="clans-actions">
          <Button
            variant="primary"
            className="clans-action-btn clans-action-create"
            onClick={handleCreateClan}
            disabled={loading}
          >
            Создать клан
          </Button>
          <Button
            variant="secondary"
            className="clans-action-btn clans-action-find"
            onClick={handleFindClan}
            disabled={loading}
          >
            Найти клан
          </Button>
        </div>
      </div>
    </div>
  )
}