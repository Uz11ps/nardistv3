import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
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
        apiClient.get(`/clans/${clanId}`).catch(() => ({ data: null })),
        apiClient.get(`/clans/${clanId}/treasury/transactions?limit=5`).catch(() => ({ data: [] })),
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

    if (minutes < 60) return `${minutes} минут назад`
    if (hours < 24) return `${hours} часа назад`
    if (days < 7) return `${days} дней назад`
    return date.toLocaleDateString('ru-RU')
  }

  if (loading) {
    return (
      <PageLayout title="Казна клана" showBack={true}>
        <div className="clan-treasury-loading">Загрузка...</div>
      </PageLayout>
    )
  }

  if (!clan) {
    return null
  }

  const treasury = typeof clan.treasury === 'string' ? parseInt(clan.treasury) : clan.treasury
  const weeklyIncome = typeof clan.weeklyIncome === 'string' ? parseInt(clan.weeklyIncome) : clan.weeklyIncome

  return (
    <PageLayout
      title="Казна клана"
      subtitle="Общий фонд клана. Средства поступают из налогов и вкладов участников"
      showBack={true}
    >
      <div className="clan-treasury-content">
        {/* Валюта клана */}
        <div className="clan-treasury-balance">
          <img src="/img/narcoin.png" alt="NAR" className="clan-treasury-coin-icon" />
          <div className="clan-treasury-balance-amount">{treasury.toLocaleString()} NAR</div>
          <div className="clan-treasury-weekly-income">
            +{weeklyIncome.toLocaleString()} NAR / неделя (поступления)
          </div>
        </div>

        {/* Последние операции */}
        <div className="clan-treasury-operations">
          <div className="clan-treasury-operations-title">Последние операции</div>
          <div className="clan-treasury-operations-list">
            {transactions.map((transaction) => {
              const amount = typeof transaction.amount === 'string' ? parseInt(transaction.amount) : transaction.amount
              const isPositive = amount > 0
              const userName = transaction.user?.nickname || transaction.user?.username || 'Алексей'
              
              return (
                <div key={transaction.id} className="clan-treasury-operation-item">
                  <img src="/img/челувек.png" alt="User" className="clan-treasury-operation-icon" />
                  <div className="clan-treasury-operation-info">
                    <div className="clan-treasury-operation-name">{userName}</div>
                    <div className="clan-treasury-operation-description">{transaction.description}</div>
                  </div>
                  <div className={`clan-treasury-operation-amount ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '+' : ''}{formatAmount(transaction.amount)} NAR
                  </div>
                </div>
              )
            })}
          </div>
          <button className="clan-treasury-view-all-button">Посмотреть всё</button>
        </div>
      </div>
    </PageLayout>
  )
}
