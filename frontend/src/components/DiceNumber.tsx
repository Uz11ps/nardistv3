import React from 'react'
import Dice from './Dice'
import './DiceNumber.css'

interface DiceNumberProps {
  value: number
  size?: 'small' | 'medium' | 'large'
  className?: string
  maxDice?: number // Максимальное количество кубиков для отображения
}

/**
 * Компонент для отображения числа в виде кубиков
 * Разбивает число на цифры и показывает каждую цифру как кубик (1-6)
 * Для цифр больше 6 использует модуль 6 + 1
 */
export default function DiceNumber({ value, size = 'medium', className = '', maxDice = 10 }: DiceNumberProps) {
  // Преобразуем число в массив цифр
  const digits = value.toString().split('').map(Number)
  
  // Ограничиваем количество кубиков
  const displayDigits = digits.slice(0, maxDice)
  
  // Для цифр больше 6 используем модуль 6 + 1 (чтобы было от 1 до 6)
  const diceValues = displayDigits.map(digit => {
    if (digit === 0) return 6 // 0 показываем как 6
    if (digit > 6) return ((digit - 1) % 6) + 1
    return digit
  })
  
  return (
    <div className={`dice-number-container ${className}`}>
      {diceValues.map((diceValue, index) => (
        <Dice 
          key={index} 
          value={diceValue} 
          size={size}
          className="dice-number-die"
        />
      ))}
    </div>
  )
}

