export default function TargetIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
  )
}
