import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './ClanCreate.css'

export default function ClanCreate() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name.trim()) {
      alert('Введите название федерации')
      return
    }

    try {
      setLoading(true)
      const response = await apiClient.post('/clans/create', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })
      alert('Федерация успешно создана!')
      navigate(`/clans/${response.data.id}/manage`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при создании федерации')
      console.error('Failed to create clan:', error)
    } finally {
      setLoading(false)
    }
  }

  if ((user?.level || 0) < 10) {
    return (
      <PageLayout title="Создание федерации" showBack={true}>
        <div className="clans-unavailable">
          <img src="/img/кланы.png" alt="Federations" className="clans-unavailable-icon" />
          <h2 className="clans-unavailable-title">Создание федерации недоступно</h2>
          <p className="clans-unavailable-text">
            Федерации открываются с 10 уровня. Прокачайся, играй в турнирах и зарабатывай очки!
          </p>
          <button className="clans-play-button" onClick={() => navigate('/')}>
            Играть
          </button>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Создание федерации" showBack={true}>
      <div className="clan-create-content">
        {/* Эмблема клана */}
        <div className="clan-create-emblem">
          <img src="/img/кланы.png" alt="Clan" className="clan-create-emblem-icon" />
        </div>

        {/* Заголовок */}
        <div className="clan-create-title">Создай федерацию</div>
        <div className="clan-create-subtitle">
          и начни свой путь к господству в городе
        </div>

        {/* Форма */}
        <form className="clan-create-form" onSubmit={handleSubmit}>
          <div className="clan-create-form-group">
            <label className="clan-create-label">Название клана</label>
            <input
              type="text"
              className="clan-create-input"
              placeholder="Введите название"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={50}
            />
          </div>

          <div className="clan-create-form-group">
            <label className="clan-create-label">Описание (необязательно)</label>
            <textarea
              className="clan-create-textarea"
              placeholder="Краткое описание"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={200}
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="clan-create-submit-button"
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Создать клан'}
          </button>
        </form>

        <div className="clan-create-footer">
          После создания клана ты сможешь приглашать участников и улучшать район
        </div>
      </div>
    </PageLayout>
  )
}
