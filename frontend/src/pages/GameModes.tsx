import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Icon from '../components/Icon'
import './GameModes.css'

interface GameMode {
  id: string
  name: string
  description: string
  path: string
}

export default function GameModes() {
  const navigate = useNavigate()

  const gameModes: GameMode[] = [
    {
      id: 'online',
      name: 'Онлайн игра',
      description: 'Сразись с игроками по всему миру',
      path: '/game/search',
    },
    {
      id: 'tables',
      name: 'Свободные столы',
      description: 'Выбирай стол и присоединяйся к игре',
      path: '/game/tables',
    },
    {
      id: 'bot',
      name: 'Игра с AI',
      description: 'Тренируйся без ограничений',
      path: '/game/new?mode=bot',
    },
  ]

  return (
    <div className="app-container">
      <PageHeader title="Выбор режима" />
      
      <div className="game-modes-content">
        <div className="game-modes-subtitle">
          Тренируйся, играй онлайн или выбери свободный стол
        </div>

        <div className="game-modes-list">
          {gameModes.map((mode) => (
            <Card
              key={mode.id}
              onClick={() => navigate(mode.path)}
              className="game-mode-card"
            >
              <div className="game-mode-content">
                <div className="game-mode-icon">
                  <Icon name="shield" size={32} style={{ color: '#ffd700' }} />
                </div>
                <div className="game-mode-info">
                  <div className="game-mode-title">{mode.name}</div>
                  <div className="game-mode-description">{mode.description}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="game-modes-footer">
          Игры дают опыт, NAR-coin и рейтинг
        </div>
      </div>

    </div>
  )
}