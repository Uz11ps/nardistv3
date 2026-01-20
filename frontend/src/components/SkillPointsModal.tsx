import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import apiClient from '../api/client'
import { CoinIcon, EnergyIcon, HeartIcon } from './Icons'
import './SkillPointsModal.css'

interface SkillPointsModalProps {
  isOpen: boolean
  onClose: () => void
  skillPoints: {
    total: number
    free: number
    economy: number
    energy: number
    lives: number
    power: number
  }
  onUpdate: () => void
}

export default function SkillPointsModal({
  isOpen,
  onClose,
  skillPoints,
  onUpdate,
}: SkillPointsModalProps) {
  const [distributing, setDistributing] = useState<string | null>(null)
  const [localPoints, setLocalPoints] = useState(skillPoints)

  useEffect(() => {
    setLocalPoints(skillPoints)
  }, [skillPoints])

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

  if (!isOpen) return null

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
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647,
    padding: '12px',
    margin: '0',
    border: 'none',
    outline: 'none',
    touchAction: 'none',
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  }

  const handleDistribute = async (type: 'economy' | 'energy' | 'lives' | 'power', amount: number) => {
    if (localPoints.free < amount || distributing) return

    try {
      setDistributing(type)
      await apiClient.post('/progress/skill-points/distribute', { type, amount })
      await onUpdate()
      alert(`${amount} SP успешно распределено в ветку ${type === 'economy' ? 'Экономика' : type === 'energy' ? 'Энергия' : type === 'lives' ? 'Жизни' : 'Сила'}`)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при распределении SP')
    } finally {
      setDistributing(null)
    }
  }

  const branches = [
    {
      id: 'economy' as const,
      name: 'Экономика',
      icon: <CoinIcon size={24} />,
      description: 'Снижение комиссии, пассивный доход',
      current: localPoints.economy,
    },
    {
      id: 'energy' as const,
      name: 'Энергия',
      icon: <EnergyIcon size={24} />,
      description: 'Максимум энергии, регенерация',
      current: localPoints.energy,
    },
    {
      id: 'lives' as const,
      name: 'Жизни',
      icon: <HeartIcon size={24} />,
      description: 'Максимум жизней, защита от потери',
      current: localPoints.lives,
    },
    {
      id: 'power' as const,
      name: 'Сила',
      icon: '💪',
      description: 'Лимит веса скинов',
      current: localPoints.power,
    },
  ]

  return createPortal(
    <div className="skill-points-modal-overlay" onClick={onClose} style={overlayStyle}>
      <div 
        className="skill-points-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
          padding: '0', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
          width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
        }}
      >
        <div className="skill-points-modal-header">
          <h3>Распределение Skill Points</h3>
          <button className="skill-points-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="skill-points-modal-content">
          <div className="skill-points-info">
            <div className="skill-points-free">
              Свободных SP: <span style={{ color: '#ffd700', fontWeight: 600 }}>{localPoints.free}</span>
            </div>
          </div>

          <div className="skill-points-branches">
            {branches.map((branch) => (
              <div key={branch.id} className="skill-points-branch">
                <div className="skill-points-branch-header">
                  <div className="skill-points-branch-icon">{branch.icon}</div>
                  <div className="skill-points-branch-info">
                    <div className="skill-points-branch-name">{branch.name}</div>
                    <div className="skill-points-branch-description">{branch.description}</div>
                    <div className="skill-points-branch-current">
                      Текущий уровень: {branch.current} SP
                    </div>
                  </div>
                </div>
                <div className="skill-points-branch-actions">
                  <button
                    className="skill-points-btn"
                    onClick={() => handleDistribute(branch.id, 1)}
                    disabled={localPoints.free < 1 || distributing !== null}
                  >
                    +1
                  </button>
                  <button
                    className="skill-points-btn"
                    onClick={() => handleDistribute(branch.id, 5)}
                    disabled={localPoints.free < 5 || distributing !== null}
                  >
                    +5
                  </button>
                  <button
                    className="skill-points-btn"
                    onClick={() => handleDistribute(branch.id, 10)}
                    disabled={localPoints.free < 10 || distributing !== null}
                  >
                    +10
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

