import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { ArrowRightIcon } from '../components/Icons'
import './Settings.css'

interface SettingsState {
  matchNotifications: boolean
  economicEvents: boolean
  clanEvents: boolean
}

export default function Settings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<SettingsState>({
    matchNotifications: true,
    economicEvents: true,
    clanEvents: true,
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await apiClient.get('/users/settings')
      if (response.data) {
        setSettings({
          matchNotifications: response.data.matchNotifications ?? true,
          economicEvents: response.data.economicEvents ?? true,
          clanEvents: response.data.clanEvents ?? true,
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
        <div className="settings-item" onClick={() => handleToggle('matchNotifications')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <span className="settings-label">Уведомления о матчах</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>
              Если включено, бот отправляет уведомления в Telegram чат
            </span>
          </div>
          <div className={`settings-toggle ${settings.matchNotifications ? 'active' : ''}`}>
            {settings.matchNotifications && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item" onClick={() => handleToggle('economicEvents')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <span className="settings-label">Экономические события</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>
              Если включено, бот отправляет уведомления в Telegram чат
            </span>
          </div>
          <div className={`settings-toggle ${settings.economicEvents ? 'active' : ''}`}>
            {settings.economicEvents && <div className="settings-toggle-dot" />}
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-item" onClick={() => handleToggle('clanEvents')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <span className="settings-label">События федерации</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>
              Если включено, бот отправляет уведомления в Telegram чат
            </span>
          </div>
          <div className={`settings-toggle ${settings.clanEvents ? 'active' : ''}`}>
            {settings.clanEvents && <div className="settings-toggle-dot" />}
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

    </PageLayout>
  )
}
