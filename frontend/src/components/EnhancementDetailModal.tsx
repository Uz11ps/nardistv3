import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './EnhancementDetailModal.css'

interface EnhancementDetailModalProps {
  isOpen: boolean
  onClose: () => void
  enhancement: {
    id: string
    name: string
    icon: string
    description: string
    details: string[]
  } | null
}

export default function EnhancementDetailModal({
  isOpen,
  onClose,
  enhancement
}: EnhancementDetailModalProps) {
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

  if (!isOpen || !enhancement) return null

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: '0px',
    left: '0px',
    right: '0px',
    bottom: '0px',
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647,
    padding: '20px',
    margin: '0',
    touchAction: 'none',
    overflow: 'hidden',
    overscrollBehavior: 'contain',
  }

  return createPortal(
    <div className="enhancement-detail-modal-overlay" onClick={onClose} style={overlayStyle}>
      <div className="enhancement-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="enhancement-detail-header">
          <div className="enhancement-detail-icon">{enhancement.icon}</div>
          <h3>{enhancement.name}</h3>
          <button className="enhancement-detail-close" onClick={onClose}>×</button>
        </div>
        <div className="enhancement-detail-content">
          <p className="enhancement-detail-description">{enhancement.description}</p>
          <div className="enhancement-detail-list">
            <h4>Что дает это улучшение:</h4>
            <ul>
              {enhancement.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="enhancement-detail-footer">
          <button className="enhancement-detail-btn" onClick={onClose}>Понятно</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

