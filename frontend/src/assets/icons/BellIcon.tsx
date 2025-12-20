export default function BellIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C8.13 2 5 5.13 5 9C5 14.25 3 16 3 17H21C21 16 19 14.25 19 9C19 5.13 15.87 2 12 2ZM10 19H14C14 19.55 13.55 20 13 20H11C10.45 20 10 19.55 10 19Z"
        fill={color}
      />
    </svg>
  )
}
