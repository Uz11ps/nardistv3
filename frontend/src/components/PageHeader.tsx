import { useNavigate } from 'react-router-dom'
import arrowBackIcon from '../assets/arrow-back.svg'

interface PageHeaderProps {
  title: string
  showBack?: boolean
  rightAction?: React.ReactNode
  onBack?: () => void
}

export default function PageHeader({ title, showBack = true, rightAction, onBack }: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="page-header">
      {showBack && (
        <button className="back-button page-header-back-btn" onClick={handleBack}>
          <img src={arrowBackIcon} alt="back" style={{ width: '9px', height: '16px' }} />
        </button>
      )}
      <div className="page-header-title">{title}</div>
      {rightAction && <div style={{ width: 32 }}>{rightAction}</div>}
      {!rightAction && showBack && <div style={{ width: 32 }} />}
    </div>
  )
}

