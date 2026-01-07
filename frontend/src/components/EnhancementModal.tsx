import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import apiClient from '../api/client'
import './EnhancementModal.css'

interface EnhancementModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function EnhancementModal({
  isOpen,
  onClose,
  onUpdate,
}: EnhancementModalProps) {
  const [choosing, setChoosing] = useState(false)

  if (!isOpen) return null

  const handleChoose = async (type: 'economy' | 'energy' | 'lives' | 'power') => {
    if (choosing) return

    try {
      setChoosing(true)
      await apiClient.post('/progress/enhancement', { type })
      await onUpdate()
      alert('Усиление успешно выбрано!')
      onClose()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при выборе усиления')
    } finally {
      setChoosing(false)
    }
  }

  const enhancements = [
    {
      id: 'economy' as const,
      name: 'Экономика',
      icon: '💰',
      description: 'Снижение комиссии в играх, бонус к пассивному доходу',
    },
    {
      id: 'energy' as const,
      name: 'Энергия',
      icon: '⚡',
      description: 'Увеличение лимита энергии и скорости восстановления',
    },
    {
      id: 'lives' as const,
      name: 'Жизни',
      icon: '❤️',
      description: 'Увеличение запаса жизней и защиты от потери',
    },
    {
      id: 'power' as const,
      name: 'Сила',
      icon: '💪',
      description: 'Увеличение лимита веса скинов',
    },
  ]

  return (
    <div className="enhancement-modal-overlay" onClick={onClose}>
      <div className="enhancement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="enhancement-modal-header">
          <h3>Выберите усиление</h3>
          <button className="enhancement-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="enhancement-modal-content">
          <div className="enhancement-modal-info">
            Поздравляем с повышением уровня! Выберите одно из усилений:
          </div>

          <div className="enhancement-options">
            {enhancements.map((enh) => (
              <div
                key={enh.id}
                className="enhancement-option"
                onClick={() => handleChoose(enh.id)}
              >
                <div className="enhancement-option-icon">{enh.icon}</div>
                <div className="enhancement-option-info">
                  <div className="enhancement-option-name">{enh.name}</div>
                  <div className="enhancement-option-description">{enh.description}</div>
                </div>
                {choosing ? (
                  <div className="enhancement-option-loading">...</div>
                ) : (
                  <div className="enhancement-option-arrow">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

