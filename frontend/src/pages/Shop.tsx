import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import Icon from '../components/Icon'
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
  const [activeTab, setActiveTab] = useState<'coin' | 'subscription' | 'board' | 'dice'>('coin')
  const [narCoinPackages, setNarCoinPackages] = useState<NarCoinPackage[]>([])
  const [skins, setSkins] = useState<Skin[]>([])
  const [ownedSkins, setOwnedSkins] = useState<string[]>([])
  const [selectedSkinIds, setSelectedSkinIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (activeTab === 'coin') {
      loadNarCoinPackages()
    } else if (['board', 'dice'].includes(activeTab)) {
      loadSkins()
    }
  }, [activeTab])

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

      const allSkins = allSkinsResponse.data || []
      const mySkins = mySkinsResponse.data || []
      const selected = selectedSkinResponse.data || {}

      // Фильтруем скины по типу активной вкладки
      const typeMap: { [key: string]: string } = {
        board: 'board',
        dice: 'dice',
      }
      const filteredSkins = allSkins.filter((s: Skin) => s.type === typeMap[activeTab])

      setSkins(filteredSkins)
      setOwnedSkins([...mySkins.map((s: Skin) => s.id), ...allSkins.filter((s: Skin) => s.isDefault).map((s: Skin) => s.id)])
      
      const selectedIds = new Set<string>()
      if (selected.board) selectedIds.add(selected.board.id)
      if (selected.dice) selectedIds.add(selected.dice.id)
      setSelectedSkinIds(selectedIds)
    } catch (error) {
      console.error('Failed to load skins:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBuyNarCoin = async (amount: number, price: number) => {
    try {
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
    }
  }

  const handleBuySkin = async (skinId: string) => {
    try {
      const skin = skins.find((s) => s.id === skinId)
      if (!skin || !skin.price) return

      await apiClient.post('/skins/purchase', { skinId })
      alert(`Скин "${skin.name}" успешно куплен!`)
      await loadSkins()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при покупке скина')
      console.error('Purchase failed:', error)
    }
  }

  const handleSelectSkin = async (skinId: string) => {
    try {
      await apiClient.post('/skins/select', { skinId })
      await loadSkins()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при выборе скина')
      console.error('Failed to select skin:', error)
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
              className={`shop-tab ${activeTab === 'board' ? 'active' : ''}`}
              onClick={() => setActiveTab('board')}
            >
              Доски
            </button>
            <button
              className={`shop-tab ${activeTab === 'dice' ? 'active' : ''}`}
              onClick={() => setActiveTab('dice')}
            >
              Кубы
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
                      >
                        Купить
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

        {/* Скины (Доски, Кубы) */}
        {['board', 'dice'].includes(activeTab) && (
          <div className="shop-list">
            {loading ? (
              <Card>
                <div className="shop-empty">Загрузка...</div>
              </Card>
            ) : skins.length === 0 ? (
              <Card>
                <div className="shop-empty">Нет доступных скинов</div>
              </Card>
            ) : (
              skins.map((skin) => {
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
                          />
                        ) : (
                          <div className="shop-skin-placeholder">
                            <Icon 
                              name={skin.type === 'board' ? 'board' : 'dice'} 
                              size={48} 
                            />
                          </div>
                        )}
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
                          >
                            Купить
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}