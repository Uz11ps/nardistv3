import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './Policy.css'

export default function Policy() {
  const { type } = useParams<{ type: 'privacy' | 'agreement' }>()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (type) {
      loadPolicy()
    }
  }, [type])

  const loadPolicy = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/policy/${type}`).catch(() => ({ data: { content: 'Политика еще не создана' } }))
      setContent(response.data.content || 'Политика еще не создана')
    } catch (error) {
      console.error('Failed to load policy:', error)
      setContent('Ошибка загрузки политики')
    } finally {
      setLoading(false)
    }
  }

  const title = type === 'privacy' ? 'Политика конфиденциальности' : 'Политика соглашения'

  return (
    <PageLayout title={title} showBack={true}>
      <div className="policy-content">
        {loading ? (
          <div className="policy-loading">Загрузка...</div>
        ) : (
          <div className="policy-text" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} />
        )}
      </div>
    </PageLayout>
  )
}

