import { useEffect, useState } from 'react'
import { useGame }  from '../context/GameContext.jsx'

const PERIOD_OPTIONS = [
  { id: 'weekly',  label: '⚡ Weekly' },
  { id: 'alltime', label: '👑 All Time' },
]

const CLASS_COLORS = { scholar:'var(--int)', warrior:'var(--str)', monk:'var(--dis)', creator:'var(--gold)' }
const CLASS_ICONS  = { scholar:'📚', warrior:'🛡️', monk:'🧘', creator:'🎨' }

const RANK_STYLES = {
  1: { color: '#F0B429', icon: '👑', glow: 'rgba(240,180,41,0.2)' },
  2: { color: '#9CA3AF', icon: '🥈', glow: 'rgba(156,163,175,0.15)' },
  3: { color: '#D97706', icon: '🥉', glow: 'rgba(217,119,6,0.15)' },
}

export default function LeaderboardPage() {
  const { leaderboard, refreshLeaderboard, profile } = useGame()
  const [period, setPeriod] = useState('weekly')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    refreshLeaderboard({ period }).finally(() => setLoading(false))
  }, [period])

  const entries    = leaderboard?.entries ?? []
  const yourRank   = leaderboard?.your_rank
  const uid        = profile?.character?.uid

  return (
    <div className="page-z">
      <h1 style={{ marginBottom: 6 }}>Leaderboard</h1>
      <p style={{ color: 'var(--dim)', marginBottom: 24, fontSize: 15 }}>Compete against players and AI challengers worldwide.</p>

      {/* Period toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {PERIOD_OPTIONS.map(o => (
          <button key={o.id} className={`btn ${period === o.id ? 'btn-gold' : 'btn-ghost'} btn-sm`}
            onClick={() => setPeriod(o.id)}>{o.label}</button>
        ))}
      </div>

      {/* Your rank banner */}
      {yourRank && (
        <div className="card card-gold fade-up" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 32, color: 'var(--gold)' }}>#{yourRank.rank}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Your rank this week</div>
              <div style={{ fontSize: 12, color: 'var(--faint)' }}>Level {yourRank.level} {yourRank.class}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{yourRank.score?.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--faint)' }}>score</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--soc)' }}>🔥 {yourRank.streak_days}</div>
              <div style={{ fontSize: 11, color: 'var(--faint)' }}>day streak</div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="card fade-up-1" style={{ padding: '0' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '48px 1fr 90px 80px 60px',
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase',
        }}>
          <span>Rank</span><span>Player</span><span style={{ textAlign: 'right' }}>Score</span>
          <span style={{ textAlign: 'right' }}>Streak</span><span style={{ textAlign: 'right' }}>Level</span>
        </div>

        {loading && <div className="loading-center" style={{ minHeight: 200 }}><div className="spinner" /></div>}

        {!loading && entries.map((entry, i) => {
          const isYou   = entry.uid === uid
          const rankCfg = RANK_STYLES[entry.rank]
          const ccol    = CLASS_COLORS[entry.class] ?? 'var(--dim)'

          return (
            <div key={entry.uid ?? i}
              style={{
                display: 'grid', gridTemplateColumns: '48px 1fr 90px 80px 60px',
                alignItems: 'center', padding: '13px 20px',
                borderBottom: '1px solid var(--border)',
                background: isYou ? 'rgba(240,180,41,0.05)' : 'transparent',
                borderLeft: isYou ? '3px solid var(--gold)' : '3px solid transparent',
                transition: 'background 0.15s',
              }}>
              {/* Rank */}
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, color: rankCfg?.color ?? 'var(--faint)', fontWeight: 700 }}>
                {rankCfg?.icon ?? `#${entry.rank}`}
              </div>

              {/* Player */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: isYou ? 'rgba(240,180,41,0.15)' : 'var(--bg3)',
                  border: `1px solid ${isYou ? 'var(--gold)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{entry.avatar_emoji}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.username}</span>
                    {isYou && <span className="tag tag-gold" style={{ padding: '0 6px', fontSize: 10 }}>YOU</span>}
                    {entry.is_bot && <span style={{ fontSize: 10, color: 'var(--faint)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: 99 }}>AI</span>}
                  </div>
                  <div style={{ fontSize: 11, color: ccol, marginTop: 1 }}>
                    {CLASS_ICONS[entry.class]} {entry.class} · {entry.tasks_completed} tasks
                  </div>
                </div>
              </div>

              {/* Score */}
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: rankCfg?.color ?? 'var(--text)' }}>
                {entry.score?.toLocaleString()}
              </div>

              {/* Streak */}
              <div style={{ textAlign: 'right', fontSize: 14, color: entry.streak_days > 0 ? 'var(--gold)' : 'var(--faint)' }}>
                {entry.streak_days > 0 ? `🔥 ${entry.streak_days}` : '—'}
              </div>

              {/* Level */}
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--dim)' }}>
                {entry.level}
              </div>
            </div>
          )
        })}

        {!loading && entries.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--faint)', fontSize: 14 }}>
            No entries yet — be the first on the board!
          </div>
        )}

        {/* Footer */}
        {leaderboard && (
          <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>
            {leaderboard.total} players · Resets Monday midnight · Score = 40% credits + 40% XP + 20% streak
          </div>
        )}
      </div>
    </div>
  )
}
