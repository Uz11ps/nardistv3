import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { getSocket } from '../api/websocket'
import './CreateTable.css'

export default function CreateTable() {
  const navigate = useNavigate()
  const [stake, setStake] = useState<100 | 500 | 1000 | 5000>(100)
  const [mode, setMode] = useState<'long' | 'short'>('short')
  const [access, setAccess] = useState<'open' | 'private'>('open')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateTable = async () => {
    if (access === 'private' && !password.trim()) {
      alert('Введите пароль для приватного стола')
      return
    }

    try {
      setLoading(true)
      const socket = getSocket()
      if (socket) {
        socket.emit('create_table', {
          mode,
          timeLimit: 60,
          stake,
          isPrivate: access === 'private',
          password: access === 'private' ? password : undefined,
        })

        socket.once('table_created', (data: any) => {
          navigate(`/game/${data.gameId}`)
        })

        socket.once('error', (error: any) => {
          alert(error.message || 'Ошибка при создании стола')
          setLoading(false)
        })
      } else {
        // Fallback на REST API если нужно
        const response = await apiClient.post('/games/tables', {
          mode,
          stake,
          isPrivate: access === 'private',
          password: access === 'private' ? password : undefined,
        })
        navigate(`/game/${response.data.id}`)
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при создании стола')
      setLoading(false)
    }
  }

  return (
    <div className="app-container page-transition">
      <PageHeader title="Создать стол" />
      
      <div className="create-table-content">
        <div className="create-table-subtitle">Подбор по рейтингу и режиму</div>

        <Card className="create-table-card">
          {/* Ставка */}
          <div className="create-table-field">
            <div className="create-table-label">Ставка:</div>
            <div className="stake-buttons">
              {[100, 500, 1000, 5000].map((value) => (
                <button
                  key={value}
                  className={`stake-btn ${stake === value ? 'active' : ''}`}
                  onClick={() => setStake(value as typeof stake)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Тип нард */}
          <div className="create-table-field">
            <div className="create-table-label">Тип нард:</div>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${mode === 'short' ? 'active' : ''}`}
                onClick={() => setMode('short')}
              >
                Короткие
              </button>
              <button
                className={`toggle-btn ${mode === 'long' ? 'active' : ''}`}
                onClick={() => setMode('long')}
              >
                Длинные
              </button>
            </div>
          </div>

          {/* Доступ */}
          <div className="create-table-field">
            <div className="create-table-label">Доступ:</div>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="access"
                  value="open"
                  checked={access === 'open'}
                  onChange={(e) => setAccess(e.target.value as 'open' | 'private')}
                />
                <span>Открытый</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="access"
                  value="private"
                  checked={access === 'private'}
                  onChange={(e) => setAccess(e.target.value as 'open' | 'private')}
                />
                <span>Приватный</span>
              </label>
            </div>
            
            {access === 'private' && (
              <input
                type="password"
                className="create-table-password"
                placeholder="Введите пароль стола"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleCreateTable}
            disabled={loading}
            className="create-table-submit-btn"
          >
            {loading ? 'Создание...' : 'Создать стол'}
          </Button>
        </Card>
      </div>
    </div>
  )
}

