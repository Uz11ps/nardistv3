import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import { getMatchmakingSocket } from '../api/websocket'
import './CreateTable.css'

export default function CreateTable() {
  const navigate = useNavigate()
  const [stake, setStake] = useState<100 | 500 | 1000 | 5000>(100)
  const [mode, setMode] = useState<'long' | 'short'>('short')
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
        <div className="create-table-card">
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
            {stake > 0 && (
              <div className="stake-prize-info">
                Приз за победу: {stake * 2 - 15} NAR
                <span className="stake-commission"> (комиссия 15 NAR)</span>
              </div>
            )}
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

          <button
            onClick={handleCreateTable}
            disabled={loading}
            className="create-table-submit-btn"
          >
            {loading ? 'Создание...' : 'Создать стол'}
          </button>
        </div>
      </div>
    </PageLayout>
  )
}

