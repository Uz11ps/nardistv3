import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Settings.css'

interface SettingsState {
  vibration: boolean
  sound: boolean
  matchNotifications: boolean
  economicEvents: boolean
  clanEvents: boolean
  language: string
  coordinateSystem: '1-24' | 'A-D/1-24'
}

export default function Settings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<SettingsState>({
    vibration: true,
    sound: true,
    matchNotifications: true,
    economicEvents: true,
    clanEvents: true,
    language: 'Русский',
    coordinateSystem: '1-24',
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
            <span className="settings-arrow">→</span>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item settings-item-clickable" onClick={handleLanguageClick}>
          <span className="settings-label">Язык</span>
          <div className="settings-item-value">
            <span className="settings-value-text">{settings.language}</span>
            <span className="settings-arrow">→</span>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item settings-item-clickable" onClick={handlePrivacyPolicy}>
          <span className="settings-label">Политика конфиденциальности</span>
          <span className="settings-arrow">→</span>
        </div>

        <div className="settings-divider" />

        <div className="settings-item settings-item-clickable" onClick={handleAgreementPolicy}>
          <span className="settings-label">Политика соглашения</span>
          <span className="settings-arrow">→</span>
        </div>
      </div>
    </PageLayout>
  )
}
