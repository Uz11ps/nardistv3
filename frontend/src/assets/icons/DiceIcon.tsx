export default function DiceIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" fill={color} />
      <circle cx="7.5" cy="7.5" r="1.5" fill="white" />
      <circle cx="16.5" cy="7.5" r="1.5" fill="white" />
      <circle cx="12" cy="12" r="1.5" fill="white" />
      <circle cx="7.5" cy="16.5" r="1.5" fill="white" />
      <circle cx="16.5" cy="16.5" r="1.5" fill="white" />
    </svg>
  )
}
