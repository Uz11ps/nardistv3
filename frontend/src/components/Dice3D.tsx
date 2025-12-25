import { useEffect, useState, useRef } from 'react'
import './Dice3D.css'

interface Dice3DProps {
  values: number[]
  animating?: boolean
  diceTextures?: { [face: number]: HTMLImageElement }
  used?: boolean
}

export default function Dice3D({ values, animating = false, diceTextures, used = false }: Dice3DProps) {
  const [displayValues, setDisplayValues] = useState<number[]>(values)
  const [internalAnimating, setInternalAnimating] = useState(false)
  const lastValues = useRef<number[]>(values)

  useEffect(() => {
    // Обновляем значения если они изменились, но не запускаем внутреннюю анимацию
    // Внутренняя анимация запускается только при реальном изменении значений (новый бросок)
    // Внешняя анимация (animating prop) управляется родительским компонентом
    if (JSON.stringify(values) !== JSON.stringify(lastValues.current)) {
      setDisplayValues(values)
      lastValues.current = values
    }
  }, [values])

  const isRolling = animating || internalAnimating

  return (
    <div className="dice3d-scene">
      {displayValues.map((value, index) => (
        <Die 
          key={`${index}-${lastValues.current[index]}-${value}`} 
          value={value} 
          isRolling={isRolling} 
          delay={index * 0.1}
        />
      ))}
    </div>
  )
}

interface DieProps {
  value: number
  isRolling: boolean
  delay: number
}

function Die({ value, isRolling, delay }: DieProps) {
  // Определяем вращение для каждой грани
  const getRotation = (v: number) => {
    switch (v) {
      case 1: return 'rotateX(0deg) rotateY(0deg)'
      case 2: return 'rotateX(-90deg) rotateY(0deg)'
      case 3: return 'rotateX(0deg) rotateY(-90deg)'
      case 4: return 'rotateX(0deg) rotateY(90deg)'
      case 5: return 'rotateX(90deg) rotateY(0deg)'
      case 6: return 'rotateX(180deg) rotateY(0deg)'
      default: return 'rotateX(0deg) rotateY(0deg)'
    }
  }

  return (
    <div className="die-container" style={{ animationDelay: `${delay}s` }}>
      <div 
        className={`die ${isRolling ? 'die-rolling' : ''}`}
        style={{ 
          transform: isRolling ? undefined : getRotation(value)
        }}
      >
        <div className="die-face face-1">{renderDots(1)}</div>
        <div className="die-face face-2">{renderDots(2)}</div>
        <div className="die-face face-3">{renderDots(3)}</div>
        <div className="die-face face-4">{renderDots(4)}</div>
        <div className="die-face face-5">{renderDots(5)}</div>
        <div className="die-face face-6">{renderDots(6)}</div>
      </div>
    </div>
  )
}

function renderDots(value: number) {
  const patterns: { [key: number]: number[] } = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 1, 2, 6, 7, 8],
  }
  const dots = patterns[value] || []
  return (
    <div className="die-dots">
      {[...Array(9)].map((_, i) => (
        <div key={i} className={`die-dot ${dots.includes(i) ? 'visible' : ''}`} />
      ))}
    </div>
  )
}
