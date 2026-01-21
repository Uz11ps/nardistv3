import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
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
      path: '/game/bot/mode',
    },
    {
      id: 'sandbox',
      name: 'Песочница',
      description: 'Расставь шашки как хочешь и тренируйся',
      path: '/game/sandbox',
    },
  ]

  const mainModes = gameModes.filter((mode) => mode.id === 'online' || mode.id === 'tables')
  const trainingModes = gameModes.filter((mode) => mode.id === 'bot' || mode.id === 'sandbox')

  return (
    <PageLayout
      title="Выбор режима"
      subtitle="Тренируйся, играй онлайн или выбери свободный стол"
      showBack={true}
    >
      <div className="game-modes-list">
        {/* Основные режимы */}
        {mainModes.map((mode) => (
          <div
            key={mode.id}
            className="game-mode-card"
            onClick={() => navigate(mode.path)}
          >
            <img src="/img/кланы.png" alt="Mode" className="game-mode-icon" />
            <div className="game-mode-info">
              <div className="game-mode-title">{mode.name}</div>
              <div className="game-mode-description">{mode.description}</div>
            </div>
          </div>
        ))}

        {/* Раздел Тренировка */}
        {trainingModes.length > 0 && (
          <>
            <div className="game-modes-section-title">Тренировка</div>
            {trainingModes.map((mode) => (
              <div
                key={mode.id}
                className="game-mode-card"
                onClick={() => navigate(mode.path)}
              >
                <img src="/img/кланы.png" alt="Mode" className="game-mode-icon" />
                <div className="game-mode-info">
                  <div className="game-mode-title">{mode.name}</div>
                  <div className="game-mode-description">{mode.description}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="game-modes-footer">
        Игры дают опыт, NAR-coin и рейтинг
      </div>
    </PageLayout>
  )
}
