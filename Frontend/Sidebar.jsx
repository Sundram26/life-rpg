import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useGame } from '../context/GameContext.jsx'

const NAV = [
  { to: '/dashboard',    icon: '⚔️',  label: 'Dashboard'    },
  { to: '/tasks',        icon: '📋',  label: 'Quests'       },
  { to: '/leaderboard',  icon: '🏆',  label: 'Leaderboard'  },
  { to: '/loans',        icon: '🪙',  label: 'Loans'        },
  { to: '/achievements', icon: '🎖️', label: 'Achievements'  },
]

export default function Sidebar() {
  const { logout }  = useAuth()
  const { profile } = useGame()
  const navigate    = useNavigate()
  const char        = profile?.character

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside style={{
      gridColumn: '1', gridRow: '1 / -1',
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 20, letterSpacing: 3, lineHeight: 1 }}>LIFE RPG</h1>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4, letterSpacing: 1 }}>
          turn life into a legend
        </div>
      </div>

      {/* Character mini-card */}
      {char && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--bg3)', border: '2px solid var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, boxShadow: '0 0 14px var(--gold-glow)', flexShrink: 0,
            }}>{char.avatar_emoji}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{char.username}</div>
              <div style={{ fontSize: 12, color: 'var(--gold)' }}>{char.title}</div>
            </div>
          </div>
          {/* XP bar */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--dim)' }}>Lv {char.level}</span>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>{char.xp_progress_pct}%</span>
            </div>
            <div className="bar-bg" style={{ height: 5 }}>
              <div className="bar-fill bar-gold" style={{ width: `${char.xp_progress_pct}%` }} />
            </div>
          </div>
          {/* Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>{char.streak_days} day streak</span>
            <span style={{ marginLeft: 'auto', fontSize: 13 }}>🪙</span>
            <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>
              {profile?.credits?.balance ?? 0}
            </span>
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, marginBottom: 2,
            textDecoration: 'none', fontFamily: 'var(--font-body)',
            fontSize: 15, fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--gold)' : 'var(--dim)',
            background: isActive ? 'rgba(240,180,41,0.08)' : 'transparent',
            borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
            transition: 'all 0.15s',
          })}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-full btn-sm" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
