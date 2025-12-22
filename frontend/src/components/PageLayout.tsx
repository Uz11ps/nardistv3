import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './PageLayout.css'

interface PageLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  showBack?: boolean
  tabs?: Array<{ id: string; label: string; active?: boolean; onClick?: () => void }>
}

export default function PageLayout({ title, subtitle, children, showBack = true, tabs }: PageLayoutProps) {
  const navigate = useNavigate()

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
        </div>

        {/* Tabs */}
        {tabs && tabs.length > 0 && (
          <div className="page-layout-tabs">
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
    </div>
  )
}

