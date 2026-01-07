import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'
import './OffsetModal.css'

interface OffsetModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  myOffset: number
  opponentOffset: number
  onOffsetChange: (value: number) => void
  rngHash?: string | null
}

export default function OffsetModal({
  isOpen,
  onClose,
  onConfirm,
  myOffset,
  opponentOffset,
  onOffsetChange,
  rngHash,
}: OffsetModalProps) {
  // Блокируем скролл body когда модальное окно открыто
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div className="offset-modal-overlay" onClick={handleOverlayClick}>
      <div className="offset-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Выбор смещения</h2>
        <p className="offset-modal-description">
          Выберите смещение для контроля честности игры. Каждый игрок выбирает свое смещение независимо (от 1 до 5).
        </p>
        
        <div className="offset-selector">
          <label>Ваше смещение (1-5):</label>
          <p className="offset-hint">
            Смещение влияет на выбор начальной позиции в последовательности бросков кубиков
          </p>
          <input 
            type="range" 
            min="1" 
            max="5" 
            value={myOffset} 
            onChange={(e) => onOffsetChange(parseInt(e.target.value))}
          />
          <div className="offset-values">
            <span>Вы: <strong>{myOffset}</strong></span>
            {opponentOffset > 0 && (
              <span>Соперник: <strong>{opponentOffset}</strong></span>
            )}
          </div>
        </div>

        {rngHash && (
          <div className="hash-display">
            <div>Хеш последовательности (SHA-256):</div>
            <code>
              {(() => {
                try {
                  if (typeof rngHash === 'string') {
                    const parsed = JSON.parse(rngHash)
                    if (parsed && parsed.p1Hash) {
                      return parsed.p1Hash.substring(0, 16) + '...'
                    }
                  }
                  return rngHash.substring(0, 16) + '...'
                } catch (e) {
                  return typeof rngHash === 'string' 
                    ? rngHash.substring(0, 16) + '...'
                    : '---'
                }
              })()}
            </code>
          </div>
        )}

        <div className="offset-modal-actions">
          <Button 
            variant="primary" 
            onClick={onConfirm} 
            style={{ flex: 1 }}
          >
            Подтвердить
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

