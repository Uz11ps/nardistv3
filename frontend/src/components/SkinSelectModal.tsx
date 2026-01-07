import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiClient, getImageUrl } from '../api/client'
import Card from './Card'
import Button from './Button'
import { Skin } from '../types/skin'

interface SkinSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (skinId: string) => void
  selectedSkinId?: string
  ownedSkins?: string[]
}

export default function SkinSelectModal({
  isOpen,
  onClose,
  onSelect,
  selectedSkinId,
  ownedSkins = [],
}: SkinSelectModalProps) {
  const [skins, setSkins] = useState<Skin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadSkins()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.height = '100%'
      
      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.height = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  const loadSkins = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/skins')
      setSkins(response.data || [])
    } catch (error) {
      console.error('Failed to load skins:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (skinId: string) => {
    onSelect(skinId)
    onClose()
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

  if (!isOpen) return null

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: '0px',
    left: '0px',
    right: '0px',
    bottom: '0px',
    width: '100vw',
    height: '100vh',
    minWidth: '100vw',
    minHeight: '100vh',
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647,
    padding: '12px',
    margin: '0',
    border: 'none',
    outline: 'none',
    touchAction: 'none',
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={overlayStyle}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{
          position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
          padding: '20px', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
          width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
        }}
      >
        <div className="modal-title">Выберите скин</div>
        <div className="modal-description">Выберите дизайн доски для игры</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Загрузка...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginTop: '20px' }}>
            {skins.map((skin) => {
              const isOwned = ownedSkins.includes(skin.id) || skin.isDefault
              const isSelected = selectedSkinId === skin.id
              const canSelect = isOwned

              return (
                <Card
                  key={skin.id}
                  style={{
                    padding: '12px',
                    cursor: canSelect ? 'pointer' : 'not-allowed',
                    border: isSelected ? '2px solid #ff3333' : '1px solid #3a3a3a',
                    opacity: canSelect ? 1 : 0.6,
                  }}
                  onClick={() => canSelect && handleSelect(skin.id)}
                >
                  <div style={{ textAlign: 'center' }}>
                    {skin.imageUrl ? (
                      <img
                        src={getImageUrl(skin.imageUrl)}
                        alt={skin.name}
                        style={{
                          width: '100%',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          marginBottom: '8px',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100px',
                          background: skin.boardConfig?.color || '#3a3a3a',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '32px',
                        }}
                      >
                        🎲
                      </div>
                    )}
                    <div className="card-title" style={{ fontSize: '14px', marginBottom: '4px' }}>
                      {skin.name}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: getRarityColor(skin.rarity),
                        marginBottom: '4px',
                      }}
                    >
                      {skin.rarity === 'legendary' && 'Легендарный'}
                      {skin.rarity === 'epic' && 'Эпический'}
                      {skin.rarity === 'rare' && 'Редкий'}
                      {skin.rarity === 'common' && 'Обычный'}
                    </div>
                    {!isOwned && skin.price && (
                      <div className="gold" style={{ fontSize: '12px' }}>
                        {skin.price} NAR
                      </div>
                    )}
                    {isOwned && (
                      <div style={{ fontSize: '10px', color: '#4CAF50' }}>
                        {isSelected ? 'Выбрано' : 'Куплено'}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <Button fullWidth variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

