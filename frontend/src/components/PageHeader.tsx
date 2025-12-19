import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export default function PageHeader({ title, showBack = true, rightAction }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="page-header">
      {showBack && (
        <button className="back-button" onClick={() => navigate(-1)}>
          ←
        </button>
      )}
      <div className="page-header-title">{title}</div>
      {rightAction && <div style={{ width: 32 }}>{rightAction}</div>}
      {!rightAction && showBack && <div style={{ width: 32 }} />}
    </div>
  )
}

