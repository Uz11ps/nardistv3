import { useState } from 'react'
import { apiClient } from '../api/client'
import './SandboxControls.css'

interface SandboxControlsProps {
  gameId: string
  gameState: any
  currentPlayer: number
  onBoardUpdate: () => void
}

export default function SandboxControls({ gameId, gameState, currentPlayer, onBoardUpdate }: SandboxControlsProps) {
  const [showSetup, setShowSetup] = useState(false)
  const [dice1, setDice1] = useState(1)
  const [dice2, setDice2] = useState(1)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [pointValue, setPointValue] = useState(0)

  const handleSetupBoard = async () => {
    try {
      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
        points: gameState.points || Array(24).fill(0),
        bar: gameState.bar || { white: 0, black: 0 },
        bearOff: gameState.bearOff || { white: 0, black: 0 },
      })
      onBoardUpdate()
      alert('Доска обновлена')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка обновления доски')
    }
  }

  const handleSetDice = async () => {
    try {
      await apiClient.post(`/games/${gameId}/sandbox/set-dice`, {
        dice: [dice1, dice2],
        player: currentPlayer,
      })
      onBoardUpdate()
      alert('Кубики установлены')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка установки кубиков')
    }
  }

  const handlePointClick = (index: number) => {
    setSelectedPoint(index)
    setPointValue(gameState.points?.[index] || 0)
  }

  const handleUpdatePoint = async () => {
    if (selectedPoint === null) return
    
    const newPoints = [...(gameState.points || Array(24).fill(0))]
    newPoints[selectedPoint] = pointValue
    
    try {
      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
        points: newPoints,
        bar: gameState.bar || { white: 0, black: 0 },
        bearOff: gameState.bearOff || { white: 0, black: 0 },
      })
      onBoardUpdate()
      setSelectedPoint(null)
      alert('Точка обновлена')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка обновления точки')
    }
  }

  return (
    <div className="sandbox-controls">
      <button className="sandbox-toggle-btn" onClick={() => setShowSetup(!showSetup)}>
        {showSetup ? '✕' : '⚙️'} Настройки
      </button>
      
      {showSetup && (
        <div className="sandbox-panel">
          <div className="sandbox-section">
            <h3>Кубики</h3>
            <div className="dice-inputs">
              <input
                type="number"
                min="1"
                max="6"
                value={dice1}
                onChange={(e) => setDice1(parseInt(e.target.value) || 1)}
              />
              <input
                type="number"
                min="1"
                max="6"
                value={dice2}
                onChange={(e) => setDice2(parseInt(e.target.value) || 1)}
              />
            </div>
            <button onClick={handleSetDice}>Установить кубики</button>
          </div>

          <div className="sandbox-section">
            <h3>Текущий игрок</h3>
            <div className="player-selector">
              <button
                className={currentPlayer === 0 ? 'active' : ''}
                onClick={async () => {
                  try {
                    // Переключаем игрока без установки кубиков
                    await apiClient.post(`/games/${gameId}/sandbox/set-dice`, {
                      dice: [],
                      player: 0,
                    })
                    onBoardUpdate()
                  } catch (error: any) {
                    alert(error.response?.data?.message || 'Ошибка')
                  }
                }}
              >
                Белые
              </button>
              <button
                className={currentPlayer === 1 ? 'active' : ''}
                onClick={async () => {
                  try {
                    // Переключаем игрока без установки кубиков
                    await apiClient.post(`/games/${gameId}/sandbox/set-dice`, {
                      dice: [],
                      player: 1,
                    })
                    onBoardUpdate()
                  } catch (error: any) {
                    alert(error.response?.data?.message || 'Ошибка')
                  }
                }}
              >
                Черные
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              Выберите игрока для расстановки фишек. Положительные значения = белые, отрицательные = черные.
            </p>
          </div>

          <div className="sandbox-section">
            <h3>Настройка точки</h3>
            <p>Кликните на точку доски для редактирования</p>
            {selectedPoint !== null && (
              <div className="point-editor">
                <div>Точка {selectedPoint + 1}:</div>
                <input
                  type="number"
                  value={pointValue}
                  onChange={(e) => setPointValue(parseInt(e.target.value) || 0)}
                  placeholder="Значение (-15 до 15)"
                />
                <button onClick={handleUpdatePoint}>Обновить</button>
              </div>
            )}
          </div>

          <div className="sandbox-section">
            <h3>Бар и вынос</h3>
            <div className="bar-bearoff-editor">
              <div>
                <label>Белые на баре:</label>
                <input
                  type="number"
                  min="0"
                  value={gameState.bar?.white || 0}
                  onChange={async (e) => {
                    try {
                      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
                        points: gameState.points || Array(24).fill(0),
                        bar: { white: parseInt(e.target.value) || 0, black: gameState.bar?.black || 0 },
                        bearOff: gameState.bearOff || { white: 0, black: 0 },
                      })
                      onBoardUpdate()
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Ошибка')
                    }
                  }}
                />
              </div>
              <div>
                <label>Черные на баре:</label>
                <input
                  type="number"
                  min="0"
                  value={gameState.bar?.black || 0}
                  onChange={async (e) => {
                    try {
                      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, {
                        points: gameState.points || Array(24).fill(0),
                        bar: { white: gameState.bar?.white || 0, black: parseInt(e.target.value) || 0 },
                        bearOff: gameState.bearOff || { white: 0, black: 0 },
                      })
                      onBoardUpdate()
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Ошибка')
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

