import { Navigate } from 'react-router-dom'
import { useAuth }   from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--dim)', fontFamily: 'var(--font-head)', letterSpacing: 2, fontSize: 13 }}>
            LOADING WORLD...
          </div>
        </div>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}
