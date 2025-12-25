import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import SkillPointsModal from '../components/SkillPointsModal'
import { apiClient } from '../api/client'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [stats, setStats] = useState({ narCoin: 0, xp: 0, level: 1 })
  const [hasPremium, setHasPremium] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSkillPointsModal, setShowSkillPointsModal] = useState(false)
  const [skillPoints, setSkillPoints] = useState({
    total: 0,
    free: 0,
    economy: 0,
    energy: 0,
    lives: 0,
    power: 0,
  })
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    nickname: '',
    country: '',
    avatarUrl: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setStats({
        narCoin: Number(user.narCoin) || 0,
        xp: Number(user.xp) || 0,
        level: user.level || 1,
      })
      checkPremium()
      loadSkillPoints()
      
      // Проверяем, завершена ли настройка профиля (первичное создание)
      // Если нет - перенаправляем на создание профиля
      apiClient.get('/onboarding/status')
        .then((response) => {
          const profileSetupCompleted = response?.data?.profileSetupCompleted ?? true
          if (!profileSetupCompleted) {
            navigate('/onboarding/profile')
          }
        })
        .catch(() => {
          // Если не удалось проверить статус, продолжаем работу
        })
    }
  }, [user, navigate])

  const loadSkillPoints = async () => {
    try {
      const response = await apiClient.get('/progress/skill-points').catch(() => ({ data: skillPoints }))
      setSkillPoints(response.data || skillPoints)
    } catch (error) {
      console.error('Failed to load skill points:', error)
    }
  }

  const handleUpgrade = async (type: 'economy' | 'energy' | 'lives' | 'power') => {
    if (upgrading || skillPoints.free < 1) return
    
    // Проверяем максимальный уровень (10)
    const currentSp = (skillPoints[type] as number) || 0
    if (currentSp >= 10) {
      alert('Достигнут максимальный уровень прокачки')
      return
    }

    try {
      setUpgrading(type)
      await apiClient.post('/progress/skill-points/distribute', { type, amount: 1 })
      await loadSkillPoints()
      const userResponse = await apiClient.get('/users/me')
      updateUser(userResponse.data)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при прокачке')
    } finally {
      setUpgrading(null)
    }
  }

  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status').catch(() => ({ data: { hasActive: false } }))
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }

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
    if (user && showEditModal) {
      setEditFormData({
        nickname: user.nickname || user.username || '',
        country: user.country || 'Россия',
        avatarUrl: user.avatarUrl || '',
      })
    }
  }, [user, showEditModal])

  const handleOpenEdit = () => {
    // Проверка уровня только для РЕДАКТИРОВАНИЯ существующего профиля
    // При первой регистрации пользователь должен использовать CreateProfile
    if ((user?.level || 0) < 5) {
      alert('Редактирование профиля доступно с 5 уровня')
      return
    }
    setShowEditModal(true)
  }

  const handleCloseEdit = () => {
    setShowEditModal(false)
  }

  const handleSaveProfile = async () => {
    if (!editFormData.nickname.trim()) {
      alert('Введите никнейм')
      return
    }

    try {
      setLoading(true)
      // Отправляем только nickname и country
      // avatarUrl обновляется автоматически при загрузке файла через handleImageUpload
      const updateData: any = {
        nickname: editFormData.nickname,
        country: editFormData.country,
      }
      
      // Отправляем avatarUrl только если он был изменен через загрузку файла
      if (editFormData.avatarUrl && editFormData.avatarUrl !== user?.avatarUrl) {
        updateData.avatarUrl = editFormData.avatarUrl
      }
      
      const response = await apiClient.put('/users/me', updateData)
      
      // Обновляем пользователя в store
      if (response.data) {
        updateUser(response.data)
      }
      
      setShowEditModal(false)
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      alert(error.response?.data?.message || 'Ошибка обновления профиля')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTelegramPhoto = () => {
    if (user?.avatarUrl) {
      setEditFormData({ ...editFormData, avatarUrl: user.avatarUrl })
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB')
      return
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение')
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiClient.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data?.url) {
        setEditFormData({ ...editFormData, avatarUrl: response.data.url })
        alert('Изображение успешно загружено!')
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error)
      alert(error.response?.data?.message || 'Ошибка загрузки изображения')
    } finally {
      setLoading(false)
      // Сбрасываем input
      e.target.value = ''
    }
  }

  const menuItems = [
    { icon: '/img/c86058c8dc0c93af3b43acd129cee0eae6877c3e.png', title: 'Магазин', path: '/shop' },
    { icon: '/img/инв.png', title: 'Инвентарь', path: '/inventory' },
    { icon: '/img/зарик.png', title: 'Квесты', path: '/quests' },
    { icon: '/img/увед.png', title: 'Уведомления', path: '/notifications' },
    { icon: '/img/челувек.png', title: 'Рефералы', path: '/referrals' },
    { icon: '/img/settings.png', title: 'Настройки', path: '/settings' },
  ]

  return (
    <PageLayout 
      title="Профиль" 
      showBack={true}
      rightAction={
        <button className="profile-edit-button" onClick={handleOpenEdit}>
          ✏️
        </button>
      }
    >
      <div className="profile-content">
        {/* Профиль пользователя */}
        <div className="profile-header">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  <img src="/img/челувек.png" alt="User" className="profile-avatar-icon" />
                </div>
              )}
            </div>
          </div>
          <div className="profile-name">
            {user?.nickname || user?.firstName || user?.username || 'Игрок'}
          </div>
          <div className="profile-level">
            Уровень {stats.level}
          </div>
        </div>

        {/* Усиления */}
        <div className="profile-enhancements-card">
          <div className="profile-enhancements-title">Усиления</div>
          <div className="profile-enhancements-list">
            {[
              { id: 'economy' as const, name: 'Экономика', icon: '💰', description: 'Снижение комиссии, пассивный доход' },
              { id: 'energy' as const, name: 'Энергия', icon: '⚡', description: 'Лимит боев, восстановление' },
              { id: 'lives' as const, name: 'Жизни', icon: '❤️', description: 'Запас поражений, регенерация' },
              { id: 'power' as const, name: 'Сила', icon: '💪', description: 'Лимит веса скинов' },
            ].map((enh) => {
              const currentSp = (skillPoints[enh.id] as number) || 0
              const maxSp = 10
              const canUpgrade = skillPoints.free > 0 && currentSp < maxSp && !upgrading
              
              return (
                <div key={enh.id} className="profile-enhancement-item">
                  <div className="profile-enhancement-left">
                    <div className="profile-enhancement-icon">{enh.icon}</div>
                    <div className="profile-enhancement-info">
                      <div className="profile-enhancement-name">{enh.name}</div>
                      <div className="profile-enhancement-progress">
                        {currentSp}/{maxSp}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`profile-enhancement-upgrade-btn ${canUpgrade ? 'active' : 'disabled'}`}
                    onClick={() => handleUpgrade(enh.id)}
                    disabled={!canUpgrade}
                  >
                    {upgrading === enh.id ? '...' : 'Прокачать'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Валюта */}
        <div className="profile-currency-card">
          <div className="profile-currency-content">
            <div className="profile-currency-left">
              <img src="/img/narcoin.png" alt="NAR" className="profile-currency-icon" />
              <span className="profile-currency-amount">
                {stats.narCoin.toLocaleString('ru-RU')} NAR
              </span>
            </div>
            <button className="profile-topup-btn" onClick={() => navigate('/shop')}>
              Пополнить
            </button>
          </div>
        </div>

        {/* Меню */}
        <div className="profile-menu">
          {menuItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className="profile-menu-item"
            >
              <div className="profile-menu-item-content">
                <img src={item.icon} alt={item.title} className="profile-menu-item-icon" />
                <span className="profile-menu-item-title">{item.title}</span>
                <span className="profile-menu-item-arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Модальное окно редактирования профиля */}
      {showEditModal && (
        <div className="profile-edit-modal-overlay" onClick={handleCloseEdit}>
          <div className="profile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-edit-modal-header">
              <h2 className="profile-edit-modal-title">Редактировать профиль</h2>
              <button className="profile-edit-modal-close" onClick={handleCloseEdit}>×</button>
            </div>
            
            <div className="profile-edit-modal-content">
              {/* Аватарка */}
              <div className="profile-edit-avatar-section">
                <div className="profile-edit-avatar">
                  {editFormData.avatarUrl ? (
                    <img src={editFormData.avatarUrl} alt="Avatar" className="profile-edit-avatar-img" />
                  ) : (
                    <div className="profile-edit-avatar-placeholder">
                      <img src="/img/челувек.png" alt="User" className="profile-edit-avatar-icon" />
                    </div>
                  )}
                </div>
                <div className="profile-edit-avatar-buttons">
                  <label className="profile-edit-upload-btn">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      disabled={loading}
                    />
                    📷 Загрузить изображение
                  </label>
                  <button className="profile-edit-use-telegram-btn" onClick={handleUseTelegramPhoto}>
                    Использовать фото из Telegram
                  </button>
                </div>
              </div>

              {/* Никнейм */}
              <div className="profile-edit-field">
                <label className="profile-edit-label">Никнейм</label>
                <input
                  type="text"
                  className="profile-edit-input"
                  value={editFormData.nickname}
                  onChange={(e) => setEditFormData({ ...editFormData, nickname: e.target.value })}
                  placeholder="Введите никнейм"
                />
              </div>

              {/* Страна */}
              <div className="profile-edit-field">
                <label className="profile-edit-label">Страна</label>
                <div className="profile-edit-country-wrapper">
                  <button
                    className="profile-edit-country-button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  >
                    {editFormData.country || 'Выберите страну'}
                    <span className="profile-edit-country-arrow">▼</span>
                  </button>
                  {showCountryDropdown && (
                    <div className="profile-edit-country-dropdown">
                      {countries.map((country) => (
                        <button
                          key={country}
                          className="profile-edit-country-option"
                          onClick={() => {
                            setEditFormData({ ...editFormData, country })
                            setShowCountryDropdown(false)
                          }}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="profile-edit-modal-footer">
              <button className="profile-edit-cancel-btn" onClick={handleCloseEdit}>
                Отмена
              </button>
              <button 
                className="profile-edit-save-btn" 
                onClick={handleSaveProfile}
                disabled={loading}
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно Skill Points */}
      <SkillPointsModal
        isOpen={showSkillPointsModal}
        onClose={() => setShowSkillPointsModal(false)}
        skillPoints={skillPoints}
        onUpdate={() => {
          loadSkillPoints()
          const userResponse = apiClient.get('/users/me')
          userResponse.then((res) => updateUser(res.data))
        }}
      />

    </PageLayout>
  )
}
