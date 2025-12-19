import React from 'react'

interface CardProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

export default function Card({ children, onClick, className = '', style }: CardProps) {
  return (
    <div 
      className={`card ${className}`} 
      onClick={onClick} 
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  )
}

