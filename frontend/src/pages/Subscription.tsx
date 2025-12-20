import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
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
  const { user } = useAuthStore()
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>(defaultPlans)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan['id']>('month_3')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPlans()
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

  const handleSubscribe = async () => {
    try {
      setLoading(true)
      // TODO: интеграция с платежной системой TON
      await apiClient.post('/subscription/purchase', { plan: selectedPlan })
      alert('Подписка успешно оформлена!')
      // Обновляем данные пользователя
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
      navigate('/')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при оформлении подписки')
      console.error('Failed to subscribe:', error)
    } finally {
      setLoading(false)
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
      </div>
    </div>
  )
}

