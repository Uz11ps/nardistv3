import { useEffect, useState } from 'react'
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
  const [windowSize, setWindowSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 480, height: typeof window !== 'undefined' ? window.innerHeight : 800 })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }

    window.addEventListener('resize', updateSize)
    updateSize()

    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Блокируем скролл body когда модальное окно открыто
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.height = '100%'
      
      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.height = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  // Inline стили для мгновенного позиционирования (до применения CSS)
  const isMobile = windowSize.width <= 480
  const isSmallHeight = windowSize.height <= 600

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: '0px',
    left: '0px',
    right: '0px',
    bottom: '0px',
    width: '100vw',
    height: '100vh',
    minWidth: '100vw',
    minHeight: '100vh',
    maxWidth: '100vw',
    maxHeight: '100vh',
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647, // Максимальный z-index
    padding: isMobile ? '12px' : '16px',
    margin: '0',
    border: 'none',
    outline: 'none',
    touchAction: 'none',
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  }

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    margin: '0',
    background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
    padding: isSmallHeight ? '12px' : isMobile ? '16px' : '20px',
    borderRadius: '16px',
    textAlign: 'center',
    maxWidth: isMobile ? `calc(100vw - 24px)` : '400px',
    width: '100%',
    maxHeight: `calc(100vh - ${isMobile ? '24px' : '32px'})`,
    overflowY: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
    transform: 'none',
    animation: 'none',
    transition: 'none',
  }

  return createPortal(
    <div 
      className="offset-modal-overlay" 
      onClick={handleOverlayClick}
      style={overlayStyle}
    >
      <div 
        className="offset-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={contentStyle}
      >
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
