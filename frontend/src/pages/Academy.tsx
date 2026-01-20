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
  quizPassed?: boolean
  assignment?: {
    quiz?: {
      questions: Array<{
        id: number
        question: string
        options: string[]
        correctAnswer: number
      }>
    }
  }
  quiz?: {
    questions: Array<{
      id: number
      question: string
      options: string[]
      correctAnswer: number
    }>
  }
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

export default function Academy() {
  const navigate = useNavigate()
  const location = useLocation()
  const { materialId } = useParams<{ materialId?: string }>()
  const { user, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'onboarding' | 'courses' | 'articles' | 'my-materials'>('my-materials')
  const [activeFilter, setActiveFilter] = useState<'long' | 'short'>('long')
  const [myMaterialsFilter, setMyMaterialsFilter] = useState<'all' | 'courses' | 'articles'>('all')
  
  // Сбрасываем фильтр при переключении вкладок
  useEffect(() => {
    setActiveFilter('long')
  }, [activeTab])
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
    gameMode: 'long' as 'long' | 'short',
    quiz: null as {
      questions: Array<{
        id: number
        question: string
        options: string[]
        correctAnswer: number
      }>
    } | null
  })
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    id: number
    question: string
    options: string[]
    correctAnswer: number
  }>>([])
  const [publishing, setPublishing] = useState(false)
  const [materialDetail, setMaterialDetail] = useState<MaterialDetail | null>(null)
  const [hidePurchased, setHidePurchased] = useState(false)
  
  const isPublishPage = location.pathname === '/academy/publish'
  const isMaterialPage = !!materialId

  useEffect(() => {
    console.log('[Academy] useEffect triggered - activeTab:', activeTab, 'isMaterialPage:', isMaterialPage, 'materialId:', materialId)
    if (isMaterialPage && materialId) {
      loadMaterialDetail(materialId)
    } else if (!isMaterialPage) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, materialId, isMaterialPage])

  // Сбрасываем скролл в начало при открытии материала
  useEffect(() => {
    if (materialId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [materialId])

  useEffect(() => {
    // Проверяем параметр type из URL
    const urlParams = new URLSearchParams(location.search)
    const typeParam = urlParams.get('type')
    if (typeParam === 'course') {
      setPublishForm(prev => ({ ...prev, type: 'course' }))
    }
  }, [location.search])

  // Сбрасываем скролл в начало при открытии материала
  useEffect(() => {
    if (materialId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [materialId])
  
  const loadMaterialDetail = async (id: string) => {
    try {
      // Сбрасываем скролл в начало перед загрузкой
      window.scrollTo({ top: 0, behavior: 'instant' })
      const response = await apiClient.get(`/academy/materials/${id}`).catch(() => ({ data: null }))
      setMaterialDetail(response.data)
      // Дополнительно сбрасываем скролл после загрузки (на случай если контент уже был отрендерен)
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('Failed to load material detail:', error)
    }
  }

  const loadData = async () => {
    try {
      console.log('[Academy] loadData called for tab:', activeTab, 'isMaterialPage:', isMaterialPage)
      if (activeTab === 'onboarding') {
        const response = await apiClient.get('/academy/onboarding')
        console.log('[Academy] Loaded onboarding:', response.data?.length || 0, 'items')
        setOnboarding(response.data || [])
      } else if (activeTab === 'courses') {
        const response = await apiClient.get('/academy/courses')
        console.log('[Academy] Loaded courses:', response.data?.length || 0, 'items', response.data)
        setCourses(response.data || [])
      } else if (activeTab === 'articles') {
        const response = await apiClient.get('/academy/articles')
        console.log('[Academy] Loaded articles:', response.data?.length || 0, 'items', response.data)
        setArticles(response.data || [])
      } else if (activeTab === 'my-materials') {
        // Загружаем все материалы для "Мои материалы"
        const [coursesRes, articlesRes, onboardingRes] = await Promise.all([
          apiClient.get('/academy/courses').catch(() => ({ data: [] })),
          apiClient.get('/academy/articles').catch(() => ({ data: [] })),
          apiClient.get('/academy/onboarding').catch(() => ({ data: [] }))
        ])
        console.log('[Academy] Loaded for my-materials - courses:', coursesRes.data?.length || 0, 'articles:', articlesRes.data?.length || 0)
        setCourses(coursesRes.data || [])
        setArticles(articlesRes.data || [])
        setOnboarding(onboardingRes.data || [])
      }
    } catch (error) {
      console.error('[Academy] Failed to load academy data:', error)
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
      
      // Обновляем данные сразу, чтобы материалы пропали динамически
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
    // Если материал не куплен - показываем модалку покупки (даже если цена 0 NAR)
    if (!material.purchased) {
      setShowPurchaseModal(material)
    } else {
      // Сбрасываем скролл перед навигацией
      window.scrollTo({ top: 0, behavior: 'instant' })
      navigate(`/academy/${material.id}`)
    }
  }

  // Функция фильтрации и сортировки элементов
  const getFilteredAndSortedItems = <T extends { purchased: boolean; isCompleted?: boolean; title?: string; gameMode?: string; type?: 'course' | 'article' | 'onboarding' }>(items: T[]): T[] => {
    let filtered = items

    // Исключаем купленные материалы из списков курсов и статей
    if (activeTab === 'courses' || activeTab === 'articles') {
      filtered = filtered.filter(item => !item.purchased)
    }

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
    
    // Фильтрация по типу материалов для моих материалов
    if (activeTab === 'my-materials') {
      // Фильтр по типу материала (курсы/статьи)
      if (myMaterialsFilter !== 'all') {
        if (myMaterialsFilter === 'courses') {
          // Курсы
          filtered = filtered.filter(item => item.type === 'course' || item.type === 'onboarding')
        } else if (myMaterialsFilter === 'articles') {
          // Статьи
          filtered = filtered.filter(item => item.type === 'article')
        }
      }
      
      // Фильтрация по типу нард для моих материалов
      filtered = filtered.filter(item => {
        const titleLower = (item.title || '').toLowerCase()
        const isLongKeyword = titleLower.includes('длинн')
        const isShortKeyword = titleLower.includes('коротк')
        
        // 1. Приоритет - ключевые слова в названии
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
    
    // Валидация теста
    if (quizQuestions.length > 0) {
      const invalidQuestions = quizQuestions.filter(q => 
        !q.question.trim() || 
        q.options.some(opt => !opt.trim()) || 
        q.options.filter(opt => opt.trim()).length < 2
      )
      if (invalidQuestions.length > 0) {
        alert('Заполните все вопросы и варианты ответов. Минимум 2 варианта ответа на вопрос.')
        return
      }
    }
    
    try {
      setPublishing(true)
      const publishData = {
        ...publishForm,
        quiz: quizQuestions.length > 0 ? { questions: quizQuestions } : null
      }
      
      if (publishForm.type === 'course') {
        // Курсы могут создавать только админы
        if (!user?.isAdmin) {
          alert('Курсы могут создавать только администраторы!')
          return
        }
        // Создаем курс через админский endpoint
        await apiClient.post('/admin/academy/create', {
          title: publishData.title,
          content: publishData.content,
          gameMode: publishData.gameMode,
          type: 'course',
          isPaid: publishData.price > 0,
          price: publishData.price,
          authorId: null, // null означает, что это курс от админа
          isVerified: true, // Курсы от админов сразу верифицированы
          assignment: publishData.quiz ? { quiz: publishData.quiz } : null
        })
        alert('Курс создан!')
      } else {
        // Статьи создают игроки - требуют верификации
        await apiClient.post('/academy/publish', publishData)
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
    
    // Если материал не куплен - показываем сообщение о необходимости покупки (даже если цена 0 NAR)
    const isNotPurchased = !materialDetail.purchased
    
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

          <div className="academy-publish-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label className="academy-publish-label">Тест/Опросник (без наград)</label>
              <button
                type="button"
                className="academy-card-button"
                onClick={() => {
                  const newQuestion = {
                    id: Date.now(),
                    question: '',
                    options: ['', '', '', ''],
                    correctAnswer: 0
                  }
                  setQuizQuestions([...quizQuestions, newQuestion])
                }}
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                + Добавить вопрос
              </button>
            </div>
            
            {quizQuestions.map((q, qIndex) => (
              <div key={q.id} style={{ marginBottom: '20px', padding: '16px', background: '#2a2a2a', borderRadius: '12px', border: '1px solid #3a3a3a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ color: '#FFF', fontSize: '16px', margin: 0 }}>Вопрос {qIndex + 1}</h4>
                  <button
                    type="button"
                    onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== qIndex))}
                    style={{ background: '#A32E2E', border: 'none', borderRadius: '8px', color: '#FFF', padding: '6px 12px', cursor: 'pointer' }}
                  >
                    Удалить
                  </button>
                </div>
                
                <input
                  type="text"
                  className="academy-publish-input"
                  placeholder="Введите вопрос..."
                  value={q.question}
                  onChange={(e) => {
                    const updated = [...quizQuestions]
                    updated[qIndex].question = e.target.value
                    setQuizQuestions(updated)
                  }}
                  style={{ marginBottom: '12px' }}
                />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.options.map((option, optIndex) => (
                    <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctAnswer === optIndex}
                        onChange={() => {
                          const updated = [...quizQuestions]
                          updated[qIndex].correctAnswer = optIndex
                          setQuizQuestions(updated)
                        }}
                      />
                      <input
                        type="text"
                        className="academy-publish-input"
                        placeholder={`Вариант ${optIndex + 1}`}
                        value={option}
                        onChange={(e) => {
                          const updated = [...quizQuestions]
                          updated[qIndex].options[optIndex] = e.target.value
                          setQuizQuestions(updated)
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
        { id: 'my-materials', label: 'Купленные материалы', active: activeTab === 'my-materials', onClick: () => setActiveTab('my-materials') },
        { id: 'courses', label: 'Курсы', active: activeTab === 'courses', onClick: () => setActiveTab('courses') },
        { id: 'articles', label: 'Статьи', active: activeTab === 'articles', onClick: () => setActiveTab('articles') },
      ]}
    >
      <div className="academy-content">
        {/* Кнопка "Опубликовать свое" - в самом верху для всех вкладок */}
        {(activeTab === 'courses' || activeTab === 'articles' || activeTab === 'my-materials') && (
          <button className="academy-publish-own-btn" onClick={() => navigate('/academy/publish')}>
            Опубликовать свое
          </button>
        )}

        {/* Фильтр по типу нард для курсов и статей */}
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
            {(() => {
              console.log('[Academy] Rendering courses tab - courses state:', courses.length, 'courses:', courses)
              // Фильтруем только по типу материала (course) и gameMode, НЕ исключаем купленные
              const filtered = courses.filter(course => {
                // Проверяем тип материала
                if (course.type !== 'course' && course.type !== 'onboarding') {
                  return false
                }
                
                // Фильтрация по типу нард
                const titleLower = (course.title || '').toLowerCase()
                const isLongKeyword = titleLower.includes('длинн')
                const isShortKeyword = titleLower.includes('коротк')
                
                if (isLongKeyword && !isShortKeyword) {
                  return activeFilter === 'long'
                }
                if (isShortKeyword && !isLongKeyword) {
                  return activeFilter === 'short'
                }
                
                if (course.gameMode && (course.gameMode === 'long' || course.gameMode === 'short')) {
                  return course.gameMode === activeFilter
                }
                
                return activeFilter === 'long'
              }).filter(course => !course.purchased) // Исключаем купленные только в конце
              
              console.log('[Academy] Rendering courses tab - total:', courses.length, 'filtered:', filtered.length, 'filtered items:', filtered)
              return filtered
            })().map((course) => (
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
            {(() => {
              console.log('[Academy] Rendering articles tab - articles state:', articles.length, 'articles:', articles)
              // Фильтруем только по типу материала (article) и gameMode, НЕ исключаем купленные
              const filtered = articles.filter(article => {
                // Проверяем тип материала
                if (article.type !== 'article') {
                  return false
                }
                
                // Фильтрация по типу нард
                const titleLower = (article.title || '').toLowerCase()
                const isLongKeyword = titleLower.includes('длинн')
                const isShortKeyword = titleLower.includes('коротк')
                
                if (isLongKeyword && !isShortKeyword) {
                  return activeFilter === 'long'
                }
                if (isShortKeyword && !isLongKeyword) {
                  return activeFilter === 'short'
                }
                
                if (article.gameMode && (article.gameMode === 'long' || article.gameMode === 'short')) {
                  return article.gameMode === activeFilter
                }
                
                return activeFilter === 'long'
              }).filter(article => !article.purchased) // Исключаем купленные только в конце
              
              console.log('[Academy] Rendering articles tab - total:', articles.length, 'filtered:', filtered.length, 'filtered items:', filtered)
              return filtered
            })().map((article) => (
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


        {activeTab === 'my-materials' && (
          <div className="academy-my-materials">
            {/* Фильтр по типу нард - над фильтром по типу материала */}
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
            
            {/* Фильтр по типу материалов */}
            <div className="academy-filters">
              <button 
                className={`academy-filter-btn ${myMaterialsFilter === 'all' ? 'active' : ''}`}
                onClick={() => setMyMaterialsFilter('all')}
              >
                Все
              </button>
              <button 
                className={`academy-filter-btn ${myMaterialsFilter === 'courses' ? 'active' : ''}`}
                onClick={() => setMyMaterialsFilter('courses')}
              >
                Курсы
              </button>
              <button 
                className={`academy-filter-btn ${myMaterialsFilter === 'articles' ? 'active' : ''}`}
                onClick={() => setMyMaterialsFilter('articles')}
              >
                Статьи
              </button>
            </div>
            
            <div className="academy-grid">
              {getFilteredAndSortedItems([...courses, ...articles, ...onboarding])
                .filter(item => item.purchased)
                .map((item) => (
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
