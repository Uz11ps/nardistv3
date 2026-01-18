import { ReactNode, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'
import './PageLayout.css'

interface PageLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  showBack?: boolean
  tabs?: Array<{ id: string; label: string; active?: boolean; onClick?: () => void }>
  rightAction?: ReactNode
  showBottomNav?: boolean
}

export default function PageLayout({ 
  title, 
  subtitle, 
  children, 
  showBack = true, 
  tabs, 
  rightAction,
  showBottomNav = true 
}: PageLayoutProps) {
  const navigate = useNavigate()
  const tabsRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)

  useEffect(() => {
    const tabsElement = tabsRef.current
    if (!tabsElement) return

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      startXRef.current = e.pageX - tabsElement.offsetLeft
      scrollLeftRef.current = tabsElement.scrollLeft
      tabsElement.style.cursor = 'grabbing'
      tabsElement.style.userSelect = 'none'
    }

    const handleMouseLeave = () => {
      isDraggingRef.current = false
      tabsElement.style.cursor = 'grab'
      tabsElement.style.userSelect = ''
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      tabsElement.style.cursor = 'grab'
      tabsElement.style.userSelect = ''
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      const x = e.pageX - tabsElement.offsetLeft
      const walk = (x - startXRef.current) * 2 // Скорость скролла
      tabsElement.scrollLeft = scrollLeftRef.current - walk
    }

    const handleTouchStart = (e: TouchEvent) => {
      isDraggingRef.current = true
      startXRef.current = e.touches[0].pageX - tabsElement.offsetLeft
      scrollLeftRef.current = tabsElement.scrollLeft
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      const x = e.touches[0].pageX - tabsElement.offsetLeft
      const walk = (x - startXRef.current) * 2
      tabsElement.scrollLeft = scrollLeftRef.current - walk
    }

    const handleTouchEnd = () => {
      isDraggingRef.current = false
    }

    // Устанавливаем начальный курсор
    tabsElement.style.cursor = 'grab'

    tabsElement.addEventListener('mousedown', handleMouseDown)
    tabsElement.addEventListener('mouseleave', handleMouseLeave)
    tabsElement.addEventListener('mouseup', handleMouseUp)
    tabsElement.addEventListener('mousemove', handleMouseMove)
    tabsElement.addEventListener('touchstart', handleTouchStart, { passive: false })
    tabsElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    tabsElement.addEventListener('touchend', handleTouchEnd)

    return () => {
      tabsElement.removeEventListener('mousedown', handleMouseDown)
      tabsElement.removeEventListener('mouseleave', handleMouseLeave)
      tabsElement.removeEventListener('mouseup', handleMouseUp)
      tabsElement.removeEventListener('mousemove', handleMouseMove)
      tabsElement.removeEventListener('touchstart', handleTouchStart)
      tabsElement.removeEventListener('touchmove', handleTouchMove)
      tabsElement.removeEventListener('touchend', handleTouchEnd)
    }
  }, [tabs])

  return (
    <div className="page-layout">
      <div className="page-layout-background" />
      <div className="page-layout-content">
        {/* Header */}
        <div className="page-layout-header">
          {showBack && (
            <button className="page-layout-back-button" onClick={() => navigate(-1)}>
              ←
            </button>
          )}
          <div className="page-layout-title-section">
            <h1 className="page-layout-title">{title}</h1>
            {subtitle && <p className="page-layout-subtitle">{subtitle}</p>}
          </div>
          {rightAction && (
            <div className="page-layout-right-action">
              {rightAction}
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabs && tabs.length > 0 && (
          <div className="page-layout-tabs" ref={tabsRef}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`page-layout-tab ${tab.active ? 'active' : ''}`}
                onClick={tab.onClick}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="page-layout-body">{children}</div>
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  )
}

