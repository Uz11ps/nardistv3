export default function CoinIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <circle cx="12" cy="12" r="8" fill="none" stroke="white" strokeWidth="1.5" />
      <path d="M12 4C16.4183 4 20 7.58172 20 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="white" />
    </svg>
  )
}
