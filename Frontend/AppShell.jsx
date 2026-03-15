import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Toast   from './Toast.jsx'
import { useGame } from '../context/GameContext.jsx'

const PAGE_TITLES = {
  '/dashboard':    '⚔️  Dashboard',
  '/tasks':        '📋  Quests',
  '/leaderboard':  '🏆  Leaderboard',
  '/loans':        '🪙  Loans',
  '/achievements': '🎖️  Achievements',
}

// Mobile bottom nav icons
const MOB_NAV = [
  { to: '/dashboard',    icon: '⚔️'  },
  { to: '/tasks',        icon: '📋'  },
  { to: '/leaderboard',  icon: '🏆'  },
  { to: '/loans',        icon: '🪙'  },
  { to: '/achievements', icon: '🎖️' },
]

import { NavLink } from 'react-router-dom'

export default function AppShell() {
  const location = useLocation()
  const title    = PAGE_TITLES[location.pathname] ?? 'Life RPG'

  return (
    <>
      <div className="star-field" />
      <Toast />

      <div className="app-shell">
        {/* Desktop Sidebar */}
        <div style={{ display: 'none' }} className="sidebar-desktop">
          <Sidebar />
        </div>
        <Sidebar />

        {/* Main content */}
        <main className="main-content page-z">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg2)', borderTop: '1px solid var(--border)',
        padding: '8px 0 12px',
      }} id="mobile-nav">
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {MOB_NAV.map(n => (
            <NavLink key={n.to} to={n.to} style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              fontSize: 22, color: isActive ? 'var(--gold)' : 'var(--faint)',
              textDecoration: 'none', padding: '4px 12px', transition: 'color 0.15s',
            })}>{n.icon}</NavLink>
          ))}
        </div>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .app-shell > aside { display: none !important; }
          #mobile-nav { display: block !important; }
        }
      `}</style>
    </>
  )
}
