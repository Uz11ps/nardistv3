import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { apiClient, getImageUrl } from '../api/client'
import './Inventory.css'

interface Skin {
  id: string
  name: string
  description?: string
  type: string
  theme: string
  imageUrl?: string
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

  useEffect(() => {
    loadInventory()
    loadSelectedSkins()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      // Загружаем как купленные скины, так и дефолтные скины
      const [mySkinsResponse, allSkinsResponse] = await Promise.all([
        apiClient.get('/skins/my'),
        apiClient.get('/skins'),
      ])
      
      const mySkins = mySkinsResponse.data || []
      const allSkins = allSkinsResponse.data || []
      
      // Получаем ID купленных скинов
      const ownedSkinIds = new Set(mySkins.map((s: Skin) => s.id))
      
      // Добавляем дефолтные скины (они доступны всем бесплатно)
      const defaultSkins = allSkins.filter((s: Skin) => s.isDefault)
      
      // Объединяем купленные и дефолтные скины, избегая дубликатов
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
    if (selectingSkinId !== null) return // Защита от повторных запросов
    
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
      common: 'Обычный',
      rare: 'Редкий',
      epic: 'Эпический',
      legendary: 'Легендарный',
    }
    return rarityNames[rarity] || rarity
  }

  const getTypeName = (type: string) => {
    const typeNames: { [key: string]: string } = {
      board: 'Доска',
      dice: 'Кости',
      checkers: 'Шашки',
    }
    return typeNames[type] || type
  }

  const getRarityBadgeClass = (rarity: string) => {
    return `inventory-rarity-badge inventory-rarity-${rarity}`
  }

  // Группируем скины по типу
  const groupedSkins = {
    board: skins.filter(s => s.type === 'board'),
    dice: skins.filter(s => s.type === 'dice'),
    checkers: skins.filter(s => s.type === 'checkers'),
  }

  return (
    <div className="app-container">
      <PageHeader title="Инвентарь" />
      
      <div className="inventory-content">
        {loading ? (
          <Card>
            <div className="inventory-empty">Загрузка...</div>
          </Card>
        ) : skins.length === 0 ? (
          <Card>
            <div className="inventory-empty">
              Инвентарь пуст. Купите скины в магазине!
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/shop')}
              >
                Перейти в магазин
              </button>
            </div>
          </Card>
        ) : (
          <div className="inventory-list">
            {/* Доски */}
            {groupedSkins.board.length > 0 && (
              <div className="inventory-section">
                <div className="inventory-section-title">Доски</div>
                {groupedSkins.board.map((skin) => (
                  <Card key={skin.id} className="inventory-item">
                    <div className="inventory-item-content">
                      <div className="inventory-item-image">
                        {skin.imageUrl ? (
                          <img
                            src={getImageUrl(skin.imageUrl) || ''}
                            alt={skin.name}
                            className="inventory-image"
                            onError={(e) => {
                              console.error('Failed to load skin image:', skin.imageUrl)
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Icon name={skin.type === 'board' ? 'board' : skin.type === 'dice' ? 'dice' : 'target'} size={48} />
                        )}
                        {selectedSkinIds.has(skin.id) && (
                          <div className="inventory-item-selected">
                            <Icon name="check" size={16} />
                          </div>
                        )}
                      </div>
                      <div className="inventory-item-info">
                        <div className="inventory-item-header">
                          <div className="inventory-item-name">{skin.name}</div>
                          <span className={getRarityBadgeClass(skin.rarity)}>
                            {getRarityName(skin.rarity)}
                          </span>
                        </div>
                        <div className="inventory-item-meta">
                          <span className="inventory-item-type">{getTypeName(skin.type)}</span>
                          <span className="inventory-item-weight">Вес: {skin.weight}</span>
                        </div>
                        {skin.description && (
                          <div className="inventory-item-description">{skin.description}</div>
                        )}
                      </div>
                      {!selectedSkinIds.has(skin.id) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSelectSkin(skin.id)}
                          disabled={selectingSkinId === skin.id || selectingSkinId !== null}
                        >
                          {selectingSkinId === skin.id ? 'Выбор...' : 'Выбрать'}
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Кости */}
            {groupedSkins.dice.length > 0 && (
              <div className="inventory-section">
                <div className="inventory-section-title">Кости</div>
                {groupedSkins.dice.map((skin) => (
                  <Card key={skin.id} className="inventory-item">
                    <div className="inventory-item-content">
                      <div className="inventory-item-image">
                        {skin.imageUrl ? (
                          <img
                            src={getImageUrl(skin.imageUrl)}
                            alt={skin.name}
                            className="inventory-image"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Icon name="dice" size={48} />
                        )}
                        {selectedSkinIds.has(skin.id) && (
                          <div className="inventory-item-selected">
                            <Icon name="check" size={16} />
                          </div>
                        )}
                      </div>
                      <div className="inventory-item-info">
                        <div className="inventory-item-header">
                          <div className="inventory-item-name">{skin.name}</div>
                          <span className={getRarityBadgeClass(skin.rarity)}>
                            {getRarityName(skin.rarity)}
                          </span>
                        </div>
                        <div className="inventory-item-meta">
                          <span className="inventory-item-type">{getTypeName(skin.type)}</span>
                          <span className="inventory-item-weight">Вес: {skin.weight}</span>
                        </div>
                        {skin.description && (
                          <div className="inventory-item-description">{skin.description}</div>
                        )}
                      </div>
                      {!selectedSkinIds.has(skin.id) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSelectSkin(skin.id)}
                          disabled={selectingSkinId === skin.id || selectingSkinId !== null}
                        >
                          {selectingSkinId === skin.id ? 'Выбор...' : 'Выбрать'}
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Шашки */}
            {groupedSkins.checkers.length > 0 && (
              <div className="inventory-section">
                <div className="inventory-section-title">Шашки</div>
                {groupedSkins.checkers.map((skin) => (
                  <Card key={skin.id} className="inventory-item">
                    <div className="inventory-item-content">
                      <div className="inventory-item-image">
                        {skin.imageUrl ? (
                          <img
                            src={getImageUrl(skin.imageUrl)}
                            alt={skin.name}
                            className="inventory-image"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Icon name="target" size={48} />
                        )}
                        {selectedSkinIds.has(skin.id) && (
                          <div className="inventory-item-selected">
                            <Icon name="check" size={16} />
                          </div>
                        )}
                      </div>
                      <div className="inventory-item-info">
                        <div className="inventory-item-header">
                          <div className="inventory-item-name">{skin.name}</div>
                          <span className={getRarityBadgeClass(skin.rarity)}>
                            {getRarityName(skin.rarity)}
                          </span>
                        </div>
                        <div className="inventory-item-meta">
                          <span className="inventory-item-type">{getTypeName(skin.type)}</span>
                          <span className="inventory-item-weight">Вес: {skin.weight}</span>
                        </div>
                        {skin.description && (
                          <div className="inventory-item-description">{skin.description}</div>
                        )}
                      </div>
                      {!selectedSkinIds.has(skin.id) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSelectSkin(skin.id)}
                          disabled={selectingSkinId === skin.id || selectingSkinId !== null}
                        >
                          {selectingSkinId === skin.id ? 'Выбор...' : 'Выбрать'}
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}