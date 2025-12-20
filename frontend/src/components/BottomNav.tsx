import { useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/', icon: 'dice', label: 'Играть' },
    { path: '/city', icon: 'city', label: 'Город' },
    { path: '/tournaments', icon: 'trophy', label: 'Турниры' },
    { path: '/profile', icon: 'user', label: 'Профиль' },
  ]

  return (
    <div className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-item-icon">
            <Icon name={item.icon} size={24} />
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

