import React from 'react'

interface CardProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

export default function Card({ children, onClick, className = '', style }: CardProps) {
  const cardClasses = `card ${className} ${onClick ? 'card-clickable' : ''}`.trim()
  return (
    <div 
      className={cardClasses}
      onClick={onClick} 
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  )
}

