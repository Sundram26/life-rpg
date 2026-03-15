import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api }    from '../services/api.js'

const CLASSES = [
  { id: 'scholar', icon: '📚', label: 'Scholar',  desc: '+30% XP on INT tasks' },
  { id: 'warrior', icon: '🛡️', label: 'Warrior',  desc: '+30% XP on STR tasks' },
  { id: 'monk',    icon: '🧘', label: 'Monk',     desc: 'Streak bonuses ×2.0' },
  { id: 'creator', icon: '🎨', label: 'Creator',  desc: '+25% credits, custom tasks' },
]

export default function LoginPage() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [mode,    setMode]    = useState('login')  // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    username: '', email: '', password: '', playerClass: 'scholar', avatarEmoji: '⚔️',
  })
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const AVATARS = ['⚔️','🧙','🛡️','🏹','🗡️','🧘','📚','🎨','🔮','👑']

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await api.createUser({
          username:    form.username,
          email:       form.email,
          password:    form.password,
          playerClass: form.playerClass,
          avatarEmoji: form.avatarEmoji,
        })
      }
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
      <div className="star-field" />

      <div className="page-z" style={{ width: '100%', maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 38, letterSpacing: 6, marginBottom: 6 }}>LIFE RPG</h1>
          <p style={{ color: 'var(--dim)', fontSize: 14, letterSpacing: 2 }}>TURN YOUR LIFE INTO A LEGEND</p>
        </div>

        <div className="card card-gold fade-up" style={{ padding: '32px 36px' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 8, padding: 3, marginBottom: 28, gap: 3 }}>
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                style={{
                  flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: mode === m ? 'var(--panel2)' : 'transparent',
                  color: mode === m ? 'var(--gold)' : 'var(--dim)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                  letterSpacing: 1, transition: 'all 0.15s',
                  borderBottom: mode === m ? '1px solid var(--border-g)' : 'none',
                }}>
                {m === 'login' ? '⚔️ Enter World' : '✨ Create Hero'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="input-group fade-up">
                  <label className="input-label">Username</label>
                  <input className="input" placeholder="ShadowMonk" value={form.username} onChange={set('username')} required minLength={3} maxLength={20} />
                </div>

                {/* Avatar picker */}
                <div className="input-group fade-up-1">
                  <label className="input-label">Avatar</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {AVATARS.map(a => (
                      <button key={a} type="button" onClick={() => setForm(p => ({ ...p, avatarEmoji: a }))}
                        style={{
                          width: 40, height: 40, borderRadius: 8, border: '1px solid',
                          borderColor: form.avatarEmoji === a ? 'var(--gold)' : 'var(--border)',
                          background: form.avatarEmoji === a ? 'var(--gold-glow)' : 'var(--bg2)',
                          fontSize: 20, cursor: 'pointer', transition: 'all 0.15s',
                        }}>{a}</button>
                    ))}
                  </div>
                </div>

                {/* Class picker */}
                <div className="input-group fade-up-2">
                  <label className="input-label">Class</label>
                  <div className="grid-2">
                    {CLASSES.map(c => (
                      <button key={c.id} type="button" onClick={() => setForm(p => ({ ...p, playerClass: c.id }))}
                        style={{
                          padding: '10px 12px', borderRadius: 8, border: '1px solid',
                          borderColor: form.playerClass === c.id ? 'var(--gold)' : 'var(--border)',
                          background: form.playerClass === c.id ? 'rgba(240,180,41,0.08)' : 'var(--bg2)',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}>
                        <div style={{ fontSize: 18, marginBottom: 2 }}>{c.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: form.playerClass === c.id ? 'var(--gold)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>{c.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-body)' }}>{c.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" placeholder="hero@quest.gg" value={form.email} onChange={set('email')} required />
            </div>

            <div className="input-group" style={{ marginBottom: 24 }}>
              <label className="input-label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={6} />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button className="btn btn-gold btn-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : mode === 'login' ? 'Enter the World' : 'Begin Your Journey'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
