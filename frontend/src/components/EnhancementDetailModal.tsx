import React from 'react'
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
  if (!isOpen || !enhancement) return null

  return (
    <div className="enhancement-detail-modal-overlay" onClick={onClose}>
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
    </div>
  )
}

