import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import apiClient from '../api/client'
import { CoinIcon, EnergyIcon, HeartIcon, MuscleIcon, ArrowRightIcon } from './Icons'
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
      icon: <CoinIcon size={24} />,
      description: 'Снижение комиссии в играх, бонус к пассивному доходу',
    },
    {
      id: 'energy' as const,
      name: 'Энергия',
      icon: <EnergyIcon size={24} />,
      description: 'Увеличение лимита энергии и скорости восстановления',
    },
    {
      id: 'lives' as const,
      name: 'Жизни',
      icon: <HeartIcon size={24} />,
      description: 'Увеличение запаса жизней и защиты от потери',
    },
    {
      id: 'power' as const,
      name: 'Сила',
      icon: <MuscleIcon size={24} />,
      description: 'Увеличение лимита веса скинов',
    },
  ]

  return createPortal(
    <div 
      className="enhancement-modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed', top: '0px', left: '0px', right: '0px', bottom: '0px',
        width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh',
        background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 2147483647, padding: '12px', margin: '0',
        border: 'none', outline: 'none', touchAction: 'none', overflow: 'hidden',
        overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
      }}
    >
      <div 
        className="enhancement-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
          padding: '0', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
          width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
        }}
      >
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
                  <div className="enhancement-option-arrow">
                    <ArrowRightIcon size={16} style={{ color: '#707579' }} />
                  </div>
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

