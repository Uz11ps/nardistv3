export default function PartyIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill={color}
      />
      <circle cx="6" cy="4" r="1.5" fill={color} />
      <circle cx="18" cy="16" r="1.5" fill={color} />
      <circle cx="8" cy="18" r="1" fill={color} />
    </svg>
  )
}
