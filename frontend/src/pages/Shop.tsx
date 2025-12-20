import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
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
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'coin' | 'subscription' | 'board' | 'dice' | 'checkers'>('coin')
  const [narCoinPackages, setNarCoinPackages] = useState<NarCoinPackage[]>([])
  const [skins, setSkins] = useState<Skin[]>([])
  const [ownedSkins, setOwnedSkins] = useState<string[]>([])
  const [selectedSkinIds, setSelectedSkinIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (activeTab === 'coin') {
      loadNarCoinPackages()
    } else if (['board', 'dice', 'checkers'].includes(activeTab)) {
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
        checkers: 'checkers',
      }
      const filteredSkins = allSkins.filter((s: Skin) => s.type === typeMap[activeTab])

      setSkins(filteredSkins)
      setOwnedSkins([...mySkins.map((s: Skin) => s.id), ...allSkins.filter((s: Skin) => s.isDefault).map((s: Skin) => s.id)])
      
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
      common: 'Обычный',
      rare: 'Редкий',
      epic: 'Эпический',
      legendary: 'Легендарный',
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
              Куб
            </button>
            <button
              className={`shop-tab ${activeTab === 'checkers' ? 'active' : ''}`}
              onClick={() => setActiveTab('checkers')}
            >
              Шашки
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
                      <div className="shop-nar-coin-amount">{pkg.amount.toLocaleString()} NAR</div>
                      <div className="shop-nar-coin-price">Цена: {pkg.price} {pkg.currency}</div>
                    </div>
                    <div className="shop-nar-coin-icon">
                      <Icon name="coin" size={64} style={{ color: '#ffd700' }} />
                    </div>
                    <Button 
                      variant="primary" 
                      className="shop-buy-btn"
                      onClick={() => handleBuyNarCoin(pkg.amount, pkg.price)}
                    >
                      Купить
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Подписка */}
        {activeTab === 'subscription' && (
          <div className="shop-list">
            <Card>
              <div className="shop-subscription-info">
                <div className="shop-subscription-title">Подписка</div>
                <div className="shop-subscription-subtitle">Для тех, кто хочет играть на уровне мастеров</div>
              </div>
            </Card>
            {/* TODO: загрузить планы подписки с сервера */}
            <Card>
              <div className="shop-subscription-feature">
                <div className="shop-subscription-feature-title">История игр</div>
                <div className="shop-subscription-feature-subtitle">Полный список твоих матчей</div>
              </div>
            </Card>
            <Card>
              <div className="shop-subscription-feature">
                <div className="shop-subscription-feature-title">Анализ</div>
                <div className="shop-subscription-feature-subtitle">Разбор ошибок и лучших ходов</div>
              </div>
            </Card>
            <Card>
              <div className="shop-subscription-feature">
                <div className="shop-subscription-feature-title">Тренажёр</div>
                <div className="shop-subscription-feature-subtitle">Разбирай позиции и стратегии</div>
              </div>
            </Card>
            <Card>
              <div className="shop-subscription-feature">
                <div className="shop-subscription-feature-title">Приоритет</div>
                <div className="shop-subscription-feature-subtitle">Попадай к соперникам быстрее</div>
              </div>
            </Card>
            <Card>
              <div className="shop-subscription-feature">
                <div className="shop-subscription-feature-title">Премиум-значок</div>
                <div className="shop-subscription-feature-subtitle">Отметь свой статус в таблице</div>
              </div>
            </Card>
          </div>
        )}

        {/* Скины (Доски, Кости, Шашки) */}
        {['board', 'dice', 'checkers'].includes(activeTab) && (
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
                      <div className="shop-skin-image">
                        {skin.imageUrl ? (
                          <img
                            src={skin.imageUrl}
                            alt={skin.name}
                            className="shop-skin-img"
                          />
                        ) : (
                          <Icon 
                            name={skin.type === 'board' ? 'board' : skin.type === 'dice' ? 'dice' : 'target'} 
                            size={64} 
                          />
                        )}
                        {isSelected && (
                          <div className="shop-skin-selected">
                            <Icon name="check" size={16} />
                          </div>
                        )}
                      </div>
                      <div className="shop-skin-info">
                        <div className="shop-skin-header">
                          <div className="shop-skin-name">{skin.name}</div>
                          <span className={getRarityBadgeClass(skin.rarity)}>
                            {getRarityName(skin.rarity)}
                          </span>
                        </div>
                        {skin.description && (
                          <div className="shop-skin-description">{skin.description}</div>
                        )}
                        {!isOwned && skin.price && (
                          <div className="shop-skin-price gold">{skin.price} NAR</div>
                        )}
                        {isSelected && (
                          <div className="shop-skin-selected-label">Выбрано</div>
                        )}
                      </div>
                      {isOwned ? (
                        <Button
                          variant={isSelected ? 'primary' : 'secondary'}
                          className="shop-buy-btn"
                          onClick={() => handleSelectSkin(skin.id)}
                        >
                          {isSelected ? 'Выбрано' : 'Выбрать'}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          className="shop-buy-btn"
                          onClick={() => handleBuySkin(skin.id)}
                        >
                          Купить
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}