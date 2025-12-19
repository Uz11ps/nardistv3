import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import SkinSelectModal from '../components/SkinSelectModal'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Skin {
  id: string
  name: string
  description?: string
  theme: string
  imageUrl?: string
  price?: number
  rarity: string
  weight: number
  isPremium: boolean
  isDefault: boolean
}

export default function Shop() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'coin' | 'subscription' | 'cosmetics'>('coin')
  const [skins, setSkins] = useState<Skin[]>([])
  const [ownedSkins, setOwnedSkins] = useState<string[]>([])
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null)
  const [showSkinModal, setShowSkinModal] = useState(false)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    if (activeTab === 'cosmetics') {
      loadSkins()
    }
  }, [activeTab])

  const loadSkins = async () => {
    try {
      setLoading(true)
      const [allSkinsResponse, mySkinsResponse, selectedSkinResponse] = await Promise.all([
        apiClient.get('/skins'),
        apiClient.get('/skins/my'),
        apiClient.get('/skins/selected'),
      ])

      const allSkins = allSkinsResponse.data || []
      const mySkins = mySkinsResponse.data || []
      const selected = selectedSkinResponse.data

      setSkins(allSkins)
      setOwnedSkins([...mySkins.map((s: Skin) => s.id), ...allSkins.filter((s: Skin) => s.isDefault).map((s: Skin) => s.id)])
      setSelectedSkinId(selected?.id || null)
    } catch (error) {
      console.error('Failed to load skins:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleBuySkin = async (skinId: string) => {
    try {
      const skin = skins.find((s) => s.id === skinId)
      if (!skin || !skin.price) return

      // Здесь будет интеграция с платежной системой для покупки
      // Пока просто показываем сообщение
      alert(`Покупка скина "${skin.name}" за ${skin.price} NAR. Интеграция с платежной системой в разработке.`)
      
      // После покупки обновляем список
      await loadSkins()
    } catch (error) {
      console.error('Purchase failed:', error)
    }
  }

  const handleSelectSkin = async (skinId: string) => {
    try {
      await apiClient.post('/skins/select', { skinId })
      setSelectedSkinId(skinId)
      await loadSkins()
    } catch (error: any) {
      console.error('Failed to select skin:', error)
      alert(error.response?.data?.message || 'Ошибка при выборе скина')
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return '#FFD700'
      case 'epic':
        return '#9B59B6'
      case 'rare':
        return '#3498DB'
      default:
        return '#95A5A6'
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
            <div style={{ marginBottom: '16px' }}>
              <Button fullWidth onClick={() => setShowSkinModal(true)}>
                Выбрать скин
              </Button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Загрузка...</div>
            ) : (
              <div>
                {skins.map((skin) => {
                  const isOwned = ownedSkins.includes(skin.id)
                  const isSelected = selectedSkinId === skin.id

                  return (
                    <Card key={skin.id} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {skin.imageUrl ? (
                          <img
                            src={skin.imageUrl}
                            alt={skin.name}
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '80px',
                              height: '80px',
                              background: skin.boardConfig?.color || '#3a3a3a',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '32px',
                            }}
                          >
                            🎲
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div className="card-title">{skin.name}</div>
                          {skin.description && (
                            <div className="card-subtitle" style={{ fontSize: '12px' }}>
                              {skin.description}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: '12px',
                              color: getRarityColor(skin.rarity),
                              marginTop: '4px',
                            }}
                          >
                            {skin.rarity === 'legendary' && 'Легендарный'}
                            {skin.rarity === 'epic' && 'Эпический'}
                            {skin.rarity === 'rare' && 'Редкий'}
                            {skin.rarity === 'common' && 'Обычный'}
                          </div>
                          {!isOwned && skin.price && (
                            <div className="gold" style={{ marginTop: '4px' }}>
                              {skin.price} NAR
                            </div>
                          )}
                          {isSelected && (
                            <div style={{ fontSize: '12px', color: '#4CAF50', marginTop: '4px' }}>
                              Выбрано
                            </div>
                          )}
                        </div>
                        {isOwned ? (
                          <Button
                            variant={isSelected ? 'primary' : 'secondary'}
                            onClick={() => handleSelectSkin(skin.id)}
                          >
                            {isSelected ? 'Выбрано' : 'Выбрать'}
                          </Button>
                        ) : (
                          <Button onClick={() => handleBuySkin(skin.id)}>
                            Купить
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <SkinSelectModal
          isOpen={showSkinModal}
          onClose={() => setShowSkinModal(false)}
          onSelect={handleSelectSkin}
          selectedSkinId={selectedSkinId || undefined}
          ownedSkins={ownedSkins}
        />
      </div>
    </div>
  )
}

