import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './BotGameMode.css'

export default function BotGameMode() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'short' | 'long'>('long')
  const [loading, setLoading] = useState(false)

  const handleCreateBotGame = async () => {
    setLoading(true)
    try {
      const response = await apiClient.post('/games/create-bot', { mode })
      navigate(`/game/${response.data.id}`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка'
      alert(`Не удалось создать игру с ботом: ${errorMessage}`)
      setLoading(false)
    }
  }

  return (
    <PageLayout
      title="Игра с AI"
      subtitle="Выберите режим игры"
      showBack={true}
    >
      <div className="bot-game-mode-content">
        <div className="bot-game-mode-card">
          {/* Выбор типа нард */}
          <div className="bot-game-mode-field">
            <div className="bot-game-mode-label">Тип нард:</div>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${mode === 'long' ? 'active' : ''}`}
                onClick={() => setMode('long')}
                disabled={loading}
              >
                Длинные
              </button>
              <button
                className={`toggle-btn ${mode === 'short' ? 'active' : ''}`}
                onClick={() => setMode('short')}
                disabled={loading}
              >
                Короткие
              </button>
            </div>
          </div>

          {/* Описание режимов */}
          <div className="bot-game-mode-description">
            {mode === 'long' ? (
              <div>
                <p><strong>Длинные нарды</strong></p>
                <p>Классический вариант игры. Все шашки начинают в одном месте и движутся в одном направлении.</p>
              </div>
            ) : (
              <div>
                <p><strong>Короткие нарды</strong></p>
                <p>Более динамичный вариант. Шашки движутся навстречу друг другу, можно сбивать шашки соперника.</p>
              </div>
            )}
          </div>

          {/* Кнопка создания игры */}
          <button
            className="bot-game-mode-button"
            onClick={handleCreateBotGame}
            disabled={loading}
          >
            {loading ? 'Создание игры...' : 'Начать игру'}
          </button>
        </div>
      </div>
    </PageLayout>
  )
}

