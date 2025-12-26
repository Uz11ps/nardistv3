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
        <div className="die-face face-1" style={{ backgroundColor: diceColor }}>{renderDots(1)}</div>
        <div className="die-face face-2" style={{ backgroundColor: diceColor }}>{renderDots(2)}</div>
        <div className="die-face face-3" style={{ backgroundColor: diceColor }}>{renderDots(3)}</div>
        <div className="die-face face-4" style={{ backgroundColor: diceColor }}>{renderDots(4)}</div>
        <div className="die-face face-5" style={{ backgroundColor: diceColor }}>{renderDots(5)}</div>
        <div className="die-face face-6" style={{ backgroundColor: diceColor }}>{renderDots(6)}</div>
      </div>
    </div>
  )
}

// Рисуем точки на кубике
function renderDots(value: number) {
  // Паттерны для точек (индексы в сетке 3x3):
  // 0 1 2
  // 3 4 5
  // 6 7 8
  const patterns: { [key: number]: number[] } = {
    1: [4], // Центр
    2: [0, 8], // Диагональ: левый верхний, правый нижний
    3: [0, 4, 8], // Диагональ: все три
    4: [0, 2, 6, 8], // Четыре угла
    5: [0, 2, 4, 6, 8], // Четыре угла + центр
    6: [0, 3, 6, 2, 5, 8], // Две колонки: левая (0,3,6) и правая (2,5,8)
  }
  
  const dots = patterns[value] || []
  const dotSize = 7
  const containerSize = 50
  const padding = 10
  const cellSize = (containerSize - padding * 2) / 3
  const dotOffset = (cellSize - dotSize) / 2
  
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
    }}>
      {dots.map((index) => {
        const row = Math.floor(index / 3)
        const col = index % 3
        const left = padding + col * cellSize + dotOffset
        const top = padding + row * cellSize + dotOffset
        
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              background: '#222',
              borderRadius: '50%',
            }}
          />
        )
      })}
    </div>
  )
}
