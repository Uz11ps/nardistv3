import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { apiClient } from '../api/client'
import './ClanTreasury.css'

interface Transaction {
  id: string
  type: string
  amount: number | string
  description: string
  createdAt: string
  user?: {
    id: string
    username: string
    nickname?: string
  }
}

interface Clan {
  id: string
  treasury: number | string
  weeklyIncome: number | string
}

export default function ClanTreasury() {
  const { clanId } = useParams<{ clanId: string }>()
  const [clan, setClan] = useState<Clan | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clanId) {
      loadData()
    }
  }, [clanId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [clanResponse, transactionsResponse] = await Promise.all([
        apiClient.get(`/clans/${clanId}`),
        apiClient.get(`/clans/${clanId}/treasury/transactions?limit=5`),
      ])
      setClan(clanResponse.data)
      setTransactions(transactionsResponse.data || [])
    } catch (error) {
      console.error('Failed to load treasury data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseInt(amount) : amount
    return Math.abs(num).toLocaleString()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes} мин. назад`
    if (hours < 24) return `${hours} ч. назад`
    if (days < 7) return `${days} дн. назад`
    return date.toLocaleDateString('ru-RU')
  }

  if (loading) {
    return (
      <div className="app-container">
        <PageHeader title="Казна клана" />
        <div className="clan-treasury-loading">Загрузка...</div>      </div>
    )
  }

  if (!clan) {
    return null
  }

  const treasury = typeof clan.treasury === 'string' ? parseInt(clan.treasury) : clan.treasury
  const weeklyIncome = typeof clan.weeklyIncome === 'string' ? parseInt(clan.weeklyIncome) : clan.weeklyIncome

  return (
    <div className="app-container">
      <PageHeader title="Казна клана" />
      
      <div className="clan-treasury-content">
        <div className="clan-treasury-subtitle">
          Общий фонд клана. Средства поступают из налогов и вкладов участников
        </div>

        {/* Валюта клана */}
        <Card className="clan-treasury-balance-card">
          <div className="clan-treasury-balance-content">
            <div className="clan-treasury-icon">
              <Icon name="coin" size={80} style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.6))' }} />
            </div>
            <div className="clan-treasury-balance-info">
              <div className="clan-treasury-balance-amount gold">{treasury.toLocaleString()} NAR</div>
              <div className="clan-treasury-income gold">
                +{weeklyIncome.toLocaleString()} NAR /неделя поступления
              </div>
            </div>
          </div>
        </Card>

        {/* Последние операции */}
        <div className="clan-treasury-operations">
          <div className="clan-treasury-operations-title">Последние операции</div>
          {transactions.length === 0 ? (
            <Card>
              <div className="clan-treasury-empty">Нет операций</div>
            </Card>
          ) : (
            <div className="clan-treasury-transactions">
              {transactions.map((transaction) => {
                const amount = typeof transaction.amount === 'string' ? parseInt(transaction.amount) : transaction.amount
                const isPositive = amount > 0
                const userName = transaction.user?.nickname || transaction.user?.username || 'Неизвестно'

                return (
                  <Card key={transaction.id} className="clan-treasury-transaction">
                    <div className="clan-treasury-transaction-content">
                      <div className="clan-treasury-transaction-icon">
                        <Icon name="user" size={24} />
                      </div>
                      <div className="clan-treasury-transaction-info">
                        <div className="clan-treasury-transaction-name">{userName}</div>
                        <div className="clan-treasury-transaction-description">{transaction.description}</div>
                      </div>
                      <div className={`clan-treasury-transaction-amount ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? '+' : '-'}{formatAmount(amount)} NAR
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
          <Button
            variant="secondary"
            className="clan-treasury-view-all-btn"
            onClick={() => {
              // TODO: переход на страницу всех операций
            }}
          >
            Посмотреть всё
          </Button>
        </div>
      </div>    </div>
  )
}
