import { useNavigate, useLocation } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/', icon: '🎲', label: 'Играть' },
    { path: '/city', icon: '🏙️', label: 'Город' },
    { path: '/tournaments', icon: '🏆', label: 'Турниры' },
    { path: '/profile', icon: '👤', label: 'Профиль' },
  ]

  return (
    <div className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

