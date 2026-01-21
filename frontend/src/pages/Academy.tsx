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
  const [activeTab, setActiveTab] = useState<'onboarding' | 'courses' | 'articles' | 'my-materials' | 'publish'>('my-materials')
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

  // Загружаем черновик при загрузке страницы публикации
  useEffect(() => {
    if (isPublishPage) {
      const draft = localStorage.getItem('academy_publish_draft')
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft)
          if (parsedDraft.form) {
            setPublishForm(parsedDraft.form)
          }
          if (parsedDraft.quizQuestions) {
            setQuizQuestions(parsedDraft.quizQuestions)
          }
        } catch (e) {
          console.error('Ошибка загрузки черновика:', e)
        }
      }
      setActiveTab('publish')
    }
  }, [isPublishPage])

  // Сохраняем черновик при изменении формы
  useEffect(() => {
    if (isPublishPage) {
      const draft = {
        form: publishForm,
        quizQuestions: quizQuestions,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem('academy_publish_draft', JSON.stringify(draft))
    }
  }, [publishForm, quizQuestions, isPublishPage])

  // Сохраняем черновик при выходе со страницы
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isPublishPage) {
        const draft = {
          form: publishForm,
          quizQuestions: quizQuestions,
          savedAt: new Date().toISOString()
        }
        localStorage.setItem('academy_publish_draft', JSON.stringify(draft))
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Сохраняем черновик при размонтировании компонента (выход со страницы)
      if (isPublishPage) {
        const draft = {
          form: publishForm,
          quizQuestions: quizQuestions,
          savedAt: new Date().toISOString()
        }
        localStorage.setItem('academy_publish_draft', JSON.stringify(draft))
      }
    }
  }, [publishForm, quizQuestions, isPublishPage])

  useEffect(() => {
    console.log('[Academy] useEffect triggered - activeTab:', activeTab, 'isMaterialPage:', isMaterialPage, 'materialId:', materialId)
    if (isMaterialPage && materialId) {
      loadMaterialDetail(materialId)
    } else if (!isMaterialPage && !isPublishPage) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, materialId, isMaterialPage, isPublishPage])

  // Сбрасываем скролл в начало при открытии материала
  useEffect(() => {
    if (materialId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [materialId])

  // Если мы не на странице публикации, а activeTab случайно остался 'publish' (например, после выхода) —
  // принудительно возвращаемся на вкладку "Купленные материалы"
  useEffect(() => {
    if (!isPublishPage && activeTab === 'publish') {
      setActiveTab('my-materials')
      if (location.pathname !== '/academy') {
        navigate('/academy', { replace: true })
      }
    }
  }, [isPublishPage, activeTab, navigate, location.pathname])

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
          setPublishing(false)
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
        // Очищаем черновик
        localStorage.removeItem('academy_publish_draft')
        // Очищаем форму
        setPublishForm({ 
          title: '', 
          description: '', 
          type: 'article', 
          price: 25, 
          content: '',
          gameMode: 'long',
          quiz: null
        })
        setQuizQuestions([])
        // Перезагружаем данные
        loadData()
        // Перенаправляем на главную страницу академии
        navigate('/academy')
      } else {
        // Статьи создают игроки - требуют верификации
        await apiClient.post('/academy/publish', publishData)
        alert('Статья отправлена на верификацию администратором!')
        // Очищаем черновик
        localStorage.removeItem('academy_publish_draft')
        // Очищаем форму
        setPublishForm({ 
          title: '', 
          description: '', 
          type: 'article', 
          price: 25, 
          content: '',
          gameMode: 'long',
          quiz: null
        })
        setQuizQuestions([])
        // Перезагружаем данные
        loadData()
        // Перенаправляем на главную страницу академии
        navigate('/academy')
      }
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
      <PageLayout title="Опубликовать материал" subtitle="Создайте свою статью или курс" showBack={true}>
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
        <div style={{ fontSize: '12px', color: '#9FA3AE', marginTop: '4px', marginBottom: '6px' }}>
          При каждой покупке вашей статьи вы получаете <strong>20% от указанной стоимости</strong> в NAR.
        </div>
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
        { id: 'my-materials', label: 'Купленные материалы', active: activeTab === 'my-materials', onClick: () => { setActiveTab('my-materials'); navigate('/academy') } },
        { id: 'courses', label: 'Курсы', active: activeTab === 'courses', onClick: () => { setActiveTab('courses'); navigate('/academy') } },
        { id: 'articles', label: 'Статьи', active: activeTab === 'articles', onClick: () => { setActiveTab('articles'); navigate('/academy') } },
        { id: 'publish', label: 'Опубликовать свое', active: activeTab === 'publish' || isPublishPage, onClick: () => { setActiveTab('publish'); navigate('/academy/publish') } },
      ]}
    >
      <div className="academy-content">
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
                  <img src="/img/шляпа.png" alt="course" className="academy-hat-icon" />
                </div>
                <div className="academy-grid-card-title">{item.title}</div>
                <div className="academy-grid-card-author">{item.author}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'courses' && (() => {
          console.log('[Academy] Rendering courses tab - courses state:', courses.length, 'courses:', courses)
          // Фильтруем только по типу материала (course) и gameMode, НЕ исключаем купленные
          const filteredByType = courses.filter(course => {
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
          })
          
          // Проверяем, все ли материалы куплены
          const allPurchased = filteredByType.length > 0 && filteredByType.every(course => course.purchased)
          
          // Исключаем купленные только в конце
          const filtered = filteredByType.filter(course => !course.purchased)
          
          console.log('[Academy] Rendering courses tab - total:', courses.length, 'filtered:', filtered.length, 'filtered items:', filtered)
          
          // Если все материалы куплены, показываем сообщение
          if (allPurchased) {
            return (
              <div className="academy-grid">
                <div style={{ 
                  gridColumn: '1 / -1', 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  color: '#B6B6B6',
                  fontSize: '16px',
                  lineHeight: '1.6'
                }}>
                  <p style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 500, color: '#fff' }}>
                    Вы уже приобрели все курсы по этому разделу
                  </p>
                  <p style={{ fontSize: '14px', color: '#999' }}>
                    Ожидайте, возможно в будущем появятся новые материалы
                  </p>
                </div>
              </div>
            )
          }
          
          return (
            <div className="academy-grid">
              {filtered.map((course) => (
                <div key={course.id} className="academy-grid-card" onClick={() => handleOpen(course)}>
                  <div className="academy-grid-card-icon">
                    <img src="/img/шляпа.png" alt="course" className="academy-hat-icon" />
                  </div>
                  <div className="academy-grid-card-title">{course.title}</div>
                  <div className="academy-grid-card-author">{course.author}</div>
                </div>
              ))}
            </div>
          )
        })()}

        {activeTab === 'articles' && (() => {
          console.log('[Academy] Rendering articles tab - articles state:', articles.length, 'articles:', articles)
          // Фильтруем только по типу материала (article) и gameMode, НЕ исключаем купленные
          const filteredByType = articles.filter(article => {
            // Проверяем тип материала
            if (article.type !== 'article') {
              return false
            }
            
            // Сначала проверяем gameMode если он установлен (приоритет)
            if (article.gameMode) {
              return article.gameMode === activeFilter
            }
            
            // Если нет gameMode, проверяем ключевые слова в названии
            const titleLower = (article.title || '').toLowerCase()
            const isLongKeyword = titleLower.includes('длинн')
            const isShortKeyword = titleLower.includes('коротк')
            
            if (isLongKeyword && !isShortKeyword) {
              return activeFilter === 'long'
            }
            if (isShortKeyword && !isLongKeyword) {
              return activeFilter === 'short'
            }
            
            // Если нет gameMode и нет ключевых слов в названии, не включаем материал
            // (материал должен иметь явное указание на тип нард)
            return false
          })
          
          // Исключаем купленные только в конце
          const filtered = filteredByType.filter(article => !article.purchased)
          
          // Проверяем, все ли материалы куплены
          // Если есть материалы по фильтру И все они куплены (т.е. filtered пустой), показываем сообщение
          const allPurchased = filteredByType.length > 0 && filtered.length === 0
          
          console.log('[Academy] Rendering articles tab - total:', articles.length, 'filteredByType:', filteredByType.length, 'filteredByType items:', filteredByType.map(a => ({ id: a.id, title: a.title, purchased: a.purchased, gameMode: a.gameMode })), 'filtered (not purchased):', filtered.length, 'allPurchased:', allPurchased, 'activeFilter:', activeFilter)
          
          // Если все материалы куплены, показываем сообщение
          if (allPurchased) {
            return (
              <div className="academy-grid">
                <div style={{ 
                  gridColumn: '1 / -1', 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  color: '#B6B6B6',
                  fontSize: '16px',
                  lineHeight: '1.6'
                }}>
                  <p style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 500, color: '#fff' }}>
                    Вы уже приобрели все статьи по этому разделу
                  </p>
                  <p style={{ fontSize: '14px', color: '#999' }}>
                    Ожидайте, возможно в будущем появятся новые материалы
                  </p>
                </div>
              </div>
            )
          }
          
          // Если нет статей по фильтру, показываем пустую сетку
          if (filteredByType.length === 0) {
            return (
              <div className="academy-grid">
                <div style={{ 
                  gridColumn: '1 / -1', 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  color: '#B6B6B6',
                  fontSize: '16px',
                  lineHeight: '1.6'
                }}>
                  <p style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 500, color: '#fff' }}>
                    Статей по этому разделу пока нет
                  </p>
                </div>
              </div>
            )
          }
          
          return (
            <div className="academy-grid">
              {filtered.map((article) => (
                <div key={article.id} className="academy-grid-card" onClick={() => handleOpen(article)}>
                  <div className="academy-grid-card-icon">
                    <img src="/img/шляпа.png" alt="article" className="academy-hat-icon" />
                  </div>
                  <div className="academy-grid-card-title">{article.title}</div>
                  <div className="academy-grid-card-author">{article.author}</div>
                </div>
              ))}
            </div>
          )
        })()}


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
                    <img src="/img/шляпа.png" alt="material" className="academy-hat-icon" />
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
      {showPurchaseModal && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: '0px',
            left: '0px',
            right: '0px',
            bottom: '0px',
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '20px',
            margin: '0',
            touchAction: 'none',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
          }}
          onClick={() => setShowPurchaseModal(null)}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              position: 'relative',
            }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="modal-title" style={{ margin: 0, color: '#FFF', fontSize: '20px', fontWeight: '600' }}>Покупка материала</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowPurchaseModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#B6B6B6',
                  fontSize: '32px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', fontSize: '16px', color: '#FFF' }}>{showPurchaseModal.title}</p>
              <p style={{ marginBottom: '20px', color: '#FFD700', fontSize: '18px', fontWeight: '600' }}>
                Цена: <strong>{showPurchaseModal.price || 0} NAR</strong>
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  className="academy-card-button"
                  onClick={() => setShowPurchaseModal(null)}
                  style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#FFF', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
                <button 
                  className="academy-card-button academy-card-button-primary"
                  onClick={() => handlePurchase(showPurchaseModal)}
                  disabled={showPurchaseModal.price > 0 && (user?.narCoin || 0) < showPurchaseModal.price}
                  style={{
                    background: showPurchaseModal.price > 0 && (user?.narCoin || 0) < showPurchaseModal.price
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)',
                    border: showPurchaseModal.price > 0 && (user?.narCoin || 0) < showPurchaseModal.price
                      ? '1px solid rgba(255, 255, 255, 0.2)'
                      : '1px solid #C93C3D',
                    color: '#FFF',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: showPurchaseModal.price > 0 && (user?.narCoin || 0) < showPurchaseModal.price
                      ? 'not-allowed'
                      : 'pointer',
                    fontWeight: '600',
                    opacity: showPurchaseModal.price > 0 && (user?.narCoin || 0) < showPurchaseModal.price ? 0.5 : 1,
                  }}
                >
                  {showPurchaseModal.price === 0 
                    ? 'Получить бесплатно' 
                    : showPurchaseModal.price > 0 && (user?.narCoin || 0) < showPurchaseModal.price
                    ? 'Недостаточно средств'
                    : `Купить за ${showPurchaseModal.price} NAR`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </PageLayout>
  )
}
