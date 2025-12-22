import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './CreateProfile.css'

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
        name: user.firstName || user.username || 'Алексей',
        country: user.country || 'Россия',
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
    <PageLayout title="Создай свой профиль" showBack={true}>
      <div className="create-profile-content">
        {/* Аватарка */}
        <div className="create-profile-avatar-section">
          <div className="create-profile-avatar">
            {formData.avatarUrl ? (
              <img
                src={formData.avatarUrl}
                alt="Avatar"
                className="create-profile-avatar-img"
              />
            ) : (
              <div className="create-profile-avatar-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#B6B6B6"/>
                  <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="#B6B6B6"/>
                </svg>
              </div>
            )}
          </div>
          <button
            className="create-profile-use-telegram-btn"
            onClick={handleUseTelegramPhoto}
          >
            Использовать фото из телеграмма
          </button>
        </div>

        {/* Форма */}
        <div className="create-profile-form-card">
          <div className="create-profile-field">
            <label className="create-profile-label">Логин</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Логин"
              className="create-profile-input"
            />
          </div>

          <div className="create-profile-field">
            <label className="create-profile-label">Имя</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Имя"
              className="create-profile-input"
            />
          </div>

          <div className="create-profile-field">
            <label className="create-profile-label">Страна</label>
            <div
              className="create-profile-select"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            >
              <span>{formData.country || 'Выберите страну'}</span>
              <span className="create-profile-select-arrow">→</span>
            </div>

            {showCountryDropdown && (
              <div className="create-profile-dropdown">
                {countries.map((country) => (
                  <div
                    key={country}
                    className="create-profile-dropdown-item"
                    onClick={() => {
                      setFormData({ ...formData, country })
                      setShowCountryDropdown(false)
                    }}
                  >
                    {country}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Кнопка продолжить */}
        <button
          className="create-profile-submit-btn"
          onClick={handleSubmit}
          disabled={loading || !formData.nickname.trim()}
        >
          {loading ? 'Сохранение...' : 'Продолжить'}
        </button>
      </div>
    </PageLayout>
  )
}
