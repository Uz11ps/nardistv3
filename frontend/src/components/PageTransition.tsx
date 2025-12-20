import { ReactNode } from 'react'
import './PageTransition.css'

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export default function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`page-transition ${className}`}>
      {children}
    </div>
  )
}

