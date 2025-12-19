import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'

interface GameMode {
  id: string
  name: string
  description: string
  icon: string
  path: string
  available: boolean
}

export default function GameModes() {
  const navigate = useNavigate()

  const gameModes: GameMode[] = [
    {
      id: 'online',
      name: 'Онлайн игра',
      description: 'Сразись с игроками по всему миру',
      icon: '🌐',
      path: '/game/search',
      available: true,
    },
    {
      id: 'tables',
      name: 'Свободные столы',
      description: 'Выбирай стол и присоединяйся к игре',
      icon: '🪑',
      path: '/game/tables',
      available: true,
    },
    {
      id: 'bot',
      name: 'Игра с AI',
      description: 'Тренируйся без ограничений',
      icon: '🤖',
      path: '/game/new?mode=bot',
      available: true,
    },
    {
      id: 'tournament',
      name: 'Турниры',
      description: 'Участвуй в соревнованиях',
      icon: '🏆',
      path: '/tournaments',
      available: true,
    },
    {
      id: 'training',
      name: 'Тренажер',
      description: 'Отработай позиции',
      icon: '🎯',
      path: '/training',
      available: false, // TODO: создать страницу тренажера
    },
  ]

  return (
    <div className="app-container">
      <PageHeader title="Режимы игры" />
      
      <div style={{ padding: '20px' }}>
        <div className="card-title" style={{ marginBottom: '16px', fontSize: '18px' }}>
          Выберите режим игры
        </div>

        {gameModes.map((mode) => (
          <Card
            key={mode.id}
            style={{
              marginBottom: '12px',
              opacity: mode.available ? 1 : 0.6,
              cursor: mode.available ? 'pointer' : 'not-allowed',
            }}
            onClick={() => {
              if (mode.available) {
                navigate(mode.path)
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: mode.available ? '#3a3a3a' : '#2a2a2a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                }}
              >
                {mode.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div className="card-title">{mode.name}</div>
                <div className="card-subtitle" style={{ marginTop: '4px' }}>
                  {mode.description}
                </div>
                {!mode.available && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: '#3a3a3a',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#aaaaaa',
                      display: 'inline-block',
                    }}
                  >
                    Скоро
                  </div>
                )}
              </div>
              {mode.available && (
                <div style={{ fontSize: '24px', color: '#666666' }}>→</div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}

