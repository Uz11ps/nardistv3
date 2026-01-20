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

export const ShieldIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="M12 2v20"></path>
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
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    <defs>
      <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="1"/>
        <stop offset="50%" stopColor="#FFA500" stopOpacity="1"/>
        <stop offset="100%" stopColor="#FFD700" stopOpacity="1"/>
      </linearGradient>
    </defs>
    <path d="M12 2C10 2 8 3 8 5C8 6 9 7 10 7C9 8 8 9 8 11C8 13 9 14 11 14C10 15 9 16 9 18C9 20 11 21 13 21C15 21 17 20 17 18C17 16 16 15 15 14C17 14 18 13 18 11C18 9 17 8 16 7C17 7 18 6 18 5C18 3 16 2 14 2C13 2 12.5 2.5 12 2Z" fill="url(#brainGradient)"/>
    <circle cx="10" cy="6" r="1" fill="#FFF" opacity="0.8"/>
    <circle cx="14" cy="6" r="1" fill="#FFF" opacity="0.8"/>
    <path d="M10 10C10 10.5 10.5 11 11 11C11.5 11 12 10.5 12 10" stroke="#FFF" strokeWidth="1" fill="none"/>
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
    src="/img/inventory-icon.png" 
    alt="inventory" 
    className={className}
    style={{ width: size, height: size, ...style }}
  />
)

export const BarChartIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <img 
    src="/img/analytics-icon.png" 
    alt="analytics" 
    className={className}
    style={{ width: size, height: size, ...style }}
  />
)

export const SettingsIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
  <img 
    src="/img/settings-icon-figma.png" 
    alt="settings" 
    className={className}
    style={{ width: size, height: size, ...style }}
  />
)

export const ArrowRightIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => {
  const strokeColor = style?.color || style?.stroke || "#707579"
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 7 12" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ ...style, color: undefined, stroke: undefined }}
    >
      <path d="M1 1L6 6L1 11" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export const RocketIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
  </svg>
)

export const RobotIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="16" r="1"></circle>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
)

export const EditIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
)

export const ScaleIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path>
    <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"></path>
    <path d="M7 21h10"></path>
    <path d="M12 3v18"></path>
    <path d="M3 7h2c2 0 5 1 7 2 2-1 5-2 7-2h2"></path>
  </svg>
)

export const WrenchIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
  </svg>
)

export const DownloadIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
)

export const RefreshIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
)

export const BookIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
)

export const ArrowDownIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>
)

export const TrashIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
)

export const WarningIcon: React.FC<IconProps> = ({ className, style, size = 20 }) => (
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
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
)

