import React from 'react'

interface PlayerNameProps {
  nickname?: string | null
  username?: string | null
  hasPremium?: boolean
  fallback?: string
  className?: string
}

export default function PlayerName({ nickname, username, hasPremium, fallback, className }: PlayerNameProps) {
  const displayName = nickname || username || fallback || 'Игрок'
  
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {displayName}
      {hasPremium && (
        <img 
          src="/img/crown.png" 
          alt="premium" 
          style={{ 
            width: '32px', 
            height: '32px', 
            objectFit: 'contain',
            verticalAlign: 'middle',
            display: 'inline-block'
          }} 
        />
      )}
    </span>
  )
}

