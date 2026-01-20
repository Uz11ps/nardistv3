import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { TIMEZONES, getTimezoneLabel } from '../utils/timezones'
import { ArrowRightIcon } from '../components/Icons'
import './Settings.css'

interface SettingsState {
  vibration: boolean
  sound: boolean
  matchNotifications: boolean
  economicEvents: boolean
  clanEvents: boolean
  language: string
  coordinateSystem: '1-24' | 'A-D/1-24'
  timezone: string
}

export default function Settings() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [showTimezoneModal, setShowTimezoneModal] = useState(false)
  const [settings, setSettings] = useState<SettingsState>({
    vibration: true,
    sound: true,
    matchNotifications: true,
    economicEvents: true,
    clanEvents: true,
    language: 'Русский',
    coordinateSystem: '1-24',
    timezone: 'Europe/Moscow',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await apiClient.get('/users/settings')
      if (response.data) {
        setSettings({
          vibration: response.data.vibration ?? true,
          sound: response.data.sound ?? true,
          matchNotifications: response.data.matchNotifications ?? true,
          economicEvents: response.data.economicEvents ?? true,
          clanEvents: response.data.clanEvents ?? true,
          language: response.data.language ?? 'Русский',
          coordinateSystem: response.data.coordinateSystem ?? '1-24',
          timezone: response.data.timezone ?? 'Europe/Moscow',
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const updateSetting = async (key: keyof SettingsState, value: boolean | string) => {
    try {
      const newSettings = { ...settings, [key]: value }
      setSettings(newSettings)
      await apiClient.put('/users/settings', newSettings)
    } catch (error) {
      console.error('Failed to update setting:', error)
      setSettings(settings)
    }
  }

  const handleToggle = (key: keyof SettingsState) => {
    const currentValue = settings[key]
    if (typeof currentValue === 'boolean') {
      updateSetting(key, !currentValue)
    }
  }

  const handleLanguageClick = () => {
    alert('Выбор языка будет доступен в следующей версии')
  }

  const handlePrivacyPolicy = () => {
    navigate('/policy/privacy')
  }

  const handleAgreementPolicy = () => {
    navigate('/policy/agreement')
  }

  return (
    <PageLayout title="Настройки" showBack={true}>
      <div className="settings-card">
        {/* Toggle настройки */}
        <div className="settings-item" onClick={() => handleToggle('vibration')}>
          <span className="settings-label">Вибрация</span>
          <div className={`settings-toggle ${settings.vibration ? 'active' : ''}`}>
            {settings.vibration && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item" onClick={() => handleToggle('sound')}>
          <span className="settings-label">Звук</span>
          <div className={`settings-toggle ${settings.sound ? 'active' : ''}`}>
            {settings.sound && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item" onClick={() => handleToggle('matchNotifications')}>
          <span className="settings-label">Уведомления о матчах</span>
          <div className={`settings-toggle ${settings.matchNotifications ? 'active' : ''}`}>
            {settings.matchNotifications && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item" onClick={() => handleToggle('economicEvents')}>
          <span className="settings-label">Экономические события</span>
          <div className={`settings-toggle ${settings.economicEvents ? 'active' : ''}`}>
            {settings.economicEvents && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item" onClick={() => handleToggle('clanEvents')}>
          <span className="settings-label">События федерации</span>
          <div className={`settings-toggle ${settings.clanEvents ? 'active' : ''}`}>
            {settings.clanEvents && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div 
          className="settings-item settings-item-clickable" 
          onClick={() => {
            const nextVal = settings.coordinateSystem === '1-24' ? 'A-D/1-24' : '1-24';
            updateSetting('coordinateSystem', nextVal);
          }}
        >
          <span className="settings-label">Система координат</span>
          <div className="settings-item-value">
            <span className="settings-value-text">{settings.coordinateSystem === '1-24' ? '1-24' : 'A, B, C, D/1-24'}</span>
            <ArrowRightIcon size={16} style={{ color: '#707579' }} />
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item settings-item-clickable" onClick={handleLanguageClick}>
          <span className="settings-label">Язык</span>
          <div className="settings-item-value">
            <span className="settings-value-text">{settings.language}</span>
            <ArrowRightIcon size={16} style={{ color: '#707579' }} />
          </div>
        </div>

        <div className="settings-divider" />

        <div 
          className="settings-item settings-item-clickable" 
          onClick={() => setShowTimezoneModal(true)}
        >
          <span className="settings-label">Часовой пояс</span>
          <div className="settings-item-value">
            <span className="settings-value-text">{getTimezoneLabel(settings.timezone)}</span>
            <ArrowRightIcon size={16} style={{ color: '#707579' }} />
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item settings-item-clickable" onClick={handlePrivacyPolicy}>
          <span className="settings-label">Политика конфиденциальности</span>
          <ArrowRightIcon size={16} style={{ color: '#707579' }} />
        </div>

        <div className="settings-divider" />

        <div className="settings-item settings-item-clickable" onClick={handleAgreementPolicy}>
          <span className="settings-label">Политика соглашения</span>
          <ArrowRightIcon size={16} style={{ color: '#707579' }} />
        </div>
      </div>

      {/* Модальное окно выбора часового пояса */}
      {showTimezoneModal && (
        <div className="settings-modal-overlay" onClick={() => setShowTimezoneModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Выберите часовой пояс</h3>
              <button 
                className="settings-modal-close"
                onClick={() => setShowTimezoneModal(false)}
              >
                ×
              </button>
            </div>
            <div className="settings-modal-content">
              {TIMEZONES.map((tz) => (
                <div
                  key={tz.value}
                  className={`settings-timezone-item ${settings.timezone === tz.value ? 'active' : ''}`}
                  onClick={() => {
                    updateSetting('timezone', tz.value)
                    setShowTimezoneModal(false)
                  }}
                >
                  {tz.label}
                  {settings.timezone === tz.value && <span className="settings-timezone-check">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
