import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import { apiClient } from '../api/client'

interface Course {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  description?: string
}

interface Article {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
}

export default function Academy() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'courses' | 'articles' | 'materials'>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [myMaterials, setMyMaterials] = useState<Course[]>([])
  const [showPurchaseModal, setShowPurchaseModal] = useState<Course | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      if (activeTab === 'courses') {
        const response = await apiClient.get('/academy/courses')
        setCourses(response.data || [])
      } else if (activeTab === 'articles') {
        const response = await apiClient.get('/academy/articles')
        setArticles(response.data || [])
      } else {
        const response = await apiClient.get('/academy/my-materials')
        setMyMaterials(response.data || [])
      }
    } catch (error) {
      console.error('Failed to load academy data:', error)
    }
  }

  const handlePurchase = async (course: Course) => {
    try {
      await apiClient.post(`/academy/courses/${course.id}/purchase`)
      setShowPurchaseModal(null)
      loadData()
    } catch (error) {
      console.error('Failed to purchase course:', error)
    }
  }

  const handleOpen = (material: Course | Article) => {
    navigate(`/academy/${material.id}`)
  }

  const canPublish = user?.isAdmin === true

  if ((user?.level || 0) < 20) {
    return (
      <div className="app-container">
        <PageHeader title="Академия" />
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎓</div>
          <div className="card-title" style={{ marginBottom: '12px' }}>
            Курсы недоступны
          </div>
          <div className="card-subtitle" style={{ marginBottom: '32px' }}>
            Город и районы открываются с 20 уровня. Здесь ты можешь читать, и писать статьи и
            курсы.
          </div>
          <Button onClick={() => navigate('/')}>Играть</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <PageHeader title="Академия" />
      
      <div style={{ padding: '20px' }}>
        <div className="card-subtitle" style={{ marginBottom: '16px', textAlign: 'center' }}>
          Повышай мастерство в нардах. Все материалы доступны к покупке
        </div>

        {/* Вкладки */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            Курсы
          </button>
          <button
            className={`tab ${activeTab === 'articles' ? 'active' : ''}`}
            onClick={() => setActiveTab('articles')}
          >
            Статьи
          </button>
          <button
            className={`tab ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            Мои материалы
          </button>
        </div>

        {/* Курсы */}
        {activeTab === 'courses' && (
          <div>
            {courses.map((course) => (
              <Card key={course.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>🎓</div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{course.title}</div>
                    <div className="card-subtitle">{course.author}</div>
                    {course.purchased && (
                      <div style={{ fontSize: '12px', color: '#4a4a4a', marginTop: '4px' }}>
                        Куплено
                      </div>
                    )}
                  </div>
                  {course.purchased ? (
                    <Button variant="secondary" onClick={() => handleOpen(course)}>
                      Открыть
                    </Button>
                  ) : (
                    <div style={{ textAlign: 'right' }}>
                      <div className="gold" style={{ marginBottom: '8px' }}>
                        {course.price} NAR
                      </div>
                      <Button onClick={() => setShowPurchaseModal(course)}>Купить</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Статьи */}
        {activeTab === 'articles' && (
          <div>
            {articles.map((article) => (
              <Card key={article.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{article.title}</div>
                    <div className="card-subtitle">{article.author}</div>
                  </div>
                  {article.purchased ? (
                    <Button variant="secondary" onClick={() => handleOpen(article)}>
                      Открыть
                    </Button>
                  ) : (
                    <div style={{ textAlign: 'right' }}>
                      <div className="gold" style={{ marginBottom: '8px' }}>
                        {article.price} NAR
                      </div>
                      <Button onClick={() => handlePurchase(article as Course)}>Купить</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Мои материалы */}
        {activeTab === 'materials' && (
          <div>
            {myMaterials.map((material) => (
              <Card key={material.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>🎓</div>
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{material.title}</div>
                    <div className="card-subtitle">{material.author}</div>
                    <div style={{ fontSize: '12px', color: '#4a4a4a', marginTop: '4px' }}>
                      Куплено
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => handleOpen(material)}>
                    Открыть
                  </Button>
                </div>
              </Card>
            ))}
            {canPublish && (
              <Button
                fullWidth
                onClick={() => navigate('/academy/publish')}
                style={{ marginTop: '24px' }}
              >
                Опубликовать свое
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно покупки */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Купить курс</div>
            <div className="modal-description">
              {showPurchaseModal.title} за {showPurchaseModal.price} NAR?
            </div>
            <div className="card-subtitle" style={{ marginBottom: '24px' }}>
              Баланс: {Number(user?.narCoin || 0).toLocaleString()} NAR
            </div>
            <div className="modal-actions">
              <Button
                fullWidth
                onClick={() => handlePurchase(showPurchaseModal)}
                disabled={Number(user?.narCoin || 0) < showPurchaseModal.price}
                variant={Number(user?.narCoin || 0) < showPurchaseModal.price ? 'secondary' : 'primary'}
              >
                Да
              </Button>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => setShowPurchaseModal(null)}
              >
                Нет
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
