import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Skin } from '../types/skin'
import './Shop.css'

interface NarCoinPackage {
  amount: number
  price: number
  currency: string
}

export default function Shop() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'coin' | 'subscription' | 'skins'>('coin')
  const [skinFilter, setSkinFilter] = useState<'all' | 'board' | 'dice' | 'checkers'>('all')
  const [narCoinPackages, setNarCoinPackages] = useState<NarCoinPackage[]>([])
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const [ownedSkins, setOwnedSkins] = useState<string[]>([])
  const [selectedSkinIds, setSelectedSkinIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processingSkinId, setProcessingSkinId] = useState<string | null>(null)
  const [buyingNarCoinAmount, setBuyingNarCoinAmount] = useState<number | null>(null)
  const [hasCityAutobuild, setHasCityAutobuild] = useState(false)
  const [purchasingAutobuild, setPurchasingAutobuild] = useState(false)
  const [autobuildPaymentMethod, setAutobuildPaymentMethod] = useState<'usd' | 'nar'>('nar')
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  useEffect(() => {
    if (activeTab === 'coin') {
      loadNarCoinPackages()
    } else if (activeTab === 'skins') {
      loadSkins()
    } else if (activeTab === 'subscription') {
      loadCityAutobuildStatus()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'skins') {
      // Фильтр применяется на клиенте из уже загруженных скинов
    }
  }, [skinFilter, activeTab])

  const loadNarCoinPackages = async () => {
    try {
      setLoading(true)
      // Загружаем пакеты NAR-coin с сервера
      const response = await apiClient.get('/shop/nar-coin-packages').catch(() => {
        // Если endpoint не существует, используем дефолтные значения
        return { data: [
          { amount: 1000, price: 1, currency: 'TON' },
          { amount: 5000, price: 4, currency: 'TON' },
          { amount: 15000, price: 10, currency: 'TON' },
          { amount: 50000, price: 30, currency: 'TON' },
        ]}
      })
      setNarCoinPackages(response.data || [])
    } catch (error) {
      console.error('Failed to load NAR-coin packages:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSkins = async () => {
    try {
      setLoading(true)
      const [allSkinsResponse, mySkinsResponse, selectedSkinResponse] = await Promise.all([
        apiClient.get('/skins'),
        apiClient.get('/skins/my'),
        // Используем /skins/selected/explicit чтобы получить ТОЛЬКО явно выбранные скины
        apiClient.get('/skins/selected/explicit').catch(() => {
          // Fallback на старый endpoint если новый не существует
          return apiClient.get('/skins/selected')
        }),
      ])

      const skinsData = allSkinsResponse.data || []
      const mySkins = mySkinsResponse.data || []
      const selected = selectedSkinResponse.data || {}

      setAllSkins(skinsData)
      setOwnedSkins([...mySkins.map((s: Skin) => s.id), ...skinsData.filter((s: Skin) => s.isDefault).map((s: Skin) => s.id)])
      
      const selectedIds = new Set<string>()
      if (selected.board) selectedIds.add(selected.board.id)
      if (selected.dice) selectedIds.add(selected.dice.id)
      if (selected.checkers) selectedIds.add(selected.checkers.id)
      setSelectedSkinIds(selectedIds)
    } catch (error) {
      console.error('Failed to load skins:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredSkins = () => {
    // Фильтруем классические скины (по theme === 'classic' или isDefault === true)
    const filtered = allSkins.filter((s: Skin) => {
      // Исключаем классические скины
      if (s.theme === 'classic' || s.isDefault) {
        return false
      }
      return true
    })
    
    if (skinFilter === 'all') {
      return filtered
    }
    return filtered.filter((s: Skin) => s.type === skinFilter)
  }

  const getSkinsByType = (type: string) => {
    // Фильтруем классические скины
    return allSkins.filter((s: Skin) => {
      if (s.theme === 'classic' || s.isDefault) {
        return false
      }
      return s.type === type
    })
  }

  const loadCityAutobuildStatus = async () => {
    try {
      const response = await apiClient.get('/subscription/city-autobuild/status').catch(() => ({ data: { hasAutobuild: false } }))
      setHasCityAutobuild(response.data?.hasAutobuild || false)
    } catch (error) {
      console.error('Failed to load city autobuild status:', error)
    }
  }

  const handleBuySubscription = async (plan: string, price: number) => {
    try {
      // Создаем платеж через TON для подписки
      const response = await apiClient.post('/payment/ton/create', { 
        amount: price, 
        description: `Подписка ${plan}`,
        type: 'subscription'
      })
      
      if (response.data.paymentUrl) {
        // Открываем страницу оплаты
        window.open(response.data.paymentUrl, '_blank')
        alert('Откройте ссылку для оплаты. После оплаты подписка будет активирована автоматически.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при создании платежа')
      console.error('Subscription purchase failed:', error)
    }
  }

  const handlePurchaseCityAutobuild = async () => {
    try {
      setPurchasingAutobuild(true)
      await apiClient.post('/subscription/city-autobuild/purchase', { paymentMethod: autobuildPaymentMethod })
      alert('Автобилд города успешно активирован!')
      await loadCityAutobuildStatus()
      // Обновляем данные пользователя
      if (user) {
        const userResponse = await apiClient.get('/users/me')
        useAuthStore.setState({ user: userResponse.data })
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке автобилда города')
      console.error('Failed to purchase city autobuild:', error)
    } finally {
      setPurchasingAutobuild(false)
    }
  }

  const handleBuyNarCoin = async (amount: number, price: number) => {
    if (buyingNarCoinAmount !== null) return // Защита от повторных запросов
    
    try {
      setBuyingNarCoinAmount(amount)
      // TODO: интеграция с платежной системой TON
      const response = await apiClient.post('/shop/purchase-nar-coin', { amount, price, currency: 'TON' }).catch(() => {
        throw new Error('Интеграция с платежной системой в разработке')
      })
      alert(`Покупка ${amount} NAR за ${price} TON успешна!`)
      // Обновляем баланс пользователя
      if (user) {
        const userResponse = await apiClient.get('/users/me')
        useAuthStore.setState({ user: userResponse.data })
      }
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Ошибка при покупке')
      console.error('Purchase failed:', error)
    } finally {
      setBuyingNarCoinAmount(null)
    }
  }

  const handleBuySkin = async (skinId: string) => {
    if (processingSkinId !== null) return // Защита от повторных запросов
    
    try {
      setProcessingSkinId(skinId)
      const skin = allSkins.find((s) => s.id === skinId)
      if (!skin) return

      await apiClient.post('/skins/purchase', { skinId })
      
      // Немедленно добавляем скин в ownedSkins для мгновенного обновления UI
      setOwnedSkins(prev => [...prev, skinId])
      
      // Обновляем баланс пользователя
      if (user) {
        const userResponse = await apiClient.get('/users/me')
        useAuthStore.setState({ user: userResponse.data })
      }
      
      // Перезагружаем список скинов для синхронизации с сервером
      await loadSkins()
      
      alert(`Скин "${skin.name}" успешно куплен!`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке скина')
      console.error('Purchase failed:', error)
      // В случае ошибки перезагружаем скины, чтобы вернуть корректное состояние
      await loadSkins()
    } finally {
      setProcessingSkinId(null)
    }
  }

  const handleSelectSkin = async (skinId: string) => {
    if (processingSkinId !== null) return // Защита от повторных запросов
    
    try {
      setProcessingSkinId(skinId)
      await apiClient.post('/skins/select', { skinId })
      await loadSkins()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при выборе скина')
      console.error('Failed to select skin:', error)
    } finally {
      setProcessingSkinId(null)
    }
  }

  const getRarityName = (rarity: string) => {
    const rarityNames: { [key: string]: string } = {
      common: 'Обычная',
      rare: 'Редкая',
      epic: 'Эпическая',
      legendary: 'Легендарная',
    }
    return rarityNames[rarity] || rarity
  }

  const getRarityBadgeClass = (rarity: string) => {
    return `shop-rarity-badge shop-rarity-${rarity}`
  }

  const renderSkinCard = (skin: Skin) => {
    const isOwned = ownedSkins.includes(skin.id)
    const isSelected = selectedSkinIds.has(skin.id)

    return (
      <Card key={skin.id} className="shop-skin-card">
        <div className="shop-skin-content">
          <div className="shop-skin-header">
            <div className="shop-skin-name">{skin.name}</div>
            <div className={`shop-skin-rarity ${getRarityBadgeClass(skin.rarity)}`}>
              {getRarityName(skin.rarity)}
            </div>
          </div>
          <div className="shop-skin-image">
            {skin.imageUrl ? (
              <img
                src={skin.imageUrl}
                alt={skin.name}
                className="shop-skin-img"
                onError={(e) => {
                  console.error('Failed to load skin image:', skin.imageUrl)
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                  if (placeholder && placeholder.classList.contains('shop-skin-placeholder')) {
                    placeholder.style.display = 'flex'
                  }
                }}
              />
            ) : null}
            <div className="shop-skin-placeholder" style={{ 
              display: (skin.imageUrl || 
                (skin.type === 'board' && skin.boardTextureUrl) ||
                (skin.type === 'dice' && skin.diceTextureUrl) ||
                (skin.type === 'checkers' && (skin.whiteCheckersTextureUrl || skin.blackCheckersTextureUrl || skin.checkersTextureUrl))) ? 'none' : 'flex' 
            }}>
              <div style={{ fontSize: '48px' }}>🎲</div>
            </div>
            {!isOwned && skin.price && (
              <div className="shop-skin-price-overlay">
                {skin.price.toLocaleString('ru-RU')} NAR
              </div>
            )}
          </div>
          <div className="shop-skin-actions">
            {isOwned ? (
              <Button
                variant="secondary"
                className="shop-buy-btn shop-buy-btn-purchased"
                fullWidth
                disabled
              >
                Куплено
              </Button>
            ) : (
              <Button
                variant="primary"
                className="shop-buy-btn"
                fullWidth
                onClick={() => handleBuySkin(skin.id)}
                disabled={processingSkinId !== null}
              >
                {processingSkinId === skin.id ? 'Покупка...' : 'Купить'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  const tabs = [
    { id: 'coin', label: 'NAR-coin', active: activeTab === 'coin', onClick: () => setActiveTab('coin') },
    { id: 'subscription', label: 'Подписка', active: activeTab === 'subscription', onClick: () => setActiveTab('subscription') },
    { id: 'skins', label: 'Доски', active: activeTab === 'skins', onClick: () => setActiveTab('skins') },
  ]

  return (
    <PageLayout title="Магазин" showBack={true} tabs={tabs}>
      <div className="shop-content">

        {/* NAR-coin */}
        {activeTab === 'coin' && (
          <div className="shop-list">
            {loading ? (
              <Card>
                <div className="shop-empty">Загрузка...</div>
              </Card>
            ) : (
              narCoinPackages.map((pkg) => (
                <Card key={pkg.amount} className="shop-nar-coin-card">
                  <div className="shop-nar-coin-content">
                    <div className="shop-nar-coin-info">
                      <div className="shop-nar-coin-amount">{pkg.amount.toLocaleString('ru-RU')} NAR</div>
                      <div className="shop-nar-coin-price">Цена: {pkg.price} {pkg.currency}</div>
                      <Button 
                        variant="primary" 
                        className="shop-buy-btn"
                        onClick={() => handleBuyNarCoin(pkg.amount, pkg.price)}
                        disabled={buyingNarCoinAmount !== null}
                      >
                        {buyingNarCoinAmount === pkg.amount ? 'Покупка...' : 'Купить'}
                      </Button>
                    </div>
                    <div className="shop-nar-coin-icon">
                      <img src="/img/narcoin.png" alt="coin" className="shop-nar-coin-icon-img" />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Подписка */}
        {activeTab === 'subscription' && (
          <div className="shop-list">
            <Card className="shop-subscription-card">
              <div className="shop-subscription-content">
                <div className="shop-subscription-info">
                  <div className="shop-subscription-title">Премиум доступ</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="shop-subscription-buy-btn"
                      onClick={() => handleBuySubscription('premium', 199)}
                    >
                      Купить
                    </button>
                    <button
                      className="shop-subscription-details-btn"
                      onClick={() => setShowPremiumModal(true)}
                    >
                      Подробнее
                    </button>
                  </div>
                  <div className="shop-subscription-price">от 199 руб.</div>
                </div>
                <div className="shop-subscription-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#ffd700"/>
                  </svg>
                </div>
              </div>
            </Card>

            {/* Автобилд города - отдельная карточка */}
            <Card className="shop-subscription-card shop-autobuild-card">
              <div className="shop-subscription-content">
                <div className="shop-subscription-info">
                  <div className="shop-subscription-title">Автобилд города</div>
                  <div className="shop-subscription-description" style={{ marginTop: '8px', marginBottom: '12px' }}>
                    Автоматическая покупка построек при наличии средств
                  </div>
                  {hasCityAutobuild ? (
                    <div style={{
                      padding: '8px 16px',
                      background: '#4CAF50',
                      borderRadius: '8px',
                      color: '#FFF',
                      fontSize: '14px',
                      fontWeight: '500',
                      textAlign: 'center',
                      marginTop: '8px',
                    }}>
                      ✅ Активировано
                    </div>
                  ) : (
                    <>
                      <div style={{ 
                        display: 'flex', 
                        gap: '8px', 
                        marginBottom: '12px',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          className={`shop-autobuild-payment-btn ${autobuildPaymentMethod === 'usd' ? 'active' : ''}`}
                          onClick={() => setAutobuildPaymentMethod('usd')}
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: autobuildPaymentMethod === 'usd' 
                              ? 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)' 
                              : '#3a3a3a',
                            border: autobuildPaymentMethod === 'usd' ? '2px solid #C93C3D' : '1px solid #4a4a4a',
                            color: '#FFF',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          $50 USD
                        </button>
                        <button
                          className={`shop-autobuild-payment-btn ${autobuildPaymentMethod === 'nar' ? 'active' : ''}`}
                          onClick={() => setAutobuildPaymentMethod('nar')}
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: autobuildPaymentMethod === 'nar' 
                              ? 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)' 
                              : '#3a3a3a',
                            border: autobuildPaymentMethod === 'nar' ? '2px solid #C93C3D' : '1px solid #4a4a4a',
                            color: '#FFF',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          10,000 NAR
                        </button>
                      </div>
                      <button
                        className="shop-subscription-buy-btn"
                        onClick={handlePurchaseCityAutobuild}
                        disabled={purchasingAutobuild}
                        style={{
                          opacity: purchasingAutobuild ? 0.6 : 1,
                          cursor: purchasingAutobuild ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {purchasingAutobuild ? 'Покупка...' : 'Купить навсегда'}
                      </button>
                    </>
                  )}
                </div>
                <div className="shop-subscription-icon">
                  <div style={{ fontSize: '64px' }}>🏗️</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Скины */}
        {activeTab === 'skins' && (
          <div className="shop-skins-content">
            {/* Фильтры по типам скинов */}
            <div className="shop-skin-filters">
              <button
                className={`shop-skin-filter ${skinFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSkinFilter('all')}
              >
                Все
              </button>
              <button
                className={`shop-skin-filter ${skinFilter === 'board' ? 'active' : ''}`}
                onClick={() => setSkinFilter('board')}
              >
                Доски
              </button>
              <button
                className={`shop-skin-filter ${skinFilter === 'dice' ? 'active' : ''}`}
                onClick={() => setSkinFilter('dice')}
              >
                Кубы
              </button>
              <button
                className={`shop-skin-filter ${skinFilter === 'checkers' ? 'active' : ''}`}
                onClick={() => setSkinFilter('checkers')}
              >
                Шашки
              </button>
            </div>

            {/* Отображение скинов */}
            <div className="shop-list">
              {loading ? (
                <Card>
                  <div className="shop-empty">Загрузка...</div>
                </Card>
              ) : skinFilter === 'all' ? (
                // Группировка по типам если выбран "Все"
                <>
                  {getSkinsByType('board').length > 0 && (
                    <>
                      <div className="shop-skin-group-title">Доски</div>
                      {getSkinsByType('board').map((skin) => renderSkinCard(skin))}
                    </>
                  )}
                  {getSkinsByType('dice').length > 0 && (
                    <>
                      <div className="shop-skin-group-title">Кубы</div>
                      {getSkinsByType('dice').map((skin) => renderSkinCard(skin))}
                    </>
                  )}
                  {getSkinsByType('checkers').length > 0 && (
                    <>
                      <div className="shop-skin-group-title">Шашки</div>
                      {getSkinsByType('checkers').map((skin) => renderSkinCard(skin))}
                    </>
                  )}
                  {allSkins.length === 0 && (
                    <Card>
                      <div className="shop-empty">Нет доступных скинов</div>
                    </Card>
                  )}
                </>
              ) : getFilteredSkins().length === 0 ? (
                <Card>
                  <div className="shop-empty">Нет доступных скинов</div>
                </Card>
              ) : (
                getFilteredSkins().map((skin) => renderSkinCard(skin))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Модальное окно с преимуществами премиум подписки */}
      {showPremiumModal && (
        <div className="shop-premium-modal-overlay" onClick={() => setShowPremiumModal(false)}>
          <div className="shop-premium-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shop-premium-modal-header">
              <h3 className="shop-premium-modal-title">Премиум подписка</h3>
              <button 
                className="shop-premium-modal-close"
                onClick={() => setShowPremiumModal(false)}
              >
                ×
              </button>
            </div>

            <div className="shop-premium-modal-content">
              <div className="shop-premium-modal-subtitle">
                Для тех, кто хочет играть на уровне мастеров
              </div>

              <div className="shop-premium-modal-features">
                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">📜</div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">История игр</div>
                    <div className="shop-premium-modal-feature-description">Полный список твоих матчей</div>
                  </div>
                </div>

                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">📊</div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">Анализ</div>
                    <div className="shop-premium-modal-feature-description">Разбор ошибок и лучших ходов</div>
                  </div>
                </div>

                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">🎯</div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">Тренажёр</div>
                    <div className="shop-premium-modal-feature-description">Разбирай позиции и стратегии</div>
                  </div>
                </div>

                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">⚡</div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">Приоритет</div>
                    <div className="shop-premium-modal-feature-description">Попадай к соперникам быстрее</div>
                  </div>
                </div>

                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">👑</div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">Премиум-значок</div>
                    <div className="shop-premium-modal-feature-description">Отметь свой статус в таблице</div>
                  </div>
                </div>
              </div>

              <div className="shop-premium-modal-actions">
                <button
                  className="shop-premium-modal-button"
                  onClick={() => {
                    setShowPremiumModal(false)
                    handleBuySubscription('premium', 199)
                  }}
                >
                  Оформить подписку
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}