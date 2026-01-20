import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import Button from '../components/Button'
import apiClient, { getImageUrl } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Skin } from '../types/skin'
import { StarIcon, TargetIcon, EnergyIcon, CrownIcon } from '../components/Icons'
import './Shop.css'

interface NarCoinPackage {
  amount: number
  price: number
  priceTon?: number
  priceUsdt?: number
  currency: string
}

interface ShopBarInfo {
  energy: {
    amount: number
    costNar: number
    current: number
    max: number
  }
  lives: {
    amount: number
    costNar: number
    current: number
    max: number
  }
  license: {
    requiredLevel: number
    costNar: number
    hasLicense: boolean
    level: number
  }
}

export default function Shop() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'coin' | 'subscription' | 'skins' | 'bar'>('coin')
  const [skinFilter, setSkinFilter] = useState<'all' | 'board' | 'dice' | 'checkers'>('all')
  const [narCoinPackages, setNarCoinPackages] = useState<NarCoinPackage[]>([])
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const [ownedSkins, setOwnedSkins] = useState<string[]>([])
  const [selectedSkinIds, setSelectedSkinIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processingSkinId, setProcessingSkinId] = useState<string | null>(null)
  const [buyingNarCoinAmount, setBuyingNarCoinAmount] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'TRIBUTE' | 'STARS'>('TRIBUTE')
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [showSkinPreview, setShowSkinPreview] = useState(false)
  const [previewSkin, setPreviewSkin] = useState<Skin | null>(null)
  const [shopBarInfo, setShopBarInfo] = useState<ShopBarInfo | null>(null)

  // Инициализация активной вкладки из navigation state (например, из города -> "бар")
  useEffect(() => {
    const state = location.state as { tab?: string } | null
    if (state?.tab === 'bar') {
      setActiveTab('bar')
    }
  }, [location.state])

  useEffect(() => {
    if (activeTab === 'coin') {
      loadNarCoinPackages()
    } else if (activeTab === 'skins') {
      loadSkins()
    } else if (activeTab === 'bar') {
      loadShopBar()
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
      // Загружаем пакеты NAR-coin с сервера с учетом выбранного метода оплаты
      const response = await apiClient.get(`/subscription/nar-coin-packages?method=${paymentMethod}`)
      setNarCoinPackages(response.data || [])
    } catch (error) {
      console.error('Failed to load NAR-coin packages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'coin') {
      loadNarCoinPackages()
    }
  }, [paymentMethod])

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

  const loadShopBar = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/progress/shop-bar')
      setShopBarInfo(response.data || null)
    } catch (error) {
      console.error('Failed to load shop bar info:', error)
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

  const handleBuySubscription = () => {
    // Перенаправляем на страницу подписки, где пользователь сможет выбрать длительность
    navigate('/subscription')
  }

  const handleBuyNarCoin = async (amount: number, price: number) => {
    if (buyingNarCoinAmount !== null) return // Защита от повторных запросов
    
    try {
      setBuyingNarCoinAmount(amount)
      // Создаем платежную транзакцию для покупки NAR-coin
      // amount - количество NAR из пакета
      // price - цена в TON/USDT из пакета
      const response = await apiClient.post('/subscription/nar-coin/payment/create', {
        amount: amount, // количество NAR из пакета
        price: price, // цена в TON/USDT из пакета
        method: paymentMethod,
      })
      
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
          setBuyingNarCoinAmount(null)
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
        
        setBuyingNarCoinAmount(null)
        return
      }
      
      throw new Error('Неизвестный метод оплаты')
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Ошибка при создании платежа')
      console.error('Purchase failed:', error)
    } finally {
      setBuyingNarCoinAmount(null)
    }
  }

  const handlePaymentSuccess = async () => {
    // Обновляем баланс пользователя после успешной оплаты
    try {
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
      alert('Покупка успешна!')
      await loadNarCoinPackages()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const handleBuyEnergy = async () => {
    try {
      await apiClient.post('/progress/energy/buy')
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
      await loadShopBar()
      alert('Энергия куплена')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка покупки энергии')
      console.error('Buy energy failed:', error)
    }
  }

  const handleBuyLives = async () => {
    try {
      await apiClient.post('/progress/lives/buy')
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
      await loadShopBar()
      alert('Жизни куплены')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка покупки жизней')
      console.error('Buy lives failed:', error)
    }
  }

  const handleBuyBusinessLicense = async () => {
    try {
      await apiClient.post('/progress/business-license/buy')
      const userResponse = await apiClient.get('/users/me')
      useAuthStore.setState({ user: userResponse.data })
      await loadShopBar()
      alert('Лицензия предпринимателя приобретена')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка покупки лицензии')
      console.error('Buy license failed:', error)
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
          {/* Заголовок - название и редкость вверху слева */}
          <div className="shop-skin-header">
            <div className="shop-skin-name-group">
              <div className="shop-skin-name">{skin.name}</div>
              <div className="shop-skin-stats-inline">
                <span className="shop-skin-stat-item">⚖️ {skin.weight || 0}</span>
                {skin.xpBonusPercent > 0 && <span className="shop-skin-stat-item bonus-xp">+{skin.xpBonusPercent}% XP</span>}
                {skin.moneyBonusPercent > 0 && <span className="shop-skin-stat-item bonus-money">+{skin.moneyBonusPercent}% NAR</span>}
              </div>
            </div>
            <div className={`shop-skin-rarity ${getRarityBadgeClass(skin.rarity)}`}>
              {getRarityName(skin.rarity)}
            </div>
          </div>

          {/* Изображение по центру */}
          <div className="shop-skin-image" onClick={() => {
            setPreviewSkin(skin)
            setShowSkinPreview(true)
          }}>
            {(skin.shopImageUrl || skin.imageUrl) ? (
              <img
                src={getImageUrl(skin.shopImageUrl || skin.imageUrl) || (skin.shopImageUrl || skin.imageUrl)}
                alt={skin.name}
                className="shop-skin-img"
                onError={(e) => {
                  console.error('Failed to load skin image:', skin.shopImageUrl || skin.imageUrl)
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
            <div className="shop-skin-preview-hint">Нажмите для предпросмотра</div>
          </div>

          {/* Футер - цена справа и кнопка по центру */}
          <div className="shop-skin-footer">
            {!isOwned && skin.price && (
              <div className="shop-skin-price">
                {skin.price.toLocaleString('ru-RU')} NAR
              </div>
            )}
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
                  onClick={() => {
                    setPreviewSkin(skin)
                    setShowSkinPreview(true)
                  }}
                  disabled={processingSkinId !== null}
                >
                  {processingSkinId === skin.id ? 'Покупка...' : 'Купить'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const tabs = [
    { id: 'coin', label: 'NAR-coin', active: activeTab === 'coin', onClick: () => setActiveTab('coin') },
    { id: 'bar', label: 'Бар', active: activeTab === 'bar', onClick: () => setActiveTab('bar') },
    { id: 'subscription', label: 'Подписка', active: activeTab === 'subscription', onClick: () => setActiveTab('subscription') },
    { id: 'skins', label: 'Скины', active: activeTab === 'skins', onClick: () => setActiveTab('skins') },
  ]

  return (
    <PageLayout title="Магазин" showBack={true} tabs={tabs}>
      <div className="shop-content">

        {/* NAR-coin */}
        {activeTab === 'coin' && (
          <>
            {/* Выбор метода оплаты */}
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '16px'
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
                Tribute <StarIcon size={16} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
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
                Stars <StarIcon size={16} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
              </button>
            </div>

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
          </>
        )}

        {/* Бар нардистов */}
        {activeTab === 'bar' && (
          <div className="shop-list">
            {/* Энергия */}
            <Card className="shop-nar-coin-card">
              <div className="shop-nar-coin-content">
                <div className="shop-nar-coin-info">
                  <div className="shop-nar-coin-amount">Энергия</div>
                  {shopBarInfo && (
                    <div className="shop-nar-coin-price">
                      +{shopBarInfo.energy.amount} энергии · сейчас {shopBarInfo.energy.current}/{shopBarInfo.energy.max}
                    </div>
                  )}
                  {shopBarInfo && (
                    <div className="shop-nar-coin-price" style={{ color: '#ffd700', fontWeight: '600' }}>
                      Цена: {shopBarInfo.energy.costNar.toLocaleString('ru-RU')} NAR
                    </div>
                  )}
                  <Button
                    variant="primary"
                    className="shop-buy-btn"
                    onClick={handleBuyEnergy}
                    disabled={loading || (shopBarInfo ? shopBarInfo.energy.current >= shopBarInfo.energy.max : false)}
                  >
                    Купить энергию
                  </Button>
                </div>
              </div>
            </Card>

            {/* Жизни */}
            <Card className="shop-nar-coin-card">
              <div className="shop-nar-coin-content">
                <div className="shop-nar-coin-info">
                  <div className="shop-nar-coin-amount">Жизни</div>
                  {shopBarInfo && (
                    <div className="shop-nar-coin-price">
                      +{shopBarInfo.lives.amount} жизней · сейчас {shopBarInfo.lives.current}/{shopBarInfo.lives.max}
                    </div>
                  )}
                  {shopBarInfo && (
                    <div className="shop-nar-coin-price" style={{ color: '#ffd700', fontWeight: '600' }}>
                      Цена: {shopBarInfo.lives.costNar.toLocaleString('ru-RU')} NAR
                    </div>
                  )}
                  <Button
                    variant="primary"
                    className="shop-buy-btn"
                    onClick={handleBuyLives}
                    disabled={loading || (shopBarInfo ? shopBarInfo.lives.current >= shopBarInfo.lives.max : false)}
                  >
                    Купить жизни
                  </Button>
                </div>
              </div>
            </Card>

            {/* Лицензия предпринимателя */}
            <Card className="shop-nar-coin-card">
              <div className="shop-nar-coin-content">
                <div className="shop-nar-coin-info">
                  <div className="shop-nar-coin-amount">Лицензия предпринимателя</div>
                  {shopBarInfo && (
                    <div className="shop-nar-coin-price">
                      Доступно с {shopBarInfo.license.requiredLevel} уровня · сейчас уровень {shopBarInfo.license.level}
                    </div>
                  )}
                  {shopBarInfo && (
                    <div className="shop-nar-coin-price" style={{ color: '#ffd700', fontWeight: '600' }}>
                      Цена: {shopBarInfo.license.costNar.toLocaleString('ru-RU')} NAR
                    </div>
                  )}
                  <Button
                    variant="primary"
                    className="shop-buy-btn"
                    onClick={handleBuyBusinessLicense}
                    disabled={
                      loading ||
                      (shopBarInfo
                        ? shopBarInfo.license.hasLicense || shopBarInfo.license.level < shopBarInfo.license.requiredLevel
                        : false)
                    }
                  >
                    {shopBarInfo?.license.hasLicense ? 'Уже куплена' : 'Купить лицензию'}
                  </Button>
                </div>
              </div>
            </Card>
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
                      onClick={handleBuySubscription}
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
                Скины
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
                      <div className="shop-skin-group-title">Скины</div>
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
      {showPremiumModal && createPortal(
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
                  <div className="shop-premium-modal-feature-icon">
                    <TargetIcon size={32} style={{ color: '#FFF' }} />
                  </div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">Тренажёр</div>
                    <div className="shop-premium-modal-feature-description">Разбирай позиции и стратегии</div>
                  </div>
                </div>

                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">
                    <EnergyIcon size={32} style={{ color: '#FFF' }} />
                  </div>
                  <div className="shop-premium-modal-feature-info">
                    <div className="shop-premium-modal-feature-title">Приоритет</div>
                    <div className="shop-premium-modal-feature-description">Попадай к соперникам быстрее</div>
                  </div>
                </div>

                <div className="shop-premium-modal-feature">
                  <div className="shop-premium-modal-feature-icon">
                    <CrownIcon size={32} style={{ color: '#FFF' }} />
                  </div>
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
                        navigate('/subscription')
                      }}
                    >
                      Оформить подписку
                    </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Предпросмотр скина */}
      {showSkinPreview && previewSkin && createPortal(
        <div className="shop-skin-preview-modal-overlay" onClick={() => setShowSkinPreview(false)}>
          <div className="shop-skin-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3>Предпросмотр: {previewSkin.name}</h3>
              <button className="close-btn" onClick={() => setShowSkinPreview(false)}>×</button>
            </div>
            
            <div className="preview-modal-body">
              <div className="preview-image-container">
                <img 
                  src={getImageUrl(previewSkin.shopImageUrl || previewSkin.imageUrl) || (previewSkin.shopImageUrl || previewSkin.imageUrl)} 
                  alt={previewSkin.name} 
                />
              </div>
              
              <div className="preview-info">
                <div className="preview-rarity-badge">
                  <span className={`badge ${previewSkin.rarity}`}>{getRarityName(previewSkin.rarity)}</span>
                </div>
                <div className="preview-stats">
                  <div className="preview-stat">
                    <span className="label">Вес:</span>
                    <span className="value">⚖️ {previewSkin.weight || 0} ед.</span>
                  </div>
                  {previewSkin.xpBonusPercent > 0 && (
                    <div className="preview-stat">
                      <span className="label">Бонус XP:</span>
                      <span className="value" style={{ color: '#4caf50' }}>+{previewSkin.xpBonusPercent}%</span>
                    </div>
                  )}
                  {previewSkin.moneyBonusPercent > 0 && (
                    <div className="preview-stat">
                      <span className="label">Бонус NAR:</span>
                      <span className="value" style={{ color: '#f59e0b' }}>+{previewSkin.moneyBonusPercent}%</span>
                    </div>
                  )}
                  <div className="preview-stat">
                    <span className="label">Прочность:</span>
                    <span className="value">🛠️ {previewSkin.maxDurability || 100}</span>
                  </div>
                  {previewSkin.type === 'board' && (
                    <div className="preview-stat">
                      <span className="label">Тип:</span>
                      <span className="value">Игровая доска</span>
                    </div>
                  )}
                </div>
                <p className="preview-description">{previewSkin.description || 'Нет описания для этого предмета.'}</p>
              </div>
            </div>

            <div className="preview-modal-footer">
              {!ownedSkins.includes(previewSkin.id) ? (
                <Button 
                  variant="primary" 
                  fullWidth 
                  onClick={() => {
                    handleBuySkin(previewSkin.id)
                    setShowSkinPreview(false)
                  }}
                >
                  Купить за {previewSkin.price?.toLocaleString()} NAR
                </Button>
              ) : (
                <Button variant="secondary" fullWidth disabled>Уже в коллекции</Button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}