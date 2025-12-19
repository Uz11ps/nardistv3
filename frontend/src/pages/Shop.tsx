import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'

export default function Shop() {
  const [activeTab, setActiveTab] = useState<'coin' | 'subscription' | 'cosmetics'>('coin')

  const narCoinPackages = [
    { amount: 1000, price: 1, currency: 'TON' },
    { amount: 5000, price: 4, currency: 'TON' },
    { amount: 15000, price: 10, currency: 'TON' },
    { amount: 50000, price: 30, currency: 'TON' },
  ]

  const subscriptionPlans = [
    { duration: '1 месяц', price: 3, currency: 'TON', label: 'Попробовать' },
    { duration: '3 месяца', price: 7, currency: 'TON', label: 'Оптимально', highlighted: true },
    { duration: '1 год', price: 22, currency: 'TON', label: 'Выгоднее' },
  ]

  const cosmetics = [
    { name: "Доска 'Классика'", rarity: 'Редкая', price: 1200, owned: false },
    { name: "Доска 'Классика'", rarity: 'Редкая', price: 1200, owned: true },
    { name: "Доска 'Классика'", rarity: 'Редкая', price: 1200, owned: false },
  ]

  const handleBuyNarCoin = async (amount: number, price: number) => {
    try {
      // Здесь будет интеграция с платежной системой
      console.log(`Buying ${amount} NAR for ${price} TON`)
    } catch (error) {
      console.error('Purchase failed:', error)
    }
  }

  const handleSubscribe = async (plan: string) => {
    try {
      // Здесь будет интеграция с платежной системой
      console.log(`Subscribing to ${plan}`)
    } catch (error) {
      console.error('Subscription failed:', error)
    }
  }

  const handleBuyCosmetic = async (item: typeof cosmetics[0]) => {
    try {
      await apiClient.post('/shop/buy-cosmetic', { itemId: item.name })
      // Обновить список
    } catch (error) {
      console.error('Purchase failed:', error)
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Магазин" />
      
      <div style={{ padding: '20px' }}>
        {/* Вкладки */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'coin' ? 'active' : ''}`}
            onClick={() => setActiveTab('coin')}
          >
            NAR-coin
          </button>
          <button
            className={`tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}
          >
            Подписка
          </button>
          <button
            className={`tab ${activeTab === 'cosmetics' ? 'active' : ''}`}
            onClick={() => setActiveTab('cosmetics')}
          >
            Косметика
          </button>
        </div>

        {/* NAR-coin */}
        {activeTab === 'coin' && (
          <div>
            {narCoinPackages.map((pkg) => (
              <Card key={pkg.amount} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="card-title">{pkg.amount.toLocaleString()} NAR</div>
                    <div className="card-subtitle">Цена: {pkg.price} {pkg.currency}</div>
                  </div>
                  <div style={{ fontSize: '48px' }}>🪙</div>
                  <Button onClick={() => handleBuyNarCoin(pkg.amount, pkg.price)}>
                    Купить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Подписка */}
        {activeTab === 'subscription' && (
          <div>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <div className="card-title">Подписка</div>
              <div className="card-subtitle">Для тех, кто хочет играть на уровне мастеров</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Card>
                <div className="card-title">История игр</div>
                <div className="card-subtitle">Полный список твоих матчей</div>
              </Card>
              <Card>
                <div className="card-title">Анализ</div>
                <div className="card-subtitle">Разбор ошибок и лучших ходов</div>
              </Card>
              <Card>
                <div className="card-title">Тренажёр</div>
                <div className="card-subtitle">Разбирай позиции и стратегии</div>
              </Card>
              <Card>
                <div className="card-title">Приоритет</div>
                <div className="card-subtitle">Попадай к соперникам быстрее</div>
              </Card>
              <Card>
                <div className="card-title">Премиум-значок</div>
                <div className="card-subtitle">Отметь свой статус в таблице</div>
              </Card>
            </div>

            {subscriptionPlans.map((plan) => (
              <Card
                key={plan.duration}
                style={{
                  marginBottom: '12px',
                  border: plan.highlighted ? '2px solid #ffd700' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="card-title">{plan.duration}</div>
                    <div className="card-subtitle">
                      {plan.price} {plan.currency} • {plan.label}
                    </div>
                  </div>
                  <Button onClick={() => handleSubscribe(plan.duration)}>
                    Купить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Косметика */}
        {activeTab === 'cosmetics' && (
          <div>
            {cosmetics.map((item, index) => (
              <Card key={index} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      background: '#3a3a3a',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    🎲
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{item.name}</div>
                    <div className="card-subtitle">{item.rarity}</div>
                    <div className="gold" style={{ marginTop: '4px' }}>
                      {item.price} NAR
                    </div>
                  </div>
                  {item.owned ? (
                    <Button variant="secondary" disabled>Куплено</Button>
                  ) : (
                    <Button onClick={() => handleBuyCosmetic(item)}>Купить</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

