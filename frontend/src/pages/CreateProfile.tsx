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
    country: '',
    gender: 'Мужской',
    avatarUrl: '',
  })
  const [loading, setLoading] = useState(false)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showGenderDropdown, setShowGenderDropdown] = useState(false)

  const countries = [
    'Австралия', 'Австрия', 'Азербайджан', 'Албания', 'Алжир', 'Ангола', 'Андорра', 'Антигуа и Барбуда', 'Аргентина', 'Армения', 'Афганистан',
    'Багамские Острова', 'Бангладеш', 'Барбадос', 'Бахрейн', 'Беларусь', 'Белиз', 'Бельгия', 'Бенин', 'Болгария', 'Боливия', 'Босния и Герцеговина', 'Ботсвана', 'Бразилия', 'Бруней', 'Буркина-Фасо', 'Бурунди', 'Бутан',
    'Вануату', 'Ватикан', 'Великобритания', 'Венгрия', 'Венесуэла', 'Вьетнам',
    'Габон', 'Гаити', 'Гайана', 'Гамбия', 'Гана', 'Гватемала', 'Гвинея', 'Гвинея-Бисау', 'Германия', 'Гондурас', 'Гренада', 'Греция', 'Грузия',
    'Дания', 'Джибути', 'Доминика', 'Доминиканская Республика',
    'Египет',
    'Замбия', 'Зимбабве',
    'Израиль', 'Индия', 'Индонезия', 'Иордания', 'Ирак', 'Иран', 'Ирландия', 'Исландия', 'Испания', 'Италия',
    'Йемен',
    'Кабо-Верде', 'Казахстан', 'Камбоджа', 'Камерун', 'Канада', 'Катар', 'Кения', 'Кипр', 'Кирибати', 'Китай', 'Колумбия', 'Коморские Острова', 'Конго', 'ДР Конго', 'КНДР', 'Южная Корея', 'Коста-Рика', 'Кот-д\'Ивуар', 'Куба', 'Кувейт', 'Кыргызстан',
    'Лаос', 'Латвия', 'Лесото', 'Либерия', 'Ливан', 'Ливия', 'Литва', 'Лихтенштейн', 'Люксембург',
    'Маврикий', 'Мавритания', 'Мадагаскар', 'Малави', 'Малайзия', 'Мали', 'Мальдивы', 'Мальта', 'Марокко', 'Маршалловы Острова', 'Мексика', 'Микронезия', 'Мозамбик', 'Молдова', 'Монако', 'Монголия', 'Мьянма',
    'Намибия', 'Науру', 'Непал', 'Нигер', 'Нигерия', 'Нидерланды', 'Никарагуа', 'Новая Зеландия', 'Норвегия',
    'ОАЭ', 'Оман',
    'Пакистан', 'Палау', 'Панама', 'Папуа — Новая Гвинея', 'Парагвай', 'Перу', 'Польша', 'Португалия',
    'Россия', 'Руанда', 'Румыния',
    'Сальвадор', 'Самоа', 'Сан-Марино', 'Сан-Томе и Принсипи', 'Саудовская Аравия', 'Северная Македония', 'Сейшельские Острова', 'Сенегал', 'Сент-Винсент и Гренадины', 'Сент-Китс и Невис', 'Сент-Люсия', 'Сербия', 'Сингапур', 'Сирия', 'Словакия', 'Словения', 'Соломоновы Острова', 'Сомали', 'Судан', 'Суринам', 'США', 'Сьерра-Леоне',
    'Таджикистан', 'Таиланд', 'Танзания', 'Того', 'Тонга', 'Тринидад и Тобаго', 'Тувалу', 'Тунис', 'Туркменистан', 'Турция',
    'Уганда', 'Узбекистан', 'Украина', 'Уругвай',
    'Фиджи', 'Филиппины', 'Финляндия', 'Франция',
    'Хорватия', 'ЦАР',
    'Чад', 'Черногория', 'Чехия', 'Чили',
    'Швейцария', 'Швеция', 'Шри-Ланка',
    'Эквадор', 'Экваториальная Гвинея', 'Эритрея', 'Эсватини', 'Эстония', 'Эфиопия',
    'ЮАР', 'Южный Судан',
    'Ямайка', 'Япония'
  ]

  const genders = ['Мужской', 'Женский']

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        nickname: user.nickname || user.username || '',
        country: user.country || 'Россия',
        avatarUrl: user.avatarUrl || '',
      }))
    }
  }, [user])

  const handleSubmit = async () => {
    if (!formData.nickname.trim()) {
      alert('Введите никнейм')
      return
    }
    if (formData.nickname.length > 16) {
      alert('Никнейм не должен превышать 16 символов')
      return
    }

    try {
      setLoading(true)
      await apiClient.post('/onboarding/complete-profile', {
        nickname: formData.nickname,
        country: formData.country,
        gender: formData.gender,
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
        <div className="create-profile-form-card">
          <div className="create-profile-field">
            <label className="create-profile-label">Никнейм</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => {
                const value = e.target.value.slice(0, 16)
                setFormData({ ...formData, nickname: value })
              }}
              placeholder="Никнейм"
              className="create-profile-input"
              maxLength={16}
            />
          </div>

          <div className="create-profile-field">
            <label className="create-profile-label">Страна</label>
            <div
              className="create-profile-select"
              onClick={() => {
                setShowCountryDropdown(!showCountryDropdown)
                setShowGenderDropdown(false)
              }}
            >
              <span>{formData.country || 'Выберите страну'}</span>
              <span className="create-profile-select-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18L15 12L9 6" stroke="#B6B6B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
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

          <div className="create-profile-field">
            <label className="create-profile-label">Пол</label>
            <div
              className="create-profile-select"
              onClick={() => {
                setShowGenderDropdown(!showGenderDropdown)
                setShowCountryDropdown(false)
              }}
            >
              <span>{formData.gender}</span>
              <span className="create-profile-select-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18L15 12L9 6" stroke="#B6B6B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>

            {showGenderDropdown && (
              <div className="create-profile-dropdown">
                {genders.map((gender) => (
                  <div
                    key={gender}
                    className="create-profile-dropdown-item"
                    onClick={() => {
                      setFormData({ ...formData, gender })
                      setShowGenderDropdown(false)
                    }}
                  >
                    {gender}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
