import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
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
  const { user } = useAuthStore()
  const [clan, setClan] = useState<Clan | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showContributeModal, setShowContributeModal] = useState(false)
  const [contributeAmount, setContributeAmount] = useState('')
  const [contributing, setContributing] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  useEffect(() => {
    if (clanId) {
      loadData()
    }
  }, [clanId, showAllTransactions])

  const loadData = async () => {
    try {
      setLoading(true)
      const limit = showAllTransactions ? 100 : 5
      const [clanResponse, transactionsResponse] = await Promise.all([
        apiClient.get(`/clans/${clanId}`).catch(() => ({ data: null })),
        apiClient.get(`/clans/${clanId}/treasury/transactions?limit=${limit}`).catch(() => ({ data: [] })),
      ])
      setClan(clanResponse.data)
      setTransactions(transactionsResponse.data || [])
    } catch (error) {
      console.error('Failed to load treasury data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clanId) {
      loadData()
    }
  }, [clanId, showAllTransactions])

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

  const handleContribute = async () => {
    const amount = parseInt(contributeAmount)
    if (!amount || amount <= 0) {
      alert('Введите корректную сумму')
      return
    }

    const userBalance = Number(user?.narCoin || 0)
    if (userBalance < amount) {
      alert(`Недостаточно NAR-coin. У вас: ${userBalance}`)
      return
    }

    try {
      setContributing(true)
      await apiClient.post(`/clans/${clanId}/contribute`, { amount })
      alert('Вклад успешно внесен!')
      setShowContributeModal(false)
      setContributeAmount('')
      await loadData()
      // Обновляем данные пользователя
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при внесении вклада')
      console.error('Failed to contribute:', error)
    } finally {
      setContributing(false)
    }
  }

  const quickContribute = (amount: number) => {
    const userBalance = Number(user?.narCoin || 0)
    if (userBalance < amount) {
      alert(`Недостаточно NAR-coin. У вас: ${userBalance}`)
      return
    }
    setContributeAmount(amount.toString())
  }

  if (loading) {
    return (
      <PageLayout title="Казна федерации" showBack={true}>
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
      title="Казна федерации"
      subtitle="Общий фонд федерации. Средства поступают из налогов и вкладов участников"
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
          <button 
            className="clan-treasury-view-all-button"
            onClick={() => {
              setShowAllTransactions(!showAllTransactions)
            }}
          >
            {showAllTransactions ? 'Скрыть' : 'Посмотреть всё'}
          </button>
          <button 
            className="clan-treasury-contribute-button"
            onClick={() => setShowContributeModal(true)}
          >
            Вложиться
          </button>
        </div>
      </div>

      {/* Модальное окно вложения */}
      {showContributeModal && (
        <div className="clan-treasury-modal-overlay" onClick={() => setShowContributeModal(false)}>
          <div className="clan-treasury-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clan-treasury-modal-header">
              <h2 className="clan-treasury-modal-title">Вложиться в казну</h2>
              <button 
                className="clan-treasury-modal-close"
                onClick={() => setShowContributeModal(false)}
              >
                ×
              </button>
            </div>
            <div className="clan-treasury-modal-content">
              <div className="clan-treasury-modal-balance">
                Ваш баланс: {Number(user?.narCoin || 0).toLocaleString()} NAR
              </div>
              <div className="clan-treasury-modal-quick-amounts">
                <button 
                  className="clan-treasury-quick-amount-btn"
                  onClick={() => quickContribute(100)}
                >
                  100 NAR
                </button>
                <button 
                  className="clan-treasury-quick-amount-btn"
                  onClick={() => quickContribute(500)}
                >
                  500 NAR
                </button>
                <button 
                  className="clan-treasury-quick-amount-btn"
                  onClick={() => quickContribute(1000)}
                >
                  1,000 NAR
                </button>
                <button 
                  className="clan-treasury-quick-amount-btn"
                  onClick={() => quickContribute(5000)}
                >
                  5,000 NAR
                </button>
              </div>
              <div className="clan-treasury-modal-input-group">
                <label className="clan-treasury-modal-label">Сумма вложения:</label>
                <input
                  type="number"
                  className="clan-treasury-modal-input"
                  placeholder="Введите сумму"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div className="clan-treasury-modal-footer">
              <button 
                className="clan-treasury-modal-cancel"
                onClick={() => setShowContributeModal(false)}
              >
                Отмена
              </button>
              <button 
                className="clan-treasury-modal-submit"
                onClick={handleContribute}
                disabled={contributing || !contributeAmount || parseInt(contributeAmount) <= 0}
              >
                {contributing ? 'Вложение...' : 'Вложиться'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
