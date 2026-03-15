import { useState } from 'react'
import { useGame }  from '../context/GameContext.jsx'

const STATS = [
  { id: 'intelligence', icon: '📘', label: 'Intelligence', color: 'var(--int)', desc: 'Studying, coding, reading, learning' },
  { id: 'strength',     icon: '💪', label: 'Strength',     color: 'var(--str)', desc: 'Working out, running, sports, steps' },
  { id: 'discipline',   icon: '🎯', label: 'Discipline',   color: 'var(--dis)', desc: 'No phone, journaling, planning' },
  { id: 'social',       icon: '🤝', label: 'Social',       color: 'var(--soc)', desc: 'Calling friends, networking, events' },
]

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   icon: '🌱', xp: '20',  cr: '15',  desc: '~15–30 min task' },
  { id: 'medium', label: 'Medium', icon: '⚡', xp: '40',  cr: '30',  desc: '30–60 min task' },
  { id: 'hard',   label: 'Hard',   icon: '🔥', xp: '70',  cr: '60',  desc: '1–2 hour task' },
  { id: 'epic',   label: 'Epic',   icon: '💎', xp: '120', cr: '100', desc: 'Major challenge' },
]

const PRESET_TASKS = [
  { name: 'Study for 45 minutes',    stat: 'intelligence', difficulty: 'medium' },
  { name: 'Read a book chapter',     stat: 'intelligence', difficulty: 'easy' },
  { name: 'Complete an online course lesson', stat: 'intelligence', difficulty: 'medium' },
  { name: 'Morning workout',         stat: 'strength',     difficulty: 'medium' },
  { name: 'Go for a 5km run',        stat: 'strength',     difficulty: 'hard' },
  { name: 'No phone for 2 hours',    stat: 'discipline',   difficulty: 'medium' },
  { name: 'Complete daily planner',  stat: 'discipline',   difficulty: 'easy' },
  { name: 'Meditate for 10 minutes', stat: 'discipline',   difficulty: 'easy' },
  { name: 'Call a friend or family', stat: 'social',       difficulty: 'easy' },
  { name: 'Attend a group activity', stat: 'social',       difficulty: 'medium' },
]

export default function TasksPage() {
  const { submitTask, showToast, profile } = useGame()

  const [form, setForm] = useState({ name: '', statAffected: 'intelligence', difficulty: 'medium', source: 'custom' })
  const [loading, setLoading]   = useState(false)
  const [lastResult, setResult] = useState(null)
  const set = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === 'string' ? v : v.target.value }))

  const char = profile?.character

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return showToast('warning', 'Missing quest name', 'Tell us what you did!')
    setLoading(true); setResult(null)
    try {
      const data = await submitTask(form)
      setResult(data)
      showToast('success', 'Quest Complete!', `+${data.rewards.xp} XP · +${data.rewards.net_credits} credits`)
      setForm(p => ({ ...p, name: '' }))
    } catch (err) {
      showToast('error', 'Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  function usePreset(p) {
    setForm(prev => ({ ...prev, name: p.name, stat: p.stat, difficulty: p.difficulty }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page-z">
      <h1 style={{ marginBottom: 6 }}>Quest Log</h1>
      <p style={{ color: 'var(--dim)', marginBottom: 28, fontSize: 15 }}>Log a real-life achievement to earn XP and credits.</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Form */}
        <div>
          {/* Level gate notice */}
          {char?.level < 5 && (
            <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--int)' }}>
              📘 Hard &amp; Epic quests unlock at Level 5
            </div>
          )}

          <div className="card card-gold fade-up" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 20 }}>⚔️ Log Custom Quest</h2>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">What did you do?</label>
                <input className="input" placeholder="e.g. Studied chemistry for 1 hour" value={form.name}
                  onChange={set('name')} required minLength={3} maxLength={120} />
              </div>

              {/* Stat selector */}
              <div className="input-group">
                <label className="input-label">Stat affected</label>
                <div className="grid-2">
                  {STATS.map(s => (
                    <button key={s.id} type="button" onClick={() => set('statAffected')(s.id)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, border: '1px solid',
                        borderColor: form.statAffected === s.id ? s.color : 'var(--border)',
                        background: form.statAffected === s.id ? `${s.color}15` : 'var(--bg2)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: form.statAffected === s.id ? s.color : 'var(--text)', fontFamily: 'var(--font-body)' }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-body)', lineHeight: 1.3, marginTop: 2 }}>{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="input-group">
                <label className="input-label">Difficulty</label>
                <div className="grid-2">
                  {DIFFICULTIES.map(d => {
                    const locked = (d.id === 'hard' || d.id === 'epic') && (char?.level ?? 1) < 5
                    return (
                      <button key={d.id} type="button" onClick={() => !locked && set('difficulty')(d.id)}
                        disabled={locked}
                        style={{
                          padding: '10px 12px', borderRadius: 8, border: '1px solid',
                          borderColor: form.difficulty === d.id ? 'var(--gold)' : 'var(--border)',
                          background: form.difficulty === d.id ? 'var(--gold-glow)' : 'var(--bg2)',
                          cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left',
                          opacity: locked ? 0.4 : 1, transition: 'all 0.15s',
                        }}>
                        <div style={{ fontSize: 16, marginBottom: 2 }}>{d.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: form.difficulty === d.id ? 'var(--gold)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>{d.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--font-body)' }}>~{d.xp} XP · {d.cr} cr</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button className="btn btn-gold btn-full" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Logging...</> : '⚔️ Complete Quest'}
              </button>
            </form>
          </div>

          {/* Result card */}
          {lastResult && (
            <div className="card card-gold fade-up" style={{ padding: '18px 22px', animation: 'pulse-gold 2s infinite' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, color: 'var(--gold)', marginBottom: 12 }}>⚔️ QUEST COMPLETE!</div>
              <div className="grid-2">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>+{lastResult.rewards.xp}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>XP earned</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--soc)' }}>+{lastResult.rewards.net_credits}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>credits net</div>
                </div>
              </div>
              {lastResult.rewards.loan_repaid > 0 && (
                <div style={{ fontSize: 13, color: 'var(--success)', marginTop: 10, textAlign: 'center' }}>
                  🏦 {lastResult.rewards.loan_repaid} credits auto-deducted for loan
                  {lastResult.rewards.loan_cleared && ' — LOAN CLEARED! 🎉'}
                </div>
              )}
              {lastResult.progress.levels_gained > 0 && (
                <div style={{ fontSize: 14, color: 'var(--gold)', marginTop: 10, textAlign: 'center', fontWeight: 700 }}>
                  ⭐ LEVEL UP! Now Level {lastResult.progress.level} — {lastResult.progress.title}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preset tasks */}
        <div className="card fade-up-1">
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>📋 Quick Quests</h2>
          <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 16 }}>Click to prefill the form</p>
          {PRESET_TASKS.map((p, i) => {
            const stat = STATS.find(s => s.id === p.stat)
            const diff = DIFFICULTIES.find(d => d.id === p.difficulty)
            return (
              <div key={i} onClick={() => usePreset(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--bg2)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-g)'; e.currentTarget.style.transform = 'translateX(3px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';   e.currentTarget.style.transform = 'none' }}>
                <span style={{ fontSize: 18 }}>{stat?.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>{stat?.label} · {diff?.label}</div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{diff?.cr} 🪙</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
