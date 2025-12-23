import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import apiClient, { getImageUrl } from '../api/client'
import { useAuthStore } from '../store/authStore'
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

  useEffect(() => {
    loadInventory()
    loadSelectedSkins()
    loadAutobuildStatus()
    checkPremium()
  }, [])

  const loadAutobuildStatus = async () => {
    try {
      const [statusRes, settingsRes, buildingsRes] = await Promise.all([
        apiClient.get('/subscription/city-autobuild/status').catch(() => ({ data: { hasAutobuild: false } })),
        apiClient.get('/city/autobuild/settings').catch(() => ({ data: { minBalance: 0, strategy: 'balanced', priorityBuilding: null } })),
        apiClient.get('/city/buildings').catch(() => ({ data: [] })),
      ])
      
      const hasAutobuildValue = statusRes.data?.hasAutobuild || false
      setHasAutobuild(hasAutobuildValue)
      
      if (hasAutobuildValue) {
        setAutobuildSettings(settingsRes.data || { minBalance: 0, strategy: 'balanced', priorityBuilding: null })
        
        // Извлекаем список строений для выбора
        const buildingsList = (buildingsRes.data || []).map((b: any) => ({
          id: b.id,
          type: b.type,
          name: b.name,
        }))
        setBuildings(buildingsList)
      }
    } catch (error) {
      console.error('Failed to load autobuild status:', error)
    }
  }

  const checkPremium = async () => {
    try {
      const response = await apiClient.get('/subscription/status').catch(() => ({ data: { hasActive: false } }))
      setHasPremium(response.data?.hasActive || false)
    } catch (error) {
      console.error('Failed to check subscription:', error)
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
    const maxDurability = skin.maxDurability || 100
    const currentDurability = skin.currentDurability ?? maxDurability
    const durabilityPercent = Math.round((currentDurability / maxDurability) * 100)
    const needsRepair = currentDurability < maxDurability && skin.price && skin.price > 0
    const repairCost = repairCosts.get(skin.id) || 0
    
    // Используем getImageUrl для единой обработки всех путей
    const imageUrl = getImageUrl(skin.imageUrl)

    return (
      <Card key={skin.id} className="inventory-item">
        <div className="inventory-item-content">
          <div className="inventory-item-image-container">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={skin.name}
                className="inventory-item-image"
                onError={(e) => {
                  console.error('Failed to load skin image:', imageUrl)
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="inventory-item-image-placeholder">
                <div style={{ fontSize: '48px' }}>🎲</div>
              </div>
            )}
          </div>
          <div className="inventory-item-info">
            <div className="inventory-item-name">{skin.name}</div>
            <div className="inventory-item-rarity">{getRarityName(skin.rarity)}</div>
            {skin.price !== undefined && skin.price !== null && (
              <div className="inventory-item-durability">
                <div className="inventory-item-durability-label">
                  Прочность: {currentDurability} / {maxDurability}
                </div>
                <div className="inventory-item-durability-bar">
                  <div 
                    className={`inventory-item-durability-fill ${durabilityPercent < 20 ? 'low' : durabilityPercent < 50 ? 'medium' : 'high'}`}
                    style={{ width: `${durabilityPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="inventory-item-actions">
            {needsRepair && (
              <button
                className="inventory-item-button repair"
                onClick={() => handleRepairSkin(skin.id)}
                disabled={repairingSkinId === skin.id || repairingSkinId !== null}
              >
                {repairingSkinId === skin.id ? 'Ремонт...' : `Починить (${repairCost} NAR)`}
              </button>
            )}
            <button
              className={`inventory-item-button ${isSelected ? 'equipped' : 'wear'}`}
              onClick={() => !isSelected && handleSelectSkin(skin.id)}
              disabled={selectingSkinId === skin.id || selectingSkinId !== null || isSelected || currentDurability === 0}
            >
              {isSelected ? 'Экипировано' : selectingSkinId === skin.id ? 'Надевание...' : currentDurability === 0 ? 'Сломан' : 'Надеть'}
            </button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <PageLayout title="Инвентарь" showBack={true} tabs={tabs}>
      <div className="inventory-content">
        {activeTab === 'other' ? (
          <>
            {/* Подписка */}
            <Card className="inventory-other-item">
              <div className="inventory-other-header">
                <div className="inventory-other-icon">⭐</div>
                <div className="inventory-other-info">
                  <div className="inventory-other-title">Премиум подписка</div>
                  <div className="inventory-other-status">
                    {hasPremium ? (
                      <span style={{ color: '#4CAF50' }}>Активна</span>
                    ) : (
                      <span style={{ color: '#B6B6B6' }}>Неактивна</span>
                    )}
                  </div>
                </div>
              </div>
              {!hasPremium && (
                <button
                  className="inventory-item-button wear"
                  onClick={() => navigate('/subscription')}
                  style={{ marginTop: '12px' }}
                >
                  Купить подписку
                </button>
              )}
            </Card>

            {/* Настройки автобилда */}
            {hasAutobuild && (
              <Card className="inventory-autobuild-settings">
            <h3 className="inventory-autobuild-title">⚙️ Настройки автобилда города</h3>
            <div className="inventory-autobuild-content">
              <div className="inventory-autobuild-field">
                <label className="inventory-autobuild-label">Минимальный баланс (NAR):</label>
                <input
                  type="number"
                  min="0"
                  value={autobuildSettings.minBalance}
                  onChange={(e) => setAutobuildSettings({
                    ...autobuildSettings,
                    minBalance: parseInt(e.target.value) || 0,
                  })}
                  className="inventory-autobuild-input"
                  placeholder="0"
                />
                <div className="inventory-autobuild-hint">
                  Эта сумма всегда будет оставаться на балансе
                </div>
              </div>

              <div className="inventory-autobuild-field">
                <label className="inventory-autobuild-label">Стратегия прокачки:</label>
                <div className="inventory-autobuild-strategy-buttons">
                  <button
                    className={`inventory-autobuild-strategy-btn ${autobuildSettings.strategy === 'balanced' ? 'active' : ''}`}
                    onClick={() => setAutobuildSettings({
                      ...autobuildSettings,
                      strategy: 'balanced',
                      priorityBuilding: null,
                    })}
                  >
                    Равномерно
                  </button>
                  <button
                    className={`inventory-autobuild-strategy-btn ${autobuildSettings.strategy === 'priority' ? 'active' : ''}`}
                    onClick={() => setAutobuildSettings({
                      ...autobuildSettings,
                      strategy: 'priority',
                    })}
                  >
                    Приоритет строения
                  </button>
                </div>
              </div>

              {autobuildSettings.strategy === 'priority' && (
                <div className="inventory-autobuild-field">
                  <label className="inventory-autobuild-label">Приоритетное строение:</label>
                  <select
                    value={autobuildSettings.priorityBuilding || ''}
                    onChange={(e) => setAutobuildSettings({
                      ...autobuildSettings,
                      priorityBuilding: e.target.value || null,
                    })}
                    className="inventory-autobuild-select"
                  >
                    <option value="">Выберите строение</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.type}>
                        {building.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="inventory-autobuild-save-btn"
                onClick={handleSaveAutobuildSettings}
                disabled={savingSettings}
              >
                {savingSettings ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
            </div>
          </Card>
            )}
          </>
        ) : (
          <>
        {loading ? (
          <Card>
            <div className="inventory-empty">Загрузка...</div>
          </Card>
        ) : getFilteredSkins().length === 0 ? (
          <Card>
            <div className="inventory-empty">
              Инвентарь пуст. Купите скины в магазине!
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button 
                className="inventory-item-button wear"
                onClick={() => navigate('/shop')}
              >
                Перейти в магазин
              </button>
            </div>
          </Card>
        ) : (
          <div className="inventory-list">
            {getFilteredSkins().map((skin) => renderSkinCard(skin))}
          </div>
        )}
          </>
        )}
      </div>
    </PageLayout>
  )
}
