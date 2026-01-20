import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { StarIcon, TargetIcon, EnergyIcon, CrownIcon, ScrollIcon, BrainIcon } from '../components/Icons'
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
    icon: <ScrollIcon size={24} style={{ color: '#FFD700' }} />,
    iconBg: 'rgba(255, 215, 0, 0.15)',
  },
  {
    title: 'Анализ',
    description: 'Разбор ошибок и лучших ходов',
    icon: <BrainIcon size={24} style={{ color: '#FFD700' }} />,
    iconBg: 'rgba(255, 215, 0, 0.15)',
  },
  {
    title: 'Тренажёр',
    description: 'Разбирай позиции и стратегии',
    icon: <TargetIcon size={24} style={{ color: '#FFF' }} />,
    iconBg: 'rgba(255, 255, 255, 0.1)',
  },
  {
    title: 'Приоритет',
    description: 'Попадай к соперникам быстрее',
    icon: <EnergyIcon size={24} style={{ color: '#FF4444' }} />,
    iconBg: 'rgba(255, 68, 68, 0.15)',
  },
  {
    title: 'Премиум-значок',
    description: 'Отметь свой статус в таблице',
    icon: <CrownIcon size={24} style={{ color: '#FFF' }} />,
    iconBg: 'rgba(255, 255, 255, 0.1)',
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
    <PageLayout title="Подписка" showBack={true}>
      <div className="subscription-content">
        <div className="subscription-subtitle">
          Для тех, кто хочет играть на уровне мастеров
        </div>

        {/* Преимущества подписки */}
        <div className="subscription-features">
          {subscriptionFeatures.map((feature, index) => (
            <Card key={index} className="subscription-feature-card">
              <div className="subscription-feature-content">
                <div 
                  className="subscription-feature-icon" 
                  style={{ 
                    fontSize: '24px',
                    background: feature.iconBg || 'rgba(255, 215, 0, 0.1)'
                  }}
                >
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
          marginTop: '24px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <button
            onClick={() => setPaymentMethod('TRIBUTE')}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 8px',
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
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxSizing: 'border-box',
            }}
          >
            Tribute <img src="/img/crown.png" alt="tribute" style={{ width: '16px', height: '16px', objectFit: 'contain', verticalAlign: 'middle', display: 'inline-block' }} />
          </button>
          <button
            onClick={() => setPaymentMethod('STARS')}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 8px',
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
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxSizing: 'border-box',
            }}
          >
            Stars <StarIcon size={16} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
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

      </div>
    </PageLayout>
  )
}

