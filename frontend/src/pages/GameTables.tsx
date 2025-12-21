import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'
import { getMatchmakingSocket } from '../api/websocket'
import './GameTables.css'

interface GameTable {
  id: string
  tableNumber: number
  stake: number
  mode: 'long' | 'short'
  playerCount: number
  maxPlayers: number
  status: 'waiting' | 'in_progress' | 'finished'
}

export default function GameTables() {
  const navigate = useNavigate()
  const [tables, setTables] = useState<GameTable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTables()
    const socket = getMatchmakingSocket()
    if (socket) {
      console.log('📡 WebSocket найден, состояние подключения:', socket.connected)
      
      // Запрашиваем столы всех режимов при подключении
      if (socket.connected) {
        console.log('📋 Запрашиваем список столов...')
        socket.emit('get_open_tables', {})
      }
      
      // Слушаем обновления списка столов
      const handleOpenTables = (data: any) => {
        console.log('📋 Получен обновленный список столов:', data?.length || 0, 'столов')
        setTables(data || [])
        setLoading(false)
      }
      
      socket.on('open_tables', handleOpenTables)
      
      // Также запрашиваем список при каждом подключении
      const handleConnect = () => {
        console.log('🔄 WebSocket подключен, запрашиваем список столов')
        socket.emit('get_open_tables', {})
      }
      
      socket.on('connect', handleConnect)
      
      // Обработка ошибок подключения
      socket.on('connect_error', (error) => {
        console.error('❌ Ошибка подключения WebSocket:', error)
      })

    } else {
      console.warn('⚠️ WebSocket не найден!')
    }

    return () => {
      if (socket) {
        socket.off('open_tables')
        socket.off('connect')
        socket.off('connect_error')
      }
    }
  }, [])

  const loadTables = async () => {
    try {
      // TODO: Заменить на REST API endpoint когда будет готов
      const response = await apiClient.get('/games/tables').catch(() => ({ data: [] }))
      setTables(response.data || [])
    } catch (error) {
      console.error('Failed to load tables:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinTable = async (tableId: string) => {
    try {
      const socket = getMatchmakingSocket()
      if (!socket) {
        console.error('❌ WebSocket не подключен!')
        alert('WebSocket не подключен. Перезагрузите страницу.')
        return
      }

      if (!socket.connected) {
        console.error('❌ WebSocket не подключен (connected=false)!')
        alert('WebSocket не подключен. Перезагрузите страницу.')
        return
      }

      console.log('🪑 Попытка присоединиться к столу:', tableId)
      socket.emit('join_table', { gameId: tableId })
      
      socket.once('table_joined', (data: any) => {
        console.log('✅ Успешно присоединились к столу:', data)
        navigate(`/game/${tableId}`)
      })

      socket.once('error', (error: any) => {
        console.error('❌ Ошибка при присоединении к столу:', error)
        alert(error.message || 'Не удалось присоединиться к столу')
      })
    } catch (error) {
      console.error('❌ Ошибка при присоединении к столу:', error)
      alert('Не удалось присоединиться к столу')
    }
  }

  const handleObserveTable = (tableId: string) => {
    navigate(`/game/${tableId}?observe=true`)
  }

  const getGameModeName = (mode: string) => {
    return mode === 'long' ? 'Длинные нарды' : 'Короткие нарды'
  }

  const getTableNumber = (id: string) => {
    // Извлекаем номер из ID (последние цифры)
    const match = id.match(/\d+/g)
    return match ? parseInt(match[match.length - 1]) : 0
  }

  return (
    <div className="app-container page-transition">
      <PageHeader title="Список столов" />
      
      <div className="game-tables-content">
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaaaaa' }}>
              Загрузка...
            </div>
          </Card>
        ) : tables.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaaaaa' }}>
              Нет доступных столов
            </div>
          </Card>
        ) : (
          tables.map((table) => {
            const tableNumber = getTableNumber(table.id)
            const isFull = table.playerCount >= table.maxPlayers
            
            return (
              <Card key={table.id} className="game-table-card">
                <div className="game-table-header">
                  <div className="game-table-title">Стол №{tableNumber}</div>
                  <div className="game-table-stake">
                    <Icon name="coin" size={16} style={{ color: 'var(--color-gold)' }} />
                    <span>{table.stake.toLocaleString()} NAR</span>
                  </div>
                </div>
                
                <div className="game-table-info">
                  <div className="game-table-mode">{getGameModeName(table.mode)}</div>
                  <div className="game-table-players">
                    {table.playerCount}/{table.maxPlayers}
                  </div>
                </div>

                <div className="game-table-actions">
                  {isFull ? (
                    <button
                      className="game-table-btn game-table-btn-observe"
                      onClick={() => handleObserveTable(table.id)}
                    >
                      Наблюдать
                    </button>
                  ) : (
                    <button
                      className="game-table-btn game-table-btn-join"
                      onClick={() => handleJoinTable(table.id)}
                    >
                      Войти
                    </button>
                  )}
                </div>
              </Card>
            )
          })
        )}

        <div className="game-tables-footer">
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/game/tables/create')}
            className="game-tables-create-btn"
          >
            Создать стол
          </Button>
          <div className="game-tables-footer-text">
            Игры дают опыт, NAR-coin и рейтинг
          </div>
        </div>
      </div>
    </div>
  )
}

