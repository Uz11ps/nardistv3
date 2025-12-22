import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Card from '../components/Card'
import { apiClient } from '../api/client'
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
}

export default function Inventory() {
  const navigate = useNavigate()
  const [skins, setSkins] = useState<Skin[]>([])
  const [selectedSkinIds, setSelectedSkinIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectingSkinId, setSelectingSkinId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'board' | 'checkers' | 'dice'>('board')

  useEffect(() => {
    loadInventory()
    loadSelectedSkins()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      const [mySkinsResponse, allSkinsResponse] = await Promise.all([
        apiClient.get('/skins/my'),
        apiClient.get('/skins'),
      ])
      
      const mySkins = mySkinsResponse.data || []
      const allSkins = allSkinsResponse.data || []
      
      const ownedSkinIds = new Set(mySkins.map((s: Skin) => s.id))
      const defaultSkins = allSkins.filter((s: Skin) => s.isDefault)
      
      const allAvailableSkins = [
        ...mySkins,
        ...defaultSkins.filter((s: Skin) => !ownedSkinIds.has(s.id)),
      ]
      
      setSkins(allAvailableSkins)
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedSkins = async () => {
    try {
      const response = await apiClient.get('/skins/selected')
      const selected = response.data || {}
      const selectedIds = new Set<string>()
      
      if (selected.board) selectedIds.add(selected.board.id)
      if (selected.dice) selectedIds.add(selected.dice.id)
      if (selected.checkers) selectedIds.add(selected.checkers.id)
      
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
  ]

  const renderSkinCard = (skin: Skin) => {
    const isSelected = selectedSkinIds.has(skin.id)
    const defaultBoardImage = '/img/3a87c78273c1488e736bcebbfc6ea74f1dc383a7.png'

    return (
      <Card key={skin.id} className="inventory-item">
        <div className="inventory-item-content">
          <div className="inventory-item-image-container">
            {skin.imageUrl || (skin.type === 'board' && defaultBoardImage) ? (
              <img
                src={skin.imageUrl || defaultBoardImage}
                alt={skin.name}
                className="inventory-item-image"
                onError={(e) => {
                  console.error('Failed to load skin image:', skin.imageUrl)
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
          </div>
          <button
            className={`inventory-item-button ${isSelected ? 'equipped' : 'wear'}`}
            onClick={() => !isSelected && handleSelectSkin(skin.id)}
            disabled={selectingSkinId === skin.id || selectingSkinId !== null || isSelected}
          >
            {isSelected ? 'Экипировано' : selectingSkinId === skin.id ? 'Надевание...' : 'Надеть'}
          </button>
        </div>
      </Card>
    )
  }

  return (
    <PageLayout title="Инвентарь" showBack={true} tabs={tabs}>
      <div className="inventory-content">
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
      </div>
    </PageLayout>
  )
}
