import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Academy.css'

interface Course {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  isCompleted?: boolean
  description?: string
}

interface Article {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  isCompleted?: boolean
}

interface Onboarding {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  isCompleted?: boolean
}

interface MaterialSection {
  id: string
  title: string
  content: string
  icon?: string
}

interface MaterialDetail extends Course {
  sections?: MaterialSection[]
  content?: string
}

export default function Academy() {
  const navigate = useNavigate()
  const location = useLocation()
  const { materialId } = useParams<{ materialId?: string }>()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'onboarding' | 'courses' | 'articles'>('onboarding')
  const [onboarding, setOnboarding] = useState<Onboarding[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [showPurchaseModal, setShowPurchaseModal] = useState<Course | Article | Onboarding | null>(null)
  const [publishForm, setPublishForm] = useState({ title: '', description: '', type: 'article' as 'article' | 'course', price: 25, content: '' })
  const [publishing, setPublishing] = useState(false)
  const [materialDetail, setMaterialDetail] = useState<MaterialDetail | null>(null)
  const [hidePurchased, setHidePurchased] = useState(false)
  
  const isPublishPage = location.pathname === '/academy/publish'
  const isMaterialPage = !!materialId

  useEffect(() => {
    if (isMaterialPage && materialId) {
      loadMaterialDetail(materialId)
    } else {
      loadData()
    }
  }, [activeTab, materialId, isMaterialPage])

  useEffect(() => {
    // Проверяем параметр type из URL
    const urlParams = new URLSearchParams(location.search)
    const typeParam = urlParams.get('type')
    if (typeParam === 'course') {
      setPublishForm(prev => ({ ...prev, type: 'course' }))
    }
  }, [location.search])
  
  const loadMaterialDetail = async (id: string) => {
    try {
      const response = await apiClient.get(`/academy/materials/${id}`).catch(() => ({ data: null }))
      setMaterialDetail(response.data)
    } catch (error) {
      console.error('Failed to load material detail:', error)
    }
  }

  const loadData = async () => {
    try {
      if (activeTab === 'onboarding') {
        const response = await apiClient.get('/academy/onboarding')
        setOnboarding(response.data || [])
      } else if (activeTab === 'courses') {
        const response = await apiClient.get('/academy/courses')
        setCourses(response.data || [])
      } else if (activeTab === 'articles') {
        const response = await apiClient.get('/academy/articles')
        setArticles(response.data || [])
      }
    } catch (error) {
      console.error('Failed to load academy data:', error)
    }
  }

  const handlePurchase = async (item: Course | Article | Onboarding) => {
    try {
      await apiClient.post(`/academy/courses/${item.id}/purchase`)
      alert('Материал успешно куплен!')
      setShowPurchaseModal(null)
      loadData()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка при покупке'
      alert(errorMessage)
      console.error('Failed to purchase:', error)
    }
  }

  const handleOpen = (material: Course | Article | Onboarding) => {
    navigate(`/academy/${material.id}`)
  }

  // Функция фильтрации и сортировки элементов
  const getFilteredAndSortedItems = <T extends { purchased: boolean; isCompleted?: boolean }>(items: T[]): T[] => {
    let filtered = items

    // Если включена галочка "Не отображать купленные", скрываем купленные
    if (hidePurchased) {
      filtered = filtered.filter(item => !item.purchased)
    }

    // Сортируем по приоритету:
    // 1. Купленные, но не выполненные - сверху
    // 2. Выполненные (тоже купленные) - снизу от купленных, но выше не купленных
    // 3. Не купленные - внизу
    return filtered.sort((a, b) => {
      // Купленные, но не выполненные - наверх
      if (a.purchased && !a.isCompleted && (!b.purchased || b.isCompleted)) return -1
      if (b.purchased && !b.isCompleted && (!a.purchased || a.isCompleted)) return 1

      // Выполненные (купленные) - ниже купленных не выполненных, но выше не купленных
      if (a.purchased && a.isCompleted && !b.purchased) return -1
      if (b.purchased && b.isCompleted && !a.purchased) return 1

      // Среди выполненных сортируем по порядку
      if (a.purchased && a.isCompleted && b.purchased && b.isCompleted) return 0

      // Не купленные - внизу
      if (!a.purchased && b.purchased) return 1
      if (a.purchased && !b.purchased) return -1

      return 0
    })
  }

  const canPublish = user?.isAdmin === true

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publishForm.title.trim()) {
      alert('Введите название материала')
      return
    }
    try {
      setPublishing(true)
      if (publishForm.type === 'course') {
        // Курсы могут создавать только админы
        if (!user?.isAdmin) {
          alert('Курсы могут создавать только администраторы!')
          return
        }
        // Создаем курс через админский endpoint
        await apiClient.post('/admin/academy/create', {
          title: publishForm.title,
          content: publishForm.content,
          type: 'course',
          isPaid: publishForm.price > 0,
          price: publishForm.price,
          authorId: null, // null означает, что это курс от админа
          isVerified: true, // Курсы от админов сразу верифицированы
        })
        alert('Курс создан!')
      } else {
        // Статьи создают игроки - требуют верификации
        await apiClient.post('/academy/publish', publishForm)
        alert('Статья отправлена на верификацию администратором!')
      }
      navigate('/academy')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при публикации')
    } finally {
      setPublishing(false)
    }
  }

  // Курсы всегда доступны, убрана проверка уровня

  // Страница просмотра материала
  if (isMaterialPage && materialDetail) {
    const titleParts = materialDetail.title.split(' ')
    const mainTitle = titleParts[0] || 'Основы'
    const subtitle = titleParts.slice(1).join(' ') || 'Длинных нард'
    
    return (
      <PageLayout title={mainTitle} subtitle={subtitle} showBack={true}>
        <div className="academy-material-author">{materialDetail.author || 'Администратор'}</div>
        <div className="academy-material-content">
          {materialDetail.sections && materialDetail.sections.length > 0 ? (
            materialDetail.sections.map((section) => (
              <div key={section.id} className="academy-material-section">
                <div className="academy-material-section-header">
                  {section.icon && <span className="academy-material-section-icon">{section.icon}</span>}
                  <h3 className="academy-material-section-title">{section.title}</h3>
                </div>
                <div className="academy-material-section-content" dangerouslySetInnerHTML={{ __html: section.content }} />
              </div>
            ))
          ) : (
            <div className="academy-material-content-text" dangerouslySetInnerHTML={{ __html: materialDetail.content || 'Содержание отсутствует' }} />
          )}
        </div>
      </PageLayout>
    )
  }

  // Страница публикации
  if (isPublishPage) {
    return (
      <PageLayout title="" showBack={true}>
        <form className="academy-publish-form" onSubmit={handlePublish}>
          <div className="academy-publish-field">
            <label className="academy-publish-label">Название материала:</label>
            <input
              type="text"
              className="academy-publish-input"
              placeholder="Введите название..."
              value={publishForm.title}
              onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
              required
            />
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Краткое описание:</label>
            <input
              type="text"
              className="academy-publish-input"
              placeholder="Описание материала"
              value={publishForm.description}
              onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
            />
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Тип</label>
            {user?.isAdmin ? (
              <div className="academy-publish-type-buttons">
                <button
                  type="button"
                  className={`academy-publish-type-button ${publishForm.type === 'article' ? 'active' : ''}`}
                  onClick={() => setPublishForm({ ...publishForm, type: 'article' })}
                >
                  Статья
                </button>
                <button
                  type="button"
                  className={`academy-publish-type-button ${publishForm.type === 'course' ? 'active' : ''}`}
                  onClick={() => setPublishForm({ ...publishForm, type: 'course' })}
                >
                  Курс (только для админов)
                </button>
              </div>
            ) : (
              <div style={{ 
                padding: '12px', 
                background: '#2a2a2a', 
                borderRadius: '8px', 
                color: '#B6B6B6',
                fontSize: '14px'
              }}>
                Игроки могут создавать только <strong style={{ color: '#FFF' }}>статьи</strong>. 
                Статьи проходят верификацию администратором перед публикацией.
                <br />
                <small style={{ color: '#999', fontSize: '12px' }}>
                  Курсы создаются только администраторами в админ-панели.
                </small>
              </div>
            )}
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Стоимость</label>
            <input
              type="number"
              className="academy-publish-input"
              placeholder="25 NAR"
              value={publishForm.price}
              onChange={(e) => setPublishForm({ ...publishForm, price: parseInt(e.target.value) || 0 })}
              min="0"
            />
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Контент</label>
            <textarea
              className="academy-publish-textarea"
              placeholder="Вставьте текст"
              value={publishForm.content}
              onChange={(e) => setPublishForm({ ...publishForm, content: e.target.value })}
              rows={8}
            />
          </div>

          <button type="submit" className="academy-publish-submit-button" disabled={publishing}>
            {publishing ? 'Публикация...' : 'Опубликовать'}
          </button>
        </form>
      </PageLayout>
    )
  }

  const canCreateArticle = (user?.level || 0) >= 20

  return (
    <PageLayout
      title="Академия"
      subtitle="Повышай мастерство в нардах. Все материалы доступны к покупке"
      tabs={[
        { id: 'onboarding', label: 'Онбординг', active: activeTab === 'onboarding', onClick: () => setActiveTab('onboarding') },
        { id: 'courses', label: 'Курсы', active: activeTab === 'courses', onClick: () => setActiveTab('courses') },
        { id: 'articles', label: 'Статьи', active: activeTab === 'articles', onClick: () => setActiveTab('articles') },
      ]}
      rightAction={
        canCreateArticle && activeTab === 'articles' ? (
          <button 
            className="academy-create-article-button"
            onClick={() => navigate('/academy/publish?type=article')}
            title="Создать статью"
          >
            ✏️
          </button>
        ) : undefined
      }
    >
      {/* Галочка "Не отображать купленные" */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#B6B6B6', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={hidePurchased}
            onChange={(e) => setHidePurchased(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          Не отображать купленные
        </label>
      </div>

      {/* Онбординг */}
      {activeTab === 'onboarding' && (
        <div className="academy-list">
          {getFilteredAndSortedItems(onboarding).map((item) => (
            <div key={item.id} className="academy-card">
              <img src="/img/шляпа.png" alt="Onboarding" className="academy-card-icon" />
              <div className="academy-card-content">
                <div className="academy-card-header">
                  <h3 className="academy-card-title">{item.title}</h3>
                  {item.purchased ? (
                    <span className="academy-card-status">
                      {item.isCompleted ? 'Выполнено' : 'Куплено'}
                    </span>
                  ) : (
                    <span className="academy-card-price">{item.price} NAR</span>
                  )}
                </div>
                <p className="academy-card-author">{item.author}</p>
              </div>
              {item.purchased ? (
                <button className="academy-card-button academy-card-button-open" onClick={() => handleOpen(item)}>
                  Открыть
                </button>
              ) : (
                <button className="academy-card-button academy-card-button-buy" onClick={() => setShowPurchaseModal(item)}>
                  Купить
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Курсы */}
      {activeTab === 'courses' && (
        <div className="academy-list">
          {getFilteredAndSortedItems(courses).map((course) => (
            <div key={course.id} className="academy-card">
              <img src="/img/шляпа.png" alt="Course" className="academy-card-icon" />
              <div className="academy-card-content">
                <div className="academy-card-header">
                  <h3 className="academy-card-title">{course.title}</h3>
                  {course.purchased ? (
                    <span className="academy-card-status">
                      {course.isCompleted ? 'Выполнено' : 'Куплено'}
                    </span>
                  ) : (
                    <span className="academy-card-price">{course.price} NAR</span>
                  )}
                </div>
                <p className="academy-card-author">{course.author}</p>
              </div>
              {course.purchased ? (
                <button className="academy-card-button academy-card-button-open" onClick={() => handleOpen(course)}>
                  Открыть
                </button>
              ) : (
                <button className="academy-card-button academy-card-button-buy" onClick={() => setShowPurchaseModal(course)}>
                  Купить
                </button>
              )}
            </div>
          ))}
          {/* Игроки не могут создавать курсы - только админы */}
          {user?.isAdmin && (
            <button className="academy-publish-button" onClick={() => navigate('/academy/publish?type=course')}>
              Создать курс (только для админов)
            </button>
          )}
        </div>
      )}

      {/* Статьи */}
      {activeTab === 'articles' && (
        <div className="academy-list">
          {getFilteredAndSortedItems(articles).map((article) => (
            <div key={article.id} className="academy-card">
              <img src="/img/шляпа.png" alt="Article" className="academy-card-icon" />
              <div className="academy-card-content">
                <div className="academy-card-header">
                  <h3 className="academy-card-title">{article.title}</h3>
                  {article.purchased ? (
                    <span className="academy-card-status">Куплено</span>
                  ) : (
                    <span className="academy-card-price">{article.price} NAR</span>
                  )}
                </div>
                <p className="academy-card-author">{article.author}</p>
              </div>
              {article.purchased ? (
                <button className="academy-card-button academy-card-button-open" onClick={() => handleOpen(article)}>
                  Открыть
                </button>
              ) : (
                <button className="academy-card-button academy-card-button-buy" onClick={() => setShowPurchaseModal(article)}>
                  Купить
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно покупки */}
      {showPurchaseModal && (
        <div className="academy-modal-overlay" onClick={() => setShowPurchaseModal(null)}>
          <div className="academy-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="academy-modal-title">Купить материал</h3>
            <p className="academy-modal-description">
              {showPurchaseModal.title} за {showPurchaseModal.price} NAR?
            </p>
            <p className="academy-modal-balance">
              Баланс: {Number(user?.narCoin || 0).toLocaleString()} NAR
            </p>
            <div className="academy-modal-actions">
              <button
                className="academy-modal-button academy-modal-button-primary"
                onClick={() => handlePurchase(showPurchaseModal)}
                disabled={Number(user?.narCoin || 0) < showPurchaseModal.price}
              >
                Да
              </button>
              <button
                className="academy-modal-button academy-modal-button-secondary"
                onClick={() => setShowPurchaseModal(null)}
              >
                Нет
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
