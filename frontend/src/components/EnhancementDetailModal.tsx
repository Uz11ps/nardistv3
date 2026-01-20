import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './EnhancementDetailModal.css'

interface EnhancementDetailModalProps {
  isOpen: boolean
  onClose: () => void
  enhancement: {
    id: string
    name: string
    icon: React.ReactNode
    description: string
    details: string[]
    currentSp?: number
  } | null
}

// Функции расчета бафов (копия логики с бэкенда)
const calculateMaxEnergy = (energySp: number): number => {
  const baseMax = 100
  const maxStep1Sp = 30
  const maxStep1K = 4
  const maxStep2K = 2
  const step1Bonus = maxStep1K * Math.min(energySp, maxStep1Sp)
  const step2Bonus = maxStep2K * Math.max(energySp - maxStep1Sp, 0)
  return baseMax + step1Bonus + step2Bonus
}

const calculateEnergyRegenPerHour = (energySp: number): number => {
  const regenBasePerH = 10
  const regenStep1Sp = 20
  const regenStep1K = 1.0
  const regenStep2Sp = 20
  const regenStep2K = 0.5
  const step1Regen = regenStep1K * Math.min(energySp, regenStep1Sp)
  const step2Regen = regenStep2K * Math.min(Math.max(energySp - regenStep1Sp, 0), regenStep2Sp)
  return regenBasePerH + step1Regen + step2Regen
}

const calculateMaxLives = (livesSp: number): number => {
  const baseMax = 5
  const maxStep1Sp = 30
  const maxStep1K = 0.2
  const maxStep2K = 0.1
  const step1Bonus = maxStep1K * Math.min(livesSp, maxStep1Sp)
  const step2Bonus = maxStep2K * Math.max(livesSp - maxStep1Sp, 0)
  return Math.round((baseMax + step1Bonus + step2Bonus) * 10) / 10
}

const calculateLivesRegenPerHour = (livesSp: number): number => {
  const regenBasePerH = 0.25
  const regenSpCap = 30
  const regenSpStep = 10
  const regenBonus = Math.floor(Math.min(livesSp, regenSpCap) / regenSpStep) * 0.25
  return Math.round((regenBasePerH + regenBonus) * 100) / 100
}

const calculateEconomyCommissionReduction = (econSp: number): number => {
  const step1Sp = 20
  const step1K = 0.0025
  const step2Sp = 20
  const step2K = 0.0015
  const reductionCap = 0.08
  const step1Reduction = step1K * Math.min(econSp, step1Sp)
  const step2Reduction = step2K * Math.min(Math.max(econSp - step1Sp, 0), step2Sp)
  const totalReduction = step1Reduction + step2Reduction
  return Math.min(totalReduction, reductionCap)
}

const calculatePassiveIncomeMultiplier = (econSp: number): number => {
  const passiveK = 0.015
  const passiveSpCap = 40
  return 1 + passiveK * Math.min(econSp, passiveSpCap)
}

const calculateWeightLimit = (powerSp: number): number => {
  const weightBase = 10
  const weightK = 2.5
  return weightBase + weightK * powerSp
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

  const currentSp = enhancement.currentSp || 0
  const nextSp = currentSp + 1
  
  // Рассчитываем бафы для текущего и следующего уровня
  let currentBuffs: Array<{ label: string; current: string; next: string }> = []
  let nextBuffs: Array<{ label: string; current: string; next: string }> = []

  if (enhancement.id === 'energy') {
    const currentMax = calculateMaxEnergy(currentSp)
    const nextMax = calculateMaxEnergy(nextSp)
    const currentRegen = calculateEnergyRegenPerHour(currentSp)
    const nextRegen = calculateEnergyRegenPerHour(nextSp)
    currentBuffs = [
      { label: 'Максимум энергии', current: `${Math.round(currentMax)}`, next: `${Math.round(nextMax)}` },
      { label: 'Регенерация в час', current: `${currentRegen.toFixed(1)}`, next: `${nextRegen.toFixed(1)}` }
    ]
  } else if (enhancement.id === 'lives') {
    const currentMax = calculateMaxLives(currentSp)
    const nextMax = calculateMaxLives(nextSp)
    const currentRegen = calculateLivesRegenPerHour(currentSp)
    const nextRegen = calculateLivesRegenPerHour(nextSp)
    currentBuffs = [
      { label: 'Максимум жизней', current: `${currentMax}`, next: `${nextMax}` },
      { label: 'Регенерация в час', current: `${currentRegen.toFixed(2)}`, next: `${nextRegen.toFixed(2)}` }
    ]
  } else if (enhancement.id === 'economy') {
    const currentReduction = calculateEconomyCommissionReduction(currentSp)
    const nextReduction = calculateEconomyCommissionReduction(nextSp)
    const currentMultiplier = calculatePassiveIncomeMultiplier(currentSp)
    const nextMultiplier = calculatePassiveIncomeMultiplier(nextSp)
    currentBuffs = [
      { label: 'Снижение комиссии', current: `${(currentReduction * 100).toFixed(2)}%`, next: `${(nextReduction * 100).toFixed(2)}%` },
      { label: 'Множитель дохода', current: `${(currentMultiplier * 100).toFixed(1)}%`, next: `${(nextMultiplier * 100).toFixed(1)}%` }
    ]
  } else if (enhancement.id === 'power') {
    const currentWeight = calculateWeightLimit(currentSp)
    const nextWeight = calculateWeightLimit(nextSp)
    currentBuffs = [
      { label: 'Лимит веса скинов', current: `${currentWeight.toFixed(1)}`, next: `${nextWeight.toFixed(1)}` }
    ]
  }

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

  return createPortal(
    <div className="enhancement-detail-modal-overlay" onClick={onClose} style={overlayStyle}>
      <div 
        className="enhancement-detail-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', margin: '0', background: 'linear-gradient(180deg, #1C1D21 2.86%, #0B0C0E 100%)',
          padding: '0', borderRadius: '16px', textAlign: 'center', maxWidth: '90vw',
          width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)', transform: 'none', animation: 'none', transition: 'none',
        }}
      >
        <div className="enhancement-detail-header">
          <div className="enhancement-detail-icon">{enhancement.icon}</div>
          <h3>{enhancement.name}</h3>
          <button className="enhancement-detail-close" onClick={onClose}>×</button>
        </div>
        <div className="enhancement-detail-content">
          <p className="enhancement-detail-description">{enhancement.description}</p>
          
          {currentBuffs.length > 0 && (
            <div className="enhancement-buffs-section">
              <h4 className="enhancement-buffs-title">Бафы при прокачке:</h4>
              <div className="enhancement-buffs-list">
                {currentBuffs.map((buff, index) => (
                  <div key={index} className="enhancement-buff-item">
                    <span className="enhancement-buff-label">{buff.label}:</span>
                    <div className="enhancement-buff-values">
                      <span className="enhancement-buff-current">{buff.current}</span>
                      <span className="enhancement-buff-arrow">→</span>
                      <span className="enhancement-buff-next">{buff.next}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="enhancement-detail-footer">
          <button className="enhancement-detail-btn" onClick={onClose}>Понятно</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

