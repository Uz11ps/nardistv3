import React from 'react'

interface IconProps {
  className?: string
  style?: React.CSSProperties
  size?: number
}

export const CoinIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <img 
    src="/img/narcoin.png" 
    alt="coin" 
    className={className}
    style={{ width: size, height: size, ...style }}
  />
)

export const ShoppingCartIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </svg>
)

export const ArrowUpIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
)

export const LockIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
)

export const EnergyIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <img 
    src="/img/молния.png" 
    alt="energy" 
    className={className}
    style={{ width: size, height: size, ...style }}
    onError={(e) => {
      // Fallback to SVG if image not found
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', size.toString())
      svg.setAttribute('height', size.toString())
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '2')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', 'M13 2L3 14h9l-1 8 10-12h-9l1-8z')
      svg.appendChild(path)
      e.currentTarget.replaceWith(svg)
    }}
  />
)

export const HeartIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
)

export const StarIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
)

export const TargetIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
)

export const CrownIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"></path>
    <path d="M12 18v4"></path>
    <path d="M8 21h8"></path>
  </svg>
)

export const DiamondIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M6 3h12l4 6-10 12L2 9l4-6z"></path>
    <path d="M11 3L8 9l4 12 4-12-3-6"></path>
    <path d="M2 9h20"></path>
  </svg>
)

export const PaintBrushIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M9.06 2.573a3 3 0 0 1 4.134.094l6.233 6.233a3 3 0 0 1 .094 4.134l-8.4 8.4a3 3 0 0 1-4.134.094L2.573 15.8a3 3 0 0 1-.094-4.134l8.4-8.4z"></path>
    <path d="M2 22h20"></path>
  </svg>
)

export const FireIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
  </svg>
)

export const MuscleIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M6.5 6.5h11l-1 7h-9z"></path>
    <path d="M9.5 13.5l-2 4"></path>
    <path d="M14.5 13.5l2 4"></path>
    <path d="M12 2v4"></path>
  </svg>
)

export const ScrollIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
)

export const BrainIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44L6.5 20.5a2.5 2.5 0 0 1-4.96-.44v-15A2.5 2.5 0 0 1 3.5 2h6z"></path>
    <path d="M14 2a2.5 2.5 0 0 1 2.5 2.5v15a2.5 2.5 0 0 1-4.96.44L11.5 20.5a2.5 2.5 0 0 1-4.96-.44v-15A2.5 2.5 0 0 1 9.5 2h4.5z"></path>
  </svg>
)

export const TicketIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
    <path d="M13 5v2"></path>
    <path d="M13 17v2"></path>
    <path d="M13 11v2"></path>
  </svg>
)

export const BoxIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <img 
    src="/img/инв.png" 
    alt="inventory" 
    className={className}
    style={{ width: size, height: size, ...style }}
  />
)

export const BarChartIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <line x1="12" y1="20" x2="12" y2="10"></line>
    <line x1="18" y1="20" x2="18" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="16"></line>
  </svg>
)

export const SettingsIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <img 
    src="/img/settings.png" 
    alt="settings" 
    className={className}
    style={{ width: size, height: size, ...style }}
  />
)

export const ArrowRightIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
)

