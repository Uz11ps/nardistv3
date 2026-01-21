import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import apiClient, { getImageUrl } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { StarIcon } from '../components/Icons'
import './Inventory.css'

interface Skin {
  id: string
  name: string
  description?: string
  type: string
  theme: string
  imageUrl?: string
  boardTextureUrl?: string
  diceTextureUrl?: string
  checkersTextureUrl?: string
  whiteCheckersTextureUrl?: string
  blackCheckersTextureUrl?: string
  price?: number
  rarity: string
  weight: number
  isPremium: boolean
  isDefault: boolean
  boardConfig?: any
  diceConfig?: any
  checkersConfig?: any
  maxDurability?: number
  currentDurability?: number
}

export default function Inventory() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [skins, setSkins] = useState<Skin[]>([])
  const [selectedSkinIds, setSelectedSkinIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectingSkinId, setSelectingSkinId] = useState<string | null>(null)
  const [repairingSkinId, setRepairingSkinId] = useState<string | null>(null)
  const [repairCosts, setRepairCosts] = useState<Map<string, number>>(new Map())
  const [activeTab, setActiveTab] = useState<'board' | 'checkers' | 'dice' | 'other'>('board')
  const [hasAutobuild, setHasAutobuild] = useState(false)
  const [autobuildSettings, setAutobuildSettings] = useState({
    minBalance: 0,
    strategy: 'balanced' as 'balanced' | 'priority',
    priorityBuilding: null as string | null,
  })
  const [buildings, setBuildings] = useState<Array<{ id: string; type: string; name: string }>>([])
  const [savingSettings, setSavingSettings] = useState(false)
  const [hasPremium, setHasPremium] = useState(false)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)

  useEffect(() => {
    loadInventory()
    loadSelectedSkins()
    loadAutobuildStatus()
    checkPremium()
  }, [])

  // Обновляем данные при возврате на страницу
  useEffect(() => {
    const handleFocus = () => {
      loadAutobuildStatus()
      checkPremium()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const loadAutobuildStatus = async () => {
    try {
      const [statusRes, settingsRes, buildingsRes] = await Promise.all([
        apiClient.get('/subscription/city-autobuild/status').catch(() => ({ data: { hasAutobuild: false } })),
        apiClient.get('/city/autobuild/settings').catch(() => ({ data: { minBalance: 0, strategy: 'balanced', priorityBuilding: null } })),
        apiClient.get('/city/buildings').catch(() => ({ data: [] })),
      ])
      
      // Явно проверяем, что hasAutobuild существует и равен true
      const hasAutobuildValue = statusRes.data?.hasAutobuild === true
      setHasAutobuild(hasAutobuildValue)
      console.log('Autobuild status:', hasAutobuildValue, statusRes.data)
      
      if (hasAutobuildValue) {
        setAutobuildSettings(settingsRes.data || { minBalance: 0, strategy: 'balanced', priorityBuilding: null })
        
        // Извлекаем список строений для выбора
        const buildingsList = (buildingsRes.data || []).map((b: any) => ({
          id: b.id,
          type: b.type,
          name: b.name,
        }))
        setBuildings(buildingsList)
      } else {
        // Если автобилд не активен, сбрасываем настройки
        setAutobuildSettings({ minBalance: 0, strategy: 'balanced', priorityBuilding: null })
        setBuildings([])
      }
    } catch (error) {
      console.error('Failed to load autobuild status:', error)
      // При ошибке явно устанавливаем false
      setHasAutobuild(false)
    }
  }

  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status')
      // Явно проверяем, что hasActive существует и равен true
      const hasActive = response.data?.hasActive === true
      setHasPremium(hasActive)
      setSubscriptionDetails(response.data)
      console.log('Premium status:', hasActive, response.data)
    } catch (error: any) {
      // При ошибке явно устанавливаем false
      console.error('Failed to check subscription:', error)
      setHasPremium(false)
      setSubscriptionDetails(null)
    }
  }

  const handleSaveAutobuildSettings = async () => {
    try {
      setSavingSettings(true)
      await apiClient.post('/city/autobuild/settings', {
        minBalance: autobuildSettings.minBalance,
        strategy: autobuildSettings.strategy,
        priorityBuilding: autobuildSettings.strategy === 'priority' ? autobuildSettings.priorityBuilding : null,
      })
      alert('Настройки автобилда сохранены!')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при сохранении настроек')
      console.error('Failed to save autobuild settings:', error)
    } finally {
      setSavingSettings(false)
    }
  }

  const loadInventory = async () => {
    try {
      setLoading(true)
      const [mySkinsResponse, allSkinsResponse] = await Promise.all([
        apiClient.get('/skins/my/with-durability'),
        apiClient.get('/skins'),
      ])
      
      const mySkins = mySkinsResponse.data || []
      const allSkins = allSkinsResponse.data || []
      
      const ownedSkinIds = new Set(mySkins.map((s: Skin) => s.id))
      const defaultSkins = allSkins.filter((s: Skin) => s.isDefault)
      
      // Добавляем информацию об износе для default скинов
      const defaultSkinsWithDurability = defaultSkins.map((s: Skin) => {
        const mySkin = mySkins.find((ms: Skin) => ms.id === s.id)
        return {
          ...s,
          currentDurability: mySkin?.currentDurability ?? (s.maxDurability || 100),
          maxDurability: s.maxDurability || 100,
        }
      })
      
      const allAvailableSkins = [
        ...mySkins.map((s: Skin) => ({
          ...s,
          maxDurability: s.maxDurability || 100,
          currentDurability: s.currentDurability ?? (s.maxDurability || 100),
        })),
        ...defaultSkinsWithDurability.filter((s: Skin) => !ownedSkinIds.has(s.id)),
      ]
      
      setSkins(allAvailableSkins)
      
      // Загружаем стоимость ремонта для всех скинов, которые требуют ремонта
      const repairCostsMap = new Map<string, number>()
      for (const skin of allAvailableSkins) {
        if (skin.price && skin.price > 0) {
          const maxDurability = skin.maxDurability || 100
          const currentDurability = skin.currentDurability ?? maxDurability
          if (currentDurability < maxDurability) {
            try {
              const costResponse = await apiClient.get(`/skins/${skin.id}/repair-cost`)
              repairCostsMap.set(skin.id, costResponse.data.cost || 0)
            } catch (error) {
              console.error(`Failed to load repair cost for skin ${skin.id}:`, error)
            }
          }
        }
      }
      setRepairCosts(repairCostsMap)
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedSkins = async () => {
    try {
      // Используем /skins/selected/explicit чтобы получить ТОЛЬКО явно выбранные скины
      // (без fallback на дефолтные, которые backend возвращает в /skins/selected)
      const response = await apiClient.get('/skins/selected/explicit').catch(() => {
        // Fallback на старый endpoint если новый не существует
        return apiClient.get('/skins/selected')
      })
      const selected = response.data || {}
      const selectedIds = new Set<string>()
      
      if (selected.board) selectedIds.add(selected.board.id)
      if (selected.dice) selectedIds.add(selected.dice.id)
      if (selected.checkers) selectedIds.add(selected.checkers.id)
      
      console.log('📦 Inventory - Explicitly selected skins:', {
        selected,
        selectedIds: Array.from(selectedIds),
      })
      
      setSelectedSkinIds(selectedIds)
    } catch (error) {
      console.error('Failed to load selected skins:', error)
    }
  }

  const handleSelectSkin = async (skinId: string) => {
    if (selectingSkinId !== null) return
    
    try {
      setSelectingSkinId(skinId)
      await apiClient.post('/skins/select', { skinId })
      await loadSelectedSkins()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка выбора скина')
      console.error('Failed to select skin:', error)
    } finally {
      setSelectingSkinId(null)
    }
  }

  const handleRepairSkin = async (skinId: string) => {
    if (repairingSkinId !== null) return
    
    try {
      setRepairingSkinId(skinId)
      await apiClient.post(`/skins/${skinId}/repair`)
      alert('Скин успешно отремонтирован!')
      await loadInventory()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при ремонте скина')
      console.error('Failed to repair skin:', error)
    } finally {
      setRepairingSkinId(null)
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

  const getFilteredSkins = () => {
    return skins.filter(s => {
      if (activeTab === 'board') return s.type === 'board'
      if (activeTab === 'checkers') return s.type === 'checkers'
      if (activeTab === 'dice') return s.type === 'dice'
      return false
    })
  }

  const tabs = [
    { id: 'board', label: 'Доски', active: activeTab === 'board', onClick: () => setActiveTab('board') },
    { id: 'checkers', label: 'Шашки', active: activeTab === 'checkers', onClick: () => setActiveTab('checkers') },
    { id: 'dice', label: 'Кубики', active: activeTab === 'dice', onClick: () => setActiveTab('dice') },
    { id: 'other', label: 'Прочее', active: activeTab === 'other', onClick: () => setActiveTab('other') },
  ]

  const renderSkinCard = (skin: Skin) => {
    const isSelected = selectedSkinIds.has(skin.id)
    const imageUrl = getImageUrl(skin.imageUrl)

    return (
      <div 
        key={skin.id} 
        className={`inventory-grid-card ${isSelected ? 'selected' : ''}`}
        onClick={() => !isSelected && handleSelectSkin(skin.id)}
      >
        <div className="inventory-grid-card-icon">
          {imageUrl ? (
            <img src={imageUrl} alt={skin.name} />
          ) : (
            <div className="inventory-grid-card-placeholder">🎲</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <PageLayout title="Инвентарь" showBack={true} tabs={tabs}>
      <div className="inventory-content">
        {activeTab === 'other' ? (
          /* ... existing other tab content ... */
          <div className="inventory-other-list">
            <Card className="inventory-other-item" style={{ background: 'linear-gradient(180deg, #2A2B2F 0%, #1A1B1F 100%)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div className="inventory-other-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0' }}>
                <div className="inventory-other-icon" style={{ 
                  fontSize: '24px', 
                  background: 'rgba(255, 215, 0, 0.1)', 
                  width: '48px', 
                  height: '48px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRadius: '12px',
                  color: '#FFD700'
                }}>
                  <img src="/img/crown.png" alt="premium" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <div className="inventory-other-info" style={{ flex: 1 }}>
                  <div className="inventory-other-title" style={{ fontSize: '16px', fontWeight: '600', color: '#FFF', marginBottom: '4px' }}>Премиум подписка</div>
                  <div className="inventory-other-status">
                    {hasPremium ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: '#4CAF50', fontSize: '14px', fontWeight: '500' }}>Активна</span>
                        {subscriptionDetails?.expiresAt && (
                          <span style={{ color: '#B6B6B6', fontSize: '12px' }}>
                            До {new Date(subscriptionDetails.expiresAt).toLocaleDateString('ru-RU', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#888', fontSize: '14px' }}>Неактивна</span>
                    )}
                  </div>
                </div>
              </div>
              {!hasPremium && (
                <button
                  className="inventory-item-button"
                  onClick={() => navigate('/subscription')}
                  style={{ 
                    marginTop: '16px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Купить подписку
                </button>
              )}
            </Card>
          </div>
        ) : (
          <div className="inventory-grid">
            {loading ? (
              <div className="inventory-empty">Загрузка...</div>
            ) : getFilteredSkins().length === 0 ? (
              <div className="inventory-empty">Пусто</div>
            ) : (
              getFilteredSkins().map((skin) => renderSkinCard(skin))
            )}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
