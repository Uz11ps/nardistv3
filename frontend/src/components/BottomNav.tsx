import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiClient } from '../api/client'
import Icon from './Icon'
import './BottomNav.css'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [hasUnclaimedQuests, setHasUnclaimedQuests] = useState(false)

  useEffect(() => {
    checkUnclaimedQuests()
    // Проверяем каждые 30 секунд
    const interval = setInterval(checkUnclaimedQuests, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkUnclaimedQuests = async () => {
    try {
      // Загружаем все квесты (daily и weekly)
      const [dailyResponse, weeklyResponse] = await Promise.all([
        apiClient.get('/quests/daily').catch(() => ({ data: { quests: [] } })),
        apiClient.get('/quests/weekly').catch(() => ({ data: { quests: [] } })),
      ])
      
      const allQuests = [
        ...(dailyResponse.data?.quests || []),
        ...(weeklyResponse.data?.quests || []),
      ]
      
      // Проверяем, есть ли квесты с completed === true и claimed === false
      const hasUnclaimed = allQuests.some((quest: any) => 
        quest.completed === true && quest.claimed === false
      )
      
      setHasUnclaimedQuests(hasUnclaimed)
    } catch (error) {
      console.error('Failed to check unclaimed quests:', error)
    }
  }

  const navItems = [
    { path: '/', icon: '/img/Vectorhome.png', label: 'Главная', hasBadge: false },
    { path: '/tournaments', icon: '/img/fi-rr-badge.png', label: 'Турниры', hasBadge: false },
    { path: '/academy', icon: '/img/fi-rr-book-alt.png', label: 'Академия', hasBadge: false },
    { path: '/shop', icon: '/img/fi-rr-shop.png', label: 'Магазин', hasBadge: false },
    { path: '/city', icon: '/img/fi-rs-building.png', label: 'Город', hasBadge: false },
  ]

  // Проверяем, есть ли вкладка "Задания" в меню на главной странице
  // Если есть невыполненные квесты, показываем индикатор на главной странице
  const homeBadge = hasUnclaimedQuests

  return (
    <div className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => {
            navigate(item.path)
            // Обновляем проверку при переходе на главную страницу (где есть меню с квестами)
            if (item.path === '/') {
              setTimeout(checkUnclaimedQuests, 500)
            }
          }}
          style={{ transition: 'all 0.2s ease', position: 'relative' }}
        >
          <span className="nav-item-icon" style={{ position: 'relative' }}>
            <img src={item.icon} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: location.pathname === item.path ? 1 : 0.5 }} />
            {item.path === '/' && homeBadge && (
              <span className="nav-item-badge" />
            )}
          </span>
          <span style={{ fontSize: 'inherit', lineHeight: '1.2', textAlign: 'center' }}>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

