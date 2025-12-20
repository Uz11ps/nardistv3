import React from 'react'
import './Dice.css'

interface DiceProps {
  value: number
  size?: 'small' | 'medium' | 'large'
  className?: string
}

export default function Dice({ value, size = 'medium', className = '' }: DiceProps) {
  const getDots = (val: number): number[] => {
    // Возвращает позиции точек для значения кости
    const patterns: { [key: number]: number[] } = {
      1: [4], // Центр
      2: [0, 8], // Диагональ: левый верхний, правый нижний
      3: [0, 4, 8], // Диагональ: все три
      4: [0, 2, 6, 8], // Углы
      5: [0, 2, 4, 6, 8], // Углы + центр
      6: [0, 1, 2, 6, 7, 8], // Две колонки
    }
    return patterns[val] || []
  }

  const dots = getDots(value)
  const sizeClass = `dice-${size}`

  return (
    <div className={`dice ${sizeClass} ${className}`}>
      {dots.map((pos, index) => {
        const row = Math.floor(pos / 3) + 1
        const col = (pos % 3) + 1
        return (
          <div
            key={index}
            className="dice-dot"
            style={{
              gridRow: row,
              gridColumn: col,
            }}
          />
        )
      })}
    </div>
  )
}

