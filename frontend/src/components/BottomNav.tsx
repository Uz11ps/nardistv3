import { useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import './BottomNav.css'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/', icon: 'home', label: 'Главная' },
    { path: '/academy', icon: 'book', label: 'Академия' },
    { path: '/shop', icon: 'shop', label: 'Магазин' },
    { path: '/city', icon: 'city', label: 'Город' },
  ]

  return (
    <div className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          style={{ transition: 'all 0.2s ease' }}
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

