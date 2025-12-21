import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { apiClient, getImageUrl } from '../api/client'
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

  useEffect(() => {
    if (activeTab === 'coin') {
      loadNarCoinPackages()
    } else if (activeTab === 'skins') {
      loadSkins()
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
        apiClient.get('/skins/selected'),
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
    if (skinFilter === 'all') {
      return allSkins
    }
    return allSkins.filter((s: Skin) => s.type === skinFilter)
  }

  const getSkinsByType = (type: string) => {
    return allSkins.filter((s: Skin) => s.type === type)
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
      if (!skin || !skin.price) return

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
                src={getImageUrl(skin.imageUrl) || ''}
                alt={skin.name}
                className="shop-skin-img"
                onError={(e) => {
                  console.error('Failed to load skin image:', skin.imageUrl, 'Resolved URL:', getImageUrl(skin.imageUrl))
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                  if (placeholder && placeholder.classList.contains('shop-skin-placeholder')) {
                    placeholder.style.display = 'flex'
                  }
                }}
              />
            ) : null}
            <div className="shop-skin-placeholder" style={{ display: skin.imageUrl ? 'none' : 'flex' }}>
              <Icon 
                name={skin.type === 'board' ? 'board' : skin.type === 'dice' ? 'dice' : 'target'} 
                size={48} 
              />
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

  return (
    <div className="app-container">
      <PageHeader title="Магазин" />
      
      <div className="shop-content">
        {/* Листабельные вкладки */}
        <div className="shop-tabs-container">
          <div className="shop-tabs">
            <button
              className={`shop-tab ${activeTab === 'coin' ? 'active' : ''}`}
              onClick={() => setActiveTab('coin')}
            >
              NAR-coin
            </button>
            <button
              className={`shop-tab ${activeTab === 'subscription' ? 'active' : ''}`}
              onClick={() => setActiveTab('subscription')}
            >
              Подписка
            </button>
            <button
              className={`shop-tab ${activeTab === 'skins' ? 'active' : ''}`}
              onClick={() => setActiveTab('skins')}
            >
              Скины
            </button>
          </div>
        </div>

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
                      <Icon name="coin" size={80} style={{ filter: 'drop-shadow(0 0 12px rgba(255, 215, 0, 0.6))' }} />
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
                </div>
                <div className="shop-subscription-icon">
                  <Icon name="crown" size={80} style={{ color: '#ffd700' }} />
                </div>
                <Button
                  variant="primary"
                  className="shop-buy-btn"
                  onClick={() => navigate('/subscription')}
                >
                  Купить
                </Button>
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
    </div>
  )
}