import { useGame }   from '../context/GameContext.jsx'
import { StatBar }   from '../components/StatBar.jsx'

const CLASS_COLORS = { scholar:'var(--int)', warrior:'var(--str)', monk:'var(--dis)', creator:'var(--gold)' }
const CLASS_ICONS  = { scholar:'📚', warrior:'🛡️', monk:'🧘', creator:'🎨' }

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="card fade-up" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { profile, loading, refreshProfile } = useGame()

  if (loading && !profile) {
    return <div className="loading-center"><div className="spinner" /></div>
  }
  if (!profile) return null

  const { character: char, stats, credits, active_loan, recent_tasks, leaderboard } = profile
  const classColor = CLASS_COLORS[char.class] ?? 'var(--gold)'

  return (
    <div className="page-z">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 62, height: 62, borderRadius: '50%',
              background: 'var(--bg3)', border: `3px solid ${classColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, boxShadow: `0 0 20px ${classColor}40`, flexShrink: 0,
            }}>{char.avatar_emoji}</div>
            <div>
              <h1 style={{ fontSize: 26, marginBottom: 2 }}>{char.username}</h1>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="tag tag-gold">{char.title}</span>
                <span className="tag" style={{ background: `${classColor}18`, color: classColor, border: `1px solid ${classColor}40` }}>
                  {CLASS_ICONS[char.class]} {char.class}
                </span>
                {char.streak_days > 0 && <span className="tag tag-gold">🔥 {char.streak_days}d streak</span>}
              </div>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refreshProfile}>↻ Refresh</button>
      </div>

      {/* XP Bar */}
      <div className="card card-gold fade-up" style={{ marginBottom: 20, padding: '18px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Level {char.level} — {char.title}</span>
          <span style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700 }}>{char.xp} / {char.xp_to_next_level} XP</span>
        </div>
        <div className="bar-bg" style={{ height: 12 }}>
          <div className="bar-fill bar-gold" style={{ width: `${char.xp_progress_pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>Lv {char.level}</span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>{char.xp_progress_pct}% to Lv {char.level + 1}</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-3" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard icon="🪙" label="Credits"      value={credits?.balance ?? 0}         color="var(--gold)" sub="balance" />
        <StatCard icon="📋" label="Tasks Done"   value={char.tasks_completed ?? 0}      color="var(--soc)"  sub="total" />
        <StatCard icon="🏆" label="Weekly Rank"  value={leaderboard ? `#${leaderboard.weekly_rank}` : '—'} color="var(--dis)" sub="leaderboard" />
        <StatCard icon="💰" label="Earned"       value={credits?.weekly_earned ?? 0}   color="var(--int)"  sub="this week" />
      </div>

      {/* Stats + Recent Tasks */}
      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        {/* Stats */}
        <div className="card fade-up-1">
          <h2 style={{ marginBottom: 20, fontSize: 16 }}>📊 Character Stats</h2>
          {stats && Object.entries(stats).filter(([k]) => !k.includes('lifetime')).map(([k, v]) => (
            <StatBar key={k} stat={k} value={v} />
          ))}
          {char.decay_warning && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', marginTop: 12, fontSize: 13, color: 'var(--danger)' }}>
              ⚠️ {char.decay_warning.message}
            </div>
          )}
        </div>

        {/* Recent Tasks */}
        <div className="card fade-up-2">
          <h2 style={{ marginBottom: 16, fontSize: 16 }}>📜 Recent Quests</h2>
          {recent_tasks?.length === 0 && (
            <div style={{ color: 'var(--faint)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              No quests completed yet. Start your journey!
            </div>
          )}
          {recent_tasks?.map((t, i) => (
            <div key={t.id ?? i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
                  {t.stat_affected} · {t.difficulty}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>+{t.credits_awarded} 🪙</div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>+{t.xp_awarded} XP</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Loan Banner */}
      {active_loan && (
        <div className="card fade-up-3" style={{
          borderColor: active_loan.danger_level === 'critical' ? 'rgba(239,68,68,0.5)' : 'var(--border-g)',
          background: active_loan.danger_level === 'critical' ? 'rgba(239,68,68,0.05)' : 'var(--panel)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, color: active_loan.danger_level === 'critical' ? 'var(--danger)' : 'var(--text)' }}>
              🏦 Active Loan
            </h2>
            <span className={active_loan.danger_level === 'critical' ? 'tag tag-danger' : 'tag tag-gold'}>
              {active_loan.danger_level === 'critical' ? '🚨 Critical' : active_loan.days_overdue > 0 ? `${active_loan.days_overdue}d overdue` : 'On track'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
            <div><span style={{ color: 'var(--faint)', fontSize: 12 }}>Balance </span><span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 18 }}>{active_loan.current_balance} credits</span></div>
            <div><span style={{ color: 'var(--faint)', fontSize: 12 }}>Principal </span><span style={{ fontWeight: 600 }}>{active_loan.principal}</span></div>
            <div><span style={{ color: 'var(--faint)', fontSize: 12 }}>Due </span><span style={{ fontWeight: 600 }}>{new Date(active_loan.due_date).toLocaleDateString()}</span></div>
          </div>
          <div className="bar-bg" style={{ height: 8 }}>
            <div className="bar-fill" style={{ width: `${active_loan.repay_progress}%`, background: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>{active_loan.repay_progress}% repaid via task earnings</div>
        </div>
      )}
    </div>
  )
}
