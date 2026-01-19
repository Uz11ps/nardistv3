import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/PageLayout'
import RichTextEditor from '../components/RichTextEditor'
import Quiz from '../components/Quiz'
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
  gameMode?: 'long' | 'short'
  type?: 'course'
  isPaid?: boolean
}

interface Article {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  isCompleted?: boolean
  gameMode?: 'long' | 'short'
  type?: 'article'
  isPaid?: boolean
}

interface Onboarding {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  isCompleted?: boolean
  gameMode?: 'long' | 'short'
  type?: 'onboarding'
  isPaid?: boolean
}

interface MaterialSection {
  id: string
  title: string
  content: string
  icon?: string
}

interface MaterialDetail {
  id: string
  title: string
  author: string
  price: number
  purchased: boolean
  isCompleted?: boolean
  description?: string
  gameMode?: 'long' | 'short'
  type?: 'course' | 'article' | 'onboarding'
  isPaid?: boolean
  sections?: MaterialSection[]
  content?: string
  quiz?: {
    questions: Array<{
      id: number
      question: string
      options: string[]
      correctAnswer: number
    }>
  }
  quizPassed?: boolean
  quizPassedAt?: string | null
}

interface SandboxChapter {
  id: string
  name: string
  gameState: any
  createdAt: string
  updatedAt: string
}

export default function Academy() {
  const navigate = useNavigate()
  const location = useLocation()
  const { materialId } = useParams<{ materialId?: string }>()
  const { user, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'onboarding' | 'courses' | 'articles' | 'free-table' | 'my-materials'>('onboarding')
  const [activeFilter, setActiveFilter] = useState<'long' | 'short'>('long')
  const [onboarding, setOnboarding] = useState<Onboarding[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [showPurchaseModal, setShowPurchaseModal] = useState<Course | Article | Onboarding | null>(null)
  const [publishForm, setPublishForm] = useState({ 
    title: '', 
    description: '', 
    type: 'article' as 'article' | 'course', 
    price: 25, 
    content: '',
    gameMode: 'long' as 'long' | 'short'
  })
  const [publishing, setPublishing] = useState(false)
  const [materialDetail, setMaterialDetail] = useState<MaterialDetail | null>(null)
  const [hidePurchased, setHidePurchased] = useState(false)
  const [sandboxChapters, setSandboxChapters] = useState<SandboxChapter[]>([])
  
  const isPublishPage = location.pathname === '/academy/publish'
  const isMaterialPage = !!materialId
  
  // Загружаем главы свободного стола
  useEffect(() => {
    if (activeTab === 'free-table') {
      loadSandboxChapters()
    }
  }, [activeTab])
  
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

  useEffect(() => {
    if (isMaterialPage && materialId) {
      loadMaterialDetail(materialId)
    } else {
      loadData()
    }
  }, [activeTab, materialId, isMaterialPage, activeFilter])

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
      // Используем правильный эндпоинт в зависимости от типа материала
      const endpoint = item.type === 'article' 
        ? `/academy/articles/${item.id}/purchase`
        : `/academy/courses/${item.id}/purchase`
      await apiClient.post(endpoint)
      alert('Материал успешно куплен!')
      setShowPurchaseModal(null)
      loadData()
      // Если открыт материал, перезагружаем его
      if (isMaterialPage && materialId === item.id) {
        await loadMaterialDetail(item.id)
      }
      // Обновляем пользователя для обновления баланса
      const userRes = await apiClient.get('/users/me')
      updateUser(userRes.data)
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка при покупке'
      alert(errorMessage)
      console.error('Failed to purchase:', error)
    }
  }

  const handleOpen = (material: Course | Article | Onboarding) => {
    // Если материал не куплен и платный - показываем модалку покупки
    if (!material.purchased && (material.isPaid || material.price > 0)) {
      setShowPurchaseModal(material)
    } else {
      navigate(`/academy/${material.id}`)
    }
  }

  // Функция фильтрации и сортировки элементов
  const getFilteredAndSortedItems = <T extends { purchased: boolean; isCompleted?: boolean; title?: string; gameMode?: string }>(items: T[]): T[] => {
    let filtered = items

    // Фильтрация по типу нард (только для курсов и статей)
    if (activeTab === 'courses' || activeTab === 'articles') {
      filtered = filtered.filter(item => {
        const titleLower = (item.title || '').toLowerCase()
        const isLongKeyword = titleLower.includes('длинн')
        const isShortKeyword = titleLower.includes('коротк')
        
        // 1. Приоритет - ключевые слова в названии (для автоматического распределения старых материалов)
        if (isLongKeyword && !isShortKeyword) {
          return activeFilter === 'long'
        }
        if (isShortKeyword && !isLongKeyword) {
          return activeFilter === 'short'
        }
        
        // 2. Если ключевых слов нет или они спорные, используем поле gameMode
        if (item.gameMode && (item.gameMode === 'long' || item.gameMode === 'short')) {
          return item.gameMode === activeFilter
        }
        
        // 3. Если ничего не определено, по умолчанию относим к длинным нардам
        return activeFilter === 'long'
      })
    }

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
          gameMode: publishForm.gameMode,
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
    
    // Если материал не куплен и платный - показываем сообщение о необходимости покупки
    const isNotPurchased = !materialDetail.purchased && (materialDetail.isPaid || materialDetail.price > 0)
    
    return (
      <PageLayout title={mainTitle} subtitle={subtitle} showBack={true}>
        <div className="academy-material-author">{materialDetail.author || 'Администратор'}</div>
        {isNotPurchased ? (
          <div className="academy-material-content">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: '18px', marginBottom: '20px' }}>Курс не куплен</p>
              <button 
                className="academy-my-material-open-btn"
                onClick={() => setShowPurchaseModal(materialDetail)}
                style={{ margin: '0 auto' }}
              >
                Купить за {materialDetail.price || 0} NAR
              </button>
            </div>
          </div>
        ) : (
          <div className="academy-material-content">
            {materialDetail.sections && materialDetail.sections.length > 0 ? (
              materialDetail.sections.map((section) => (
                <div key={section.id} className="academy-material-section">
                  <div className="academy-material-section-header">
                    {section.icon && <span className="academy-material-section-icon">{section.icon}</span>}
                    <h3 className="academy-material-section-title">{section.title}</h3>
                  </div>
                  <div 
                    className="academy-material-section-content" 
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                </div>
              ))
            ) : (
              <div 
                className="academy-material-content-text" 
                dangerouslySetInnerHTML={{ __html: materialDetail.content || 'Содержание отсутствует' }}
              />
            )}
            
            {/* Тест для курсов - показываем только если курс куплен или бесплатный */}
            {materialDetail.quiz && materialDetail.type === 'course' && (materialDetail.purchased || !materialDetail.isPaid) && (
              <Quiz
                courseId={materialDetail.id}
                quiz={materialDetail.quiz}
                quizPassed={materialDetail.quizPassed || false}
                onComplete={(result) => {
                  // Обновляем статус после прохождения теста
                  setMaterialDetail(prev => prev ? { ...prev, quizPassed: result.passed } : null)
                }}
              />
            )}
          </div>
        )}
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
            <label className="academy-publish-label">Тип нард</label>
            <div className="academy-publish-mode-selector">
              <button
                type="button"
                className={`academy-publish-mode-btn ${publishForm.gameMode === 'long' ? 'active' : ''}`}
                onClick={() => setPublishForm({ ...publishForm, gameMode: 'long' })}
              >
                Длинные
              </button>
              <button
                type="button"
                className={`academy-publish-mode-btn ${publishForm.gameMode === 'short' ? 'active' : ''}`}
                onClick={() => setPublishForm({ ...publishForm, gameMode: 'short' })}
              >
                Короткие
              </button>
            </div>
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Тип контента</label>
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
                  Курс
                </button>
              </div>
            ) : (
              <div className="academy-publish-info">
                Игроки могут создавать только <strong>статьи</strong>. 
                Курсы создаются администраторами.
              </div>
            )}
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Стоимость (NAR)</label>
            <input
              type="number"
              className="academy-publish-input"
              placeholder="25"
              value={publishForm.price}
              onChange={(e) => setPublishForm({ ...publishForm, price: parseInt(e.target.value) || 0 })}
              min="0"
            />
          </div>

          <div className="academy-publish-field">
            <label className="academy-publish-label">Контент</label>
            <RichTextEditor
              value={publishForm.content}
              onChange={(content) => setPublishForm({ ...publishForm, content })}
              placeholder="Начните писать..."
            />
          </div>

          <button type="submit" className="academy-publish-submit-button" disabled={publishing}>
            {publishing ? 'Публикация...' : 'Опубликовать материал'}
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
        { id: 'courses', label: 'Курсы', active: activeTab === 'courses', onClick: () => setActiveTab('courses') },
        { id: 'articles', label: 'Статьи', active: activeTab === 'articles', onClick: () => setActiveTab('articles') },
        { id: 'free-table', label: 'Свободный стол', active: activeTab === 'free-table', onClick: () => setActiveTab('free-table') },
        { id: 'my-materials', label: 'Мои материалы', active: activeTab === 'my-materials', onClick: () => setActiveTab('my-materials') },
      ]}
    >
      <div className="academy-content">
        {(activeTab === 'courses' || activeTab === 'articles') && (
          <div className="academy-filters">
            <button 
              className={`academy-filter-btn ${activeFilter === 'long' ? 'active' : ''}`}
              onClick={() => setActiveFilter('long')}
            >
              длинные нарды
            </button>
            <button 
              className={`academy-filter-btn ${activeFilter === 'short' ? 'active' : ''}`}
              onClick={() => setActiveFilter('short')}
            >
              короткие нарды
            </button>
          </div>
        )}

        {activeTab === 'onboarding' && (
          <div className="academy-grid">
            {getFilteredAndSortedItems(onboarding).map((item) => (
              <div key={item.id} className="academy-grid-card" onClick={() => handleOpen(item)}>
                <div className="academy-grid-card-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 5L5 13L20 21L35 13L20 5Z" fill="#B6B6B6"/>
                    <path d="M5 13V25L20 33L35 25V13L20 21L5 13Z" fill="#B6B6B6" fillOpacity="0.5"/>
                  </svg>
                </div>
                <div className="academy-grid-card-title">{item.title}</div>
                <div className="academy-grid-card-author">{item.author}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="academy-grid">
            {getFilteredAndSortedItems(courses).map((course) => (
              <div key={course.id} className="academy-grid-card" onClick={() => handleOpen(course)}>
                <div className="academy-grid-card-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 5L5 13L20 21L35 13L20 5Z" fill="#B6B6B6"/>
                    <path d="M5 13V25L20 33L35 25V13L20 21L5 13Z" fill="#B6B6B6" fillOpacity="0.5"/>
                  </svg>
                </div>
                <div className="academy-grid-card-title">{course.title}</div>
                <div className="academy-grid-card-author">{course.author}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'articles' && (
          <div className="academy-grid">
            {getFilteredAndSortedItems(articles).map((article) => (
              <div key={article.id} className="academy-grid-card" onClick={() => handleOpen(article)}>
                <div className="academy-grid-card-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 5L5 13L20 21L35 13L20 5Z" fill="#B6B6B6"/>
                    <path d="M5 13V25L20 33L35 25V13L20 21L5 13Z" fill="#B6B6B6" fillOpacity="0.5"/>
                  </svg>
                </div>
                <div className="academy-grid-card-title">{article.title}</div>
                <div className="academy-grid-card-author">{article.author}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'free-table' && (
          <div className="academy-sandbox">
            <div className="academy-card sandbox-promo-card">
              <div className="academy-card-content">
                <h3 className="academy-card-title">Свободный стол</h3>
                <p className="academy-card-description">
                  В свободном столе вы можете расставить шашки как хотите, установить нужные кубики и тренироваться. 
                  Идеально для разбора позиций и изучения игры.
                </p>
                <div className="sandbox-modes">
                  <div className="sandbox-mode-option">
                    <h4>Длинные нарды</h4>
                    <button 
                      className="academy-card-button academy-card-button-primary"
                      onClick={async () => {
                        try {
                          const response = await apiClient.post('/games/create-sandbox', { mode: 'long' })
                          navigate(`/game/${response.data.id}`)
                        } catch (error: any) {
                          alert(error.response?.data?.message || 'Ошибка при создании свободного стола')
                        }
                      }}
                    >
                      Зайти в свободный стол
                    </button>
                  </div>
                  <div className="sandbox-mode-option">
                    <h4>Короткие нарды</h4>
                    <button 
                      className="academy-card-button academy-card-button-primary"
                      onClick={async () => {
                        try {
                          const response = await apiClient.post('/games/create-sandbox', { mode: 'short' })
                          navigate(`/game/${response.data.id}`)
                        } catch (error: any) {
                          alert(error.response?.data?.message || 'Ошибка при создании свободного стола')
                        }
                      }}
                    >
                      Зайти в свободный стол
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {sandboxChapters.length > 0 && (
              <div className="academy-card sandbox-chapters-card">
                <div className="academy-card-content">
                  <h3 className="academy-card-title">Сохраненные главы</h3>
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
                            className="academy-card-button academy-card-button-primary"
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
        )}

        {activeTab === 'my-materials' && (
          <div className="academy-my-materials">
            {getFilteredAndSortedItems([...courses, ...articles, ...onboarding]).filter(item => item.purchased).map((item) => (
              <div key={item.id} className="academy-my-material-card">
                <div className="academy-my-material-icon">
                  <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 5L5 13L20 21L35 13L20 5Z" fill="#FFF"/>
                    <path d="M5 13V25L20 33L35 25V13L20 21L5 13Z" fill="#FFF" fillOpacity="0.5"/>
                  </svg>
                </div>
                <div className="academy-my-material-content">
                  <div className="academy-my-material-status">Куплено</div>
                  <div className="academy-my-material-title">{item.title}</div>
                  <div className="academy-my-material-author">{item.author}</div>
                </div>
                <button className="academy-my-material-open-btn" onClick={() => handleOpen(item)}>
                  Открыть
                </button>
              </div>
            ))}
            
            <button className="academy-publish-own-btn" onClick={() => navigate('/academy/publish')}>
              Опубликовать свое
            </button>
          </div>
        )}
      </div>

      {/* Модалка покупки */}
      {showPurchaseModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Покупка материала</h2>
              <button className="modal-close" onClick={() => setShowPurchaseModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', fontSize: '16px' }}>{showPurchaseModal.title}</p>
              <p style={{ marginBottom: '20px', color: '#888' }}>
                Цена: <strong>{showPurchaseModal.price || 0} NAR</strong>
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  className="academy-card-button"
                  onClick={() => setShowPurchaseModal(null)}
                  style={{ background: '#3a3a3a' }}
                >
                  Отмена
                </button>
                <button 
                  className="academy-card-button academy-card-button-primary"
                  onClick={() => handlePurchase(showPurchaseModal)}
                >
                  {showPurchaseModal.price === 0 ? 'Получить бесплатно' : `Купить за ${showPurchaseModal.price} NAR`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
