import { useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import './BottomNav.css'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/', icon: '/img/Vectorhome.png', label: 'Главная' },
    { path: '/tournaments', icon: '/img/fi-rr-badge.png', label: 'Турниры' },
    { path: '/academy', icon: '/img/fi-rr-book-alt.png', label: 'Академия' },
    { path: '/shop', icon: '/img/fi-rr-shop.png', label: 'Магазин' },
    { path: '/city', icon: '/img/fi-rs-building.png', label: 'Город' },
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
            <img src={item.icon} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: location.pathname === item.path ? 1 : 0.5 }} />
          </span>
          <span style={{ fontSize: 'inherit', lineHeight: '1.2', textAlign: 'center' }}>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

