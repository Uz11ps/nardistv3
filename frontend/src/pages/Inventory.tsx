import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import BottomNav from '../components/BottomNav'
import { apiClient } from '../api/client'

export default function Inventory() {
  const [skins, setSkins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/skins/my')
      setSkins(response.data || [])
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <PageHeader title="Инвентарь" />
      
      <div style={{ padding: '20px' }}>
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
              Загрузка...
            </div>
          </Card>
        ) : skins.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#aaaaaa' }}>
              Инвентарь пуст. Купите скины в магазине!
            </div>
          </Card>
        ) : (
          <div>
            {skins.map((skin) => (
              <Card key={skin.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      background: skin.boardConfig?.color || '#3a3a3a',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {skin.imageUrl ? (
                      <img
                        src={skin.imageUrl}
                        alt={skin.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '32px' }}>🎲</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{skin.name}</div>
                    <div className="card-subtitle">{skin.rarity}</div>
                    <div className="card-subtitle" style={{ marginTop: '4px' }}>
                      Вес: {skin.weight}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

