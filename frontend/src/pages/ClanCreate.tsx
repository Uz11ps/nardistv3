import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'
import './ClanCreate.css'

export default function ClanCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name.trim()) {
      alert('Введите название клана')
      return
    }

    try {
      setLoading(true)
      const response = await apiClient.post('/clans/create', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })
      alert('Клан успешно создан!')
      navigate(`/clans/${response.data.id}/manage`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при создании клана')
      console.error('Failed to create clan:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Создать клан" />
      
      <div className="clan-create-content">
        {/* Эмблема клана */}
        <div className="clan-create-emblem">
          <Icon name="shield" size={80} style={{ color: '#ffd700' }} />
        </div>

        {/* Заголовок */}
        <div className="clan-create-title">Создай клан</div>
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

          <Button
            type="submit"
            variant="primary"
            className="clan-create-submit-btn"
            disabled={loading}
          >
            Создать клан
          </Button>
        </form>

        <div className="clan-create-footer">
          После создания клана ты сможешь приглашать участников и улучшать район
        </div>
      </div>    </div>
  )
}
