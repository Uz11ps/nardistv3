import { useState, useEffect } from 'react'
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
  price: number | null
  priceTribute?: number
  priceStars?: number
  currency: string
  badge?: string
  popular?: boolean
  showPrice?: boolean
}


const subscriptionFeatures = [
  {
    title: 'История игр',
    description: 'Полный список твоих матчей',
    icon: '📜',
  },
  {
    title: 'Анализ',
    description: 'Разбор ошибок и лучших ходов',
    icon: '🧠',
  },
  {
    title: 'Тренажёр',
    description: 'Разбирай позиции и стратегии',
    icon: '🎯',
  },
  {
    title: 'Приоритет',
    description: 'Попадай к соперникам быстрее',
    icon: '⚡',
  },
  {
    title: 'Премиум-значок',
    description: 'Отметь свой статус в таблице',
    icon: '👑',
  },
]

export default function Subscription() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan['id']>('month_3')
  const [loading, setLoading] = useState(false)
  const [hasCityAutobuild, setHasCityAutobuild] = useState(false)
  const [purchasingAutobuild, setPurchasingAutobuild] = useState(false)
  const [autobuildPaymentMethod, setAutobuildPaymentMethod] = useState<'usd' | 'nar'>('nar')
  const [paymentMethod, setPaymentMethod] = useState<'TRIBUTE' | 'STARS'>('TRIBUTE')

  useEffect(() => {
    loadPlans()
    loadCityAutobuildStatus()
  }, [])

  useEffect(() => {
    loadPlans()
  }, [paymentMethod])

  const loadPlans = async () => {
    try {
      const response = await apiClient.get(`/subscription/plans?method=${paymentMethod}`)
      if (response.data && response.data.length > 0) {
        setSubscriptionPlans(response.data)
        // Устанавливаем выбранный план как популярный или средний
        const popularPlan = response.data.find((p: SubscriptionPlan) => p.popular)
        if (popularPlan) {
          setSelectedPlan(popularPlan.id)
        } else if (response.data.length > 0) {
          setSelectedPlan(response.data[0].id)
        }
      } else {
        setSubscriptionPlans([])
      }
    } catch (error) {
      console.error('Failed to load subscription plans:', error)
      setSubscriptionPlans([])
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
      console.log('Creating payment transaction:', { plan: selectedPlan, method: paymentMethod })
      
      // Создаем платежную транзакцию
      const response = await apiClient.post('/subscription/payment/create', {
        plan: selectedPlan,
        method: paymentMethod,
      })
      
      console.log('Payment transaction created:', response.data)
      
      // Для STARS открываем инвойс через WebApp API
      if (paymentMethod === 'STARS' && response.data.invoice) {
        const telegramWebApp = (window as any).Telegram?.WebApp
        if (!telegramWebApp) {
          throw new Error('Telegram WebApp не доступен. Откройте приложение через Telegram бота.')
        }

        // Для Stars платежей используем полную ссылку на инвойс
        // По документации Telegram: openInvoice(invoiceUrl, callback)
        const invoiceUrl = response.data.invoice.url || response.data.invoice.slug
        
        if (!invoiceUrl) {
          throw new Error('Не получена ссылка на инвойс для оплаты')
        }

        // Если это slug без префикса, добавляем полный URL
        const fullInvoiceUrl = invoiceUrl.startsWith('http') 
          ? invoiceUrl 
          : invoiceUrl.startsWith('$')
          ? `https://t.me/${invoiceUrl}`
          : `https://t.me/$${invoiceUrl}`

        console.log('Opening Stars invoice:', { url: fullInvoiceUrl, invoice: response.data.invoice })

        // Открываем инвойс через WebApp API (принимает полный URL)
        telegramWebApp.openInvoice(fullInvoiceUrl, (status: string) => {
          if (status === 'paid') {
            // Платеж успешен
            handlePaymentSuccess()
          } else if (status === 'cancelled') {
            alert('Платеж отменен')
          } else if (status === 'failed') {
            alert('Ошибка при оплате')
          }
          setLoading(false)
        })
        return
      }

      // Для TRIBUTE открываем ссылку на товар Tribute
      if (paymentMethod === 'TRIBUTE' && response.data.tributeLink) {
        const transactionId = response.data.transactionId
        const tributeLink = response.data.tributeLink
        const telegramWebApp = (window as any).Telegram?.WebApp

        // Открываем ссылку Tribute
        if (telegramWebApp) {
          if (tributeLink.includes('t.me/') || tributeLink.includes('tg://')) {
            telegramWebApp.openTelegramLink(tributeLink)
          } else {
            telegramWebApp.openLink(tributeLink)
          }
        } else {
          window.open(tributeLink, '_blank')
        }
        
        // Показываем сообщение пользователю
        alert('Открыта страница оплаты Tribute. После оплаты вернитесь в приложение.')
        
        // Проверяем статус транзакции каждые 3 секунды после возврата пользователя
        const checkStatusInterval = setInterval(async () => {
          try {
            const statusResponse = await apiClient.get(`/subscription/payment/${transactionId}/status`)
            if (statusResponse.data.status === 'completed') {
              clearInterval(checkStatusInterval)
              handlePaymentSuccess()
            } else if (statusResponse.data.status === 'failed') {
              clearInterval(checkStatusInterval)
              alert('Платеж не прошел. Попробуйте снова.')
            }
          } catch (error) {
            console.error('Ошибка проверки статуса:', error)
          }
        }, 3000)
        
        // Останавливаем проверку через 5 минут
        setTimeout(() => clearInterval(checkStatusInterval), 300000)
        
        setLoading(false)
        return
      }
      
      throw new Error('Неизвестный метод оплаты')
    } catch (error: any) {
      console.error('Failed to create payment:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка при создании платежа'
      alert(errorMessage)
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
                <div className="subscription-feature-icon" style={{ fontSize: '24px' }}>
                  {feature.icon}
                </div>
                <div className="subscription-feature-info">
                  <div className="subscription-feature-title">{feature.title}</div>
                  <div className="subscription-feature-description">{feature.description}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Выбор метода оплаты */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '24px',
          marginTop: '24px'
        }}>
          <button
            onClick={() => setPaymentMethod('TRIBUTE')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              background: paymentMethod === 'TRIBUTE' 
                ? 'linear-gradient(180deg, #3390EC 0%, #1E5FA8 100%)' 
                : '#3a3a3a',
              border: paymentMethod === 'TRIBUTE' ? '2px solid #3390EC' : '1px solid #4a4a4a',
              color: '#FFF',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Tribute ⭐
          </button>
          <button
            onClick={() => setPaymentMethod('STARS')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              background: paymentMethod === 'STARS' 
                ? 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)' 
                : '#3a3a3a',
              border: paymentMethod === 'STARS' ? '2px solid #FFD700' : '1px solid #4a4a4a',
              color: '#FFF',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Stars ⭐
          </button>
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
                {plan.currency === 'TRIBUTE' ? (
                  <span style={{ fontSize: '14px', color: '#aaa' }}>Через Tribute</span>
                ) : plan.price !== null && plan.price !== undefined ? (
                  <>
                    <span className="subscription-plan-price-icon">▼</span>
                    <span>{plan.price} {plan.currency}</span>
                  </>
                ) : null}
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

    </div>
  )
}

