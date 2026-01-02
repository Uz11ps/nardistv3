import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import './GameAnalytics.css'

interface GameAnalyticsProps {
  gameId: string
}

export default function GameAnalytics({ gameId }: GameAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [gameId])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/games/${gameId}/analytics`)
      setAnalytics(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка загрузки аналитики')
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (analytics?.text) {
      navigator.clipboard.writeText(analytics.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (analytics?.text) {
      const blob = new Blob([analytics.text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `game_${gameId}_analytics.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  if (loading) {
    return <div className="game-analytics-loading">Загрузка аналитики...</div>
  }

  if (error) {
    return <div className="game-analytics-error">Ошибка: {error}</div>
  }

  if (!analytics) {
    return <div className="game-analytics-error">Данные аналитики не найдены</div>
  }

  return (
    <div className="game-analytics">
      <div className="game-analytics-header">
        <h3>Аналитика игры</h3>
        <div className="game-analytics-actions">
          <button 
            className="game-analytics-btn" 
            onClick={handleCopy}
            disabled={copied}
          >
            {copied ? 'Скопировано!' : 'Копировать'}
          </button>
          <button 
            className="game-analytics-btn" 
            onClick={handleDownload}
          >
            Скачать
          </button>
        </div>
      </div>
      
      <div className="game-analytics-content">
        <pre className="game-analytics-text">{analytics.text}</pre>
      </div>

      <div className="game-analytics-info">
        <div className="analytics-info-item">
          <span className="info-label">Игрок 1:</span>
          <span className="info-value">{analytics.game.player1.name}</span>
        </div>
        <div className="analytics-info-item">
          <span className="info-label">Игрок 2:</span>
          <span className="info-value">{analytics.game.player2.name}</span>
        </div>
        <div className="analytics-info-item">
          <span className="info-label">Режим:</span>
          <span className="info-value">{analytics.game.mode === 'LONG' ? 'Длинные нарды' : 'Короткие нарды'}</span>
        </div>
        <div className="analytics-info-item">
          <span className="info-label">Ходов:</span>
          <span className="info-value">{analytics.moves.length}</span>
        </div>
        <div className="analytics-info-item">
          <span className="info-label">Смещение (белые):</span>
          <span className="info-value">{analytics.game.p1Offset}</span>
        </div>
        <div className="analytics-info-item">
          <span className="info-label">Смещение (черные):</span>
          <span className="info-value">{analytics.game.p2Offset}</span>
        </div>
      </div>
    </div>
  )
}

