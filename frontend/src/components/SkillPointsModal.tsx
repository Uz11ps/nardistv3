import { useState, useEffect } from 'react'
import apiClient from '../api/client'
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

  if (!isOpen) return null

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
      icon: '💰',
      description: 'Снижение комиссии, пассивный доход',
      current: localPoints.economy,
    },
    {
      id: 'energy' as const,
      name: 'Энергия',
      icon: '⚡',
      description: 'Максимум энергии, регенерация',
      current: localPoints.energy,
    },
    {
      id: 'lives' as const,
      name: 'Жизни',
      icon: '❤️',
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

  return (
    <div className="skill-points-modal-overlay" onClick={onClose}>
      <div className="skill-points-modal" onClick={(e) => e.stopPropagation()}>
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
    </div>
  )
}

