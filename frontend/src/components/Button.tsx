import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'disabled'
  fullWidth?: boolean
  className?: string
  type?: 'button' | 'submit'
  style?: React.CSSProperties
  disabled?: boolean
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  fullWidth = false,
  className = '',
  type = 'button',
  style,
  disabled,
}: ButtonProps) {
  const baseClass = variant === 'disabled' || disabled ? 'btn-disabled' : variant === 'secondary' ? 'btn-secondary' : 'btn-primary'
  const widthStyle = fullWidth ? { width: '100%' } : {}

  return (
    <button
      type={type}
      className={`${baseClass} ${className} btn-hover`}
      onClick={onClick}
      disabled={variant === 'disabled' || disabled}
      style={{ ...widthStyle, ...style }}
    >
      {children}
    </button>
  )
}

