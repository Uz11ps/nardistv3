import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { getMatchmakingSocket } from '../api/websocket'
import './CreateTable.css'

export default function CreateTable() {
  const navigate = useNavigate()
  const [stake, setStake] = useState<number>(50)
  const [mode, setMode] = useState<'long' | 'short'>('short')
  const stakeOptions = [50, 100, 250, 500, 750, 1000, 1500, 3000, 5000]
  const [access, setAccess] = useState<'open' | 'private'>('open')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const socket = getMatchmakingSocket()
    if (!socket) return

    const handleTableCreated = (data: any) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setLoading(false)
      navigate(`/game/${data.gameId}`)
    }

    const handleError = (error: any) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      alert(error.message || 'Ошибка при создании стола')
      setLoading(false)
    }

    socket.on('table_created', handleTableCreated)
    socket.on('error', handleError)

    return () => {
      socket.off('table_created', handleTableCreated)
      socket.off('error', handleError)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [navigate])

  const handleCreateTable = async () => {
    if (access === 'private' && !password.trim()) {
      alert('Введите пароль для приватного стола')
      return
    }

    try {
      setLoading(true)
      const socket = getMatchmakingSocket()
      if (!socket) {
        alert('WebSocket не подключен. Перезагрузите страницу.')
        setLoading(false)
        return
      }

      // Таймаут на случай если событие не придет
      timeoutRef.current = setTimeout(() => {
        alert('Таймаут при создании стола. Попробуйте еще раз.')
        setLoading(false)
        timeoutRef.current = null
      }, 10000) // 10 секунд

      socket.emit('create_table', {
        mode,
        stake: stake,
      })
    } catch (error: any) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      alert(error.response?.data?.message || 'Ошибка при создании стола')
      setLoading(false)
    }
  }

  return (
    <PageLayout title="Создать стол" subtitle="Подбор по рейтингу и режиму" showBack={true}>
      <div className="create-table-content">
        <div className="create-table-card-v2">
          {/* Ставка */}
          <div className="create-table-field-v2">
            <div className="create-table-label-v2">Ставка:</div>
            <div className="create-table-stake-grid">
              {stakeOptions.map((value) => (
                <button
                  key={value}
                  className={`create-table-stake-btn ${stake === value ? 'selected' : ''}`}
                  onClick={() => setStake(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Режим */}
          <div className="create-table-field-v2">
            <div className="create-table-label-v2">Режим:</div>
            <div className="create-table-mode-toggle">
              <button
                className={`create-table-mode-btn ${mode === 'short' ? 'active' : ''}`}
                onClick={() => setMode('short')}
              >
                Короткие
              </button>
              <button
                className={`create-table-mode-btn ${mode === 'long' ? 'active' : ''}`}
                onClick={() => setMode('long')}
              >
                Длинные
              </button>
            </div>
          </div>

          {/* Доступ */}
          <div className="create-table-field-v2">
            <div className="create-table-label-v2">Доступ:</div>
            <div className="create-table-access-row">
              <label className="create-table-radio">
                <input
                  type="radio"
                  name="access"
                  value="open"
                  checked={access === 'open'}
                  onChange={(e) => setAccess(e.target.value as 'open' | 'private')}
                />
                <span>Открытый</span>
              </label>
              <label className="create-table-radio">
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
                className="create-table-password-input"
                placeholder="Введите пароль стола"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </div>

          <div className="create-table-info-v2">
            Время на игру: 30 мин<br/>
            Куб удвоения: да<br/>
            Матч до: 10 побед
          </div>

          <button
            onClick={handleCreateTable}
            disabled={loading}
            className="create-table-submit-btn-v2"
          >
            {loading ? 'Создание...' : 'Создать стол'}
          </button>
        </div>
      </div>
    </PageLayout>
  )
}

