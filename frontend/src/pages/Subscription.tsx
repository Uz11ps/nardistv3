import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import TonPaymentModal from '../components/TonPaymentModal'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import './Subscription.css'

interface SubscriptionPlan {
  id: 'month_1' | 'month_3' | 'month_12'
  name: string
  price: number
  currency: string
  badge?: string
  popular?: boolean
}

const defaultPlans: SubscriptionPlan[] = [
  { id: 'month_1', name: '1 месяц', price: 3, currency: 'TON', badge: 'Попробовать' },
  { id: 'month_3', name: '3 месяца', price: 7, currency: 'TON', badge: 'Оптимально', popular: true },
  { id: 'month_12', name: '1 год', price: 22, currency: 'TON', badge: 'Выгоднее' },
]

const subscriptionFeatures = [
  {
    title: 'История игр',
    description: 'Полный список твоих матчей',
    icon: 'history',
  },
  {
    title: 'Анализ',
    description: 'Разбор ошибок и лучших ходов',
    icon: 'analysis',
  },
  {
    title: 'Тренажёр',
    description: 'Разбирай позиции и стратегии',
    icon: 'trainer',
  },
  {
    title: 'Приоритет',
    description: 'Попадай к соперникам быстрее',
    icon: 'priority',
  },
  {
    title: 'Премиум-значок',
    description: 'Отметь свой статус в таблице',
    icon: 'crown',
  },
]

export default function Subscription() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>(defaultPlans)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan['id']>('month_3')
  const [loading, setLoading] = useState(false)
  const [hasCityAutobuild, setHasCityAutobuild] = useState(false)
  const [purchasingAutobuild, setPurchasingAutobuild] = useState(false)
  const [autobuildPaymentMethod, setAutobuildPaymentMethod] = useState<'usd' | 'nar'>('nar')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    transactionId: string
    walletAddress: string
    amount: number
    comment: string
    method: 'TON' | 'USDT'
  } | null>(null)

  useEffect(() => {
    loadPlans()
    loadCityAutobuildStatus()
  }, [])

  const loadPlans = async () => {
    try {
      const response = await apiClient.get('/subscription/plans').catch(() => ({ data: defaultPlans }))
      setSubscriptionPlans(response.data || defaultPlans)
      // Устанавливаем выбранный план как популярный или средний
      const popularPlan = response.data?.find((p: SubscriptionPlan) => p.popular)
      if (popularPlan) {
        setSelectedPlan(popularPlan.id)
      }
    } catch (error) {
      console.error('Failed to load subscription plans:', error)
    }
  }

  const loadCityAutobuildStatus = async () => {
    try {
      const response = await apiClient.get('/subscription/city-autobuild/status')
      setHasCityAutobuild(response.data?.hasAutobuild || false)
    } catch (error) {
      console.error('Failed to load city autobuild status:', error)
    }
  }

  const handleSubscribe = async () => {
    try {
      setLoading(true)
      // Создаем платежную транзакцию
      const response = await apiClient.post('/subscription/payment/create', {
        plan: selectedPlan,
        method: 'TON',
      })
      
      const { transactionId, walletAddress, amount, comment, method } = response.data
      
      // Показываем модальное окно оплаты
      setPaymentData({
        transactionId,
        walletAddress,
        amount,
        comment,
        method: method === 'TON' ? 'TON' : 'USDT',
      })
      setShowPaymentModal(true)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при создании платежа')
      console.error('Failed to create payment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = async () => {
    // Обновляем данные пользователя после успешной оплаты
    try {
      const userResponse = await apiClient.get('/users/me')
      updateUser(userResponse.data)
      alert('Подписка успешно активирована!')
      navigate('/')
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const handlePurchaseCityAutobuild = async () => {
    try {
      setPurchasingAutobuild(true)
      await apiClient.post('/subscription/city-autobuild/purchase', { paymentMethod: autobuildPaymentMethod })
      alert('Автобилд города успешно активирован!')
      await loadCityAutobuildStatus()
      // Обновляем данные пользователя
      const userResponse = await apiClient.get('/users/me')
      updateUser(userResponse.data)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке автобилда города')
      console.error('Failed to purchase city autobuild:', error)
    } finally {
      setPurchasingAutobuild(false)
    }
  }

  return (
    <div className="app-container page-transition">
      <PageHeader title="Подписка" />
      
      <div className="subscription-content">
        <div className="subscription-subtitle">
          Для тех, кто хочет играть на уровне мастеров
        </div>

        {/* Преимущества подписки */}
        <div className="subscription-features">
          {subscriptionFeatures.map((feature, index) => (
            <Card key={index} className="subscription-feature-card">
              <div className="subscription-feature-content">
                <div className="subscription-feature-icon">
                  <Icon name={feature.icon} size={32} style={{ color: 'var(--color-gold)' }} />
                </div>
                <div className="subscription-feature-info">
                  <div className="subscription-feature-title">{feature.title}</div>
                  <div className="subscription-feature-description">{feature.description}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Варианты подписки */}
        <div className="subscription-plans">
          {subscriptionPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`subscription-plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <div className="subscription-plan-header">
                <div className="subscription-plan-name">{plan.name}</div>
                {plan.badge && (
                  <div className={`subscription-plan-badge ${plan.popular ? 'popular-badge' : ''}`}>
                    {plan.badge}
                  </div>
                )}
              </div>
              <div className="subscription-plan-price">
                <span className="subscription-plan-price-icon">▼</span>
                <span>{plan.price} {plan.currency}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Кнопка оформления */}
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubscribe}
          disabled={loading}
          className="subscription-submit-btn"
        >
          {loading ? 'Оформление...' : 'Оформить подписку'}
        </Button>

        {/* Автобилд города */}
        <Card className="subscription-autobuild-card">
          <div className="subscription-autobuild-header">
            <div className="subscription-autobuild-icon">🏗️</div>
            <div className="subscription-autobuild-info">
              <div className="subscription-autobuild-title">Автобилд города</div>
              <div className="subscription-autobuild-description">
                Автоматическая покупка построек при наличии средств
              </div>
            </div>
          </div>
          {hasCityAutobuild ? (
            <div className="subscription-autobuild-activated">
              ✅ Активировано
            </div>
          ) : (
            <div className="subscription-autobuild-purchase">
              <div className="subscription-autobuild-payment-methods">
                <button
                  className={`subscription-autobuild-payment-btn ${autobuildPaymentMethod === 'usd' ? 'active' : ''}`}
                  onClick={() => setAutobuildPaymentMethod('usd')}
                >
                  $50 USD
                </button>
                <button
                  className={`subscription-autobuild-payment-btn ${autobuildPaymentMethod === 'nar' ? 'active' : ''}`}
                  onClick={() => setAutobuildPaymentMethod('nar')}
                >
                  10,000 NAR
                </button>
              </div>
              <Button
                variant="primary"
                fullWidth
                onClick={handlePurchaseCityAutobuild}
                disabled={purchasingAutobuild}
                className="subscription-autobuild-buy-btn"
              >
                {purchasingAutobuild ? 'Покупка...' : 'Купить навсегда'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Модальное окно оплаты TON */}
      {showPaymentModal && paymentData && (
        <TonPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setPaymentData(null)
          }}
          transactionId={paymentData.transactionId}
          walletAddress={paymentData.walletAddress}
          amount={paymentData.amount}
          comment={paymentData.comment}
          method={paymentData.method}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}

