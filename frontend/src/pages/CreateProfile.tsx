import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'

export default function CreateProfile() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [formData, setFormData] = useState({
    nickname: '',
    name: '',
    country: '',
    avatarUrl: '',
  })
  const [loading, setLoading] = useState(false)
  const [countries] = useState([
    'Россия',
    'Украина',
    'Беларусь',
    'Казахстан',
    'Узбекистан',
    'Азербайджан',
    'Армения',
    'Грузия',
    'Молдова',
    'Кыргызстан',
    'Таджикистан',
    'Туркменистан',
    'Другая',
  ])
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    if (user) {
      // Заполняем данные из Telegram
      setFormData({
        nickname: user.nickname || user.username || '',
        name: user.firstName || user.username || '',
        country: user.country || '',
        avatarUrl: user.avatarUrl || '',
      })
    }
  }, [user])

  const handleSubmit = async () => {
    if (!formData.nickname.trim()) {
      alert('Введите никнейм')
      return
    }

    try {
      setLoading(true)
      await apiClient.post('/onboarding/complete-profile', {
        nickname: formData.nickname,
        country: formData.country,
        avatarUrl: formData.avatarUrl,
      })
      // Обновляем статус через API и позволяем Onboarding определить следующий шаг
      // Или просто переходим на starter-kit через navigate
      window.location.href = '/onboarding/starter-kit'
    } catch (error: any) {
      console.error('Failed to save profile:', error)
      alert(error.response?.data?.message || 'Ошибка сохранения профиля')
      setLoading(false)
    }
  }

  const handleUseTelegramPhoto = () => {
    if (user?.avatarUrl) {
      setFormData({ ...formData, avatarUrl: user.avatarUrl })
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Создай свой профиль" />
      
      <div style={{ padding: '20px' }}>
        {/* Аватарка */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: '#3a3a3a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              marginBottom: '12px',
              border: '3px solid #4a4a4a',
            }}
          >
            {formData.avatarUrl ? (
              <img
                src={formData.avatarUrl}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ fontSize: '64px' }}>👤</div>
            )}
          </div>
          <button
            onClick={handleUseTelegramPhoto}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaaaaa',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Использовать фото из телеграмма
          </button>
        </div>

        <Card style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#aaaaaa', marginBottom: '8px' }}>
              Логин
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Логин"
              style={{
                width: '100%',
                padding: '12px',
                background: '#3a3a3a',
                border: '1px solid #4a4a4a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#aaaaaa', marginBottom: '8px' }}>
              Имя
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Имя"
              style={{
                width: '100%',
                padding: '12px',
                background: '#3a3a3a',
                border: '1px solid #4a4a4a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px',
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#aaaaaa', marginBottom: '8px' }}>
              Страна
            </label>
            <div
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#3a3a3a',
                border: '1px solid #4a4a4a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{formData.country || 'Выберите страну'}</span>
              <span style={{ color: '#666666' }}>→</span>
            </div>

            {showCountryDropdown && (
              <Card
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 100,
                }}
              >
                {countries.map((country) => (
                  <div
                    key={country}
                    onClick={() => {
                      setFormData({ ...formData, country })
                      setShowCountryDropdown(false)
                    }}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      color: '#ffffff',
                      borderBottom: '1px solid #3a3a3a',
                    }}
                  >
                    {country}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </Card>

        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          disabled={loading || !formData.nickname.trim()}
          style={{ marginTop: '24px' }}
        >
          {loading ? 'Сохранение...' : 'Продолжить'}
        </Button>
      </div>
    </div>
  )
}

