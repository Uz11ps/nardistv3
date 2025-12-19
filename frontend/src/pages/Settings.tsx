import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'

export default function Settings() {
  const [settings, setSettings] = useState({
    soundEnabled: true,
    notificationsEnabled: true,
    theme: 'dark',
    language: 'ru',
  })

  const handleSettingChange = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value })
    // Здесь можно сохранить настройки на сервере
    console.log('Settings updated:', { ...settings, [key]: value })
  }

  return (
    <div className="app-container">
      <PageHeader title="Настройки" />
      
      <div style={{ padding: '20px' }}>
        <Card style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>Звук</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="card-subtitle">Включить звуки игры</div>
            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: settings.soundEnabled ? '#ff3333' : '#3a3a3a',
                  borderRadius: '26px',
                  transition: '0.3s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: settings.soundEnabled ? '26px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    transition: '0.3s',
                  }}
                />
              </span>
            </label>
          </div>
        </Card>

        <Card style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>Уведомления</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="card-subtitle">Включить уведомления</div>
            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: settings.notificationsEnabled ? '#ff3333' : '#3a3a3a',
                  borderRadius: '26px',
                  transition: '0.3s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: settings.notificationsEnabled ? '26px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    transition: '0.3s',
                  }}
                />
              </span>
            </label>
          </div>
        </Card>

        <Card style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>Язык</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              variant={settings.language === 'ru' ? 'primary' : 'secondary'}
              onClick={() => handleSettingChange('language', 'ru')}
            >
              Русский
            </Button>
            <Button
              variant={settings.language === 'en' ? 'primary' : 'secondary'}
              onClick={() => handleSettingChange('language', 'en')}
            >
              English
            </Button>
          </div>
        </Card>

        <Card>
          <div className="card-title" style={{ marginBottom: '16px' }}>О приложении</div>
          <div className="card-subtitle" style={{ marginBottom: '8px' }}>
            Версия: 1.0.0
          </div>
          <div className="card-subtitle">
            НАРДИСТ - современная игра в нарды с рейтингами, турнирами и социальными функциями
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  )
}

