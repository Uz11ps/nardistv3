import { useEffect, useState, useRef } from 'react'
import './Dice3D.css'

interface Dice3DProps {
  values: number[]
  animating?: boolean
  diceColor?: string // Цвет кости из diceConfig
  used?: boolean
}

export default function Dice3D({ values, animating = false, diceColor = '#FFFFFF', used = false }: Dice3DProps) {
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
          diceColor={diceColor}
        />
      ))}
    </div>
  )
}

interface DieProps {
  value: number
  isRolling: boolean
  delay: number
  diceColor: string
}

function Die({ value, isRolling, delay, diceColor }: DieProps) {
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
          transform: isRolling ? undefined : getRotation(value),
          backgroundColor: diceColor,
        }}
      >
        <div className="die-face face-1" style={{ backgroundColor: diceColor }}>{renderNumber(1)}</div>
        <div className="die-face face-2" style={{ backgroundColor: diceColor }}>{renderNumber(2)}</div>
        <div className="die-face face-3" style={{ backgroundColor: diceColor }}>{renderNumber(3)}</div>
        <div className="die-face face-4" style={{ backgroundColor: diceColor }}>{renderNumber(4)}</div>
        <div className="die-face face-5" style={{ backgroundColor: diceColor }}>{renderNumber(5)}</div>
        <div className="die-face face-6" style={{ backgroundColor: diceColor }}>{renderNumber(6)}</div>
      </div>
    </div>
  )
}

// Рисуем цифру вместо точек
function renderNumber(value: number) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#000',
      textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
    }}>
      {value}
    </div>
  )
}
