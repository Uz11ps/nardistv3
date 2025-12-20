import React from 'react'

interface IconProps {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 24, className, style }: IconProps) {
  return (
    <img
      src={`/icons/${name}.svg`}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={style}
      onError={(e) => {
        // Fallback если иконка не найдена
        const target = e.target as HTMLImageElement
        target.style.display = 'none'
      }}
    />
  )
}
