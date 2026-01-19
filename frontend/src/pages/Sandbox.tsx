import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Sandbox.css'

interface SandboxChapter {
  id: string
  name: string
  gameState: any
  createdAt: string
  updatedAt: string
}

export default function Sandbox() {
  const navigate = useNavigate()
  const [sandboxChapters, setSandboxChapters] = useState<SandboxChapter[]>([])

  useEffect(() => {
    loadSandboxChapters()
  }, [])

  const loadSandboxChapters = async () => {
    try {
      const res = await apiClient.get('/games/sandbox/chapters')
      setSandboxChapters(res.data || [])
    } catch (e) {
      console.error('Failed to load sandbox chapters', e)
    }
  }

  const handleLoadChapter = async (chapter: SandboxChapter) => {
    try {
      const response = await apiClient.post('/games/create-sandbox', { 
        mode: chapter.gameState?.mode || 'long' 
      })
      const gameId = response.data.id
      
      // Загружаем состояние главы в созданный стол
      await apiClient.post(`/games/${gameId}/sandbox/setup-board`, chapter.gameState)
      navigate(`/game/${gameId}`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при загрузке главы')
    }
  }

  const handleDeleteChapter = async (id: string) => {
    if (!confirm('Удалить эту главу?')) return
    try {
      await apiClient.delete(`/games/sandbox/chapters/${id}`)
      loadSandboxChapters()
    } catch (e) {
      alert('Ошибка при удалении')
    }
  }

  return (
    <PageLayout
      title="Песочница"
      subtitle="Расставь шашки как хочешь и тренируйся"
      showBack={true}
    >
      <div className="sandbox-content">
        <div className="sandbox-card sandbox-promo-card">
          <div className="sandbox-card-content">
            <h3 className="sandbox-card-title">Песочница</h3>
            <p className="sandbox-card-description">
              В песочнице вы можете расставить шашки как хотите, установить нужные кубики и тренироваться. 
              Идеально для разбора позиций и изучения игры.
            </p>
            <div className="sandbox-modes">
              <div className="sandbox-mode-option">
                <h4>Длинные нарды</h4>
                <button 
                  className="sandbox-card-button sandbox-card-button-primary"
                  onClick={async () => {
                    try {
                      const response = await apiClient.post('/games/create-sandbox', { mode: 'long' })
                      navigate(`/game/${response.data.id}`)
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Ошибка при создании песочницы')
                    }
                  }}
                >
                  Зайти в песочницу
                </button>
              </div>
              <div className="sandbox-mode-option">
                <h4>Короткие нарды</h4>
                <button 
                  className="sandbox-card-button sandbox-card-button-primary"
                  onClick={async () => {
                    try {
                      const response = await apiClient.post('/games/create-sandbox', { mode: 'short' })
                      navigate(`/game/${response.data.id}`)
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Ошибка при создании песочницы')
                    }
                  }}
                >
                  Зайти в песочницу
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {sandboxChapters.length > 0 && (
          <div className="sandbox-card sandbox-chapters-card">
            <div className="sandbox-card-content">
              <h3 className="sandbox-card-title">Сохраненные главы</h3>
              <div className="sandbox-chapters-list">
                {sandboxChapters.map(chapter => (
                  <div key={chapter.id} className="sandbox-chapter-item">
                    <div className="sandbox-chapter-info">
                      <div className="sandbox-chapter-name">{chapter.name}</div>
                      <div className="sandbox-chapter-date">
                        {new Date(chapter.createdAt).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    <div className="sandbox-chapter-actions">
                      <button 
                        className="sandbox-card-button sandbox-card-button-primary"
                        onClick={() => handleLoadChapter(chapter)}
                      >
                        Загрузить
                      </button>
                      <button 
                        className="sandbox-chapter-delete"
                        onClick={() => handleDeleteChapter(chapter.id)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

