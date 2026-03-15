import { useGame } from '../context/GameContext.jsx'

const ALL_ACHIEVEMENTS = [
  // ── Streak ───────────────────────────────────────────────────────────────
  { code: 'streak_3',     cat: 'streak',  icon: '🔥', name: '3-Day Flame',      desc: 'Maintain a 3-day streak',          threshold: 3,   reward_xp: 50,  reward_credits: 20  },
  { code: 'streak_7',     cat: 'streak',  icon: '🔥', name: 'Week Warrior',      desc: 'Maintain a 7-day streak',          threshold: 7,   reward_xp: 150, reward_credits: 75  },
  { code: 'streak_30',    cat: 'streak',  icon: '💫', name: 'Iron Will',         desc: 'Maintain a 30-day streak',         threshold: 30,  reward_xp: 500, reward_credits: 300 },
  { code: 'streak_100',   cat: 'streak',  icon: '👑', name: 'Legendary Grind',   desc: 'Maintain a 100-day streak',        threshold: 100, reward_xp: 2000,reward_credits: 1000},

  // ── Level ────────────────────────────────────────────────────────────────
  { code: 'level_5',      cat: 'level',   icon: '⭐', name: 'Apprentice',        desc: 'Reach Level 5',                    threshold: 5,   reward_xp: 0,   reward_credits: 50  },
  { code: 'level_10',     cat: 'level',   icon: '🌟', name: 'Adept',             desc: 'Reach Level 10',                   threshold: 10,  reward_xp: 0,   reward_credits: 150 },
  { code: 'level_15',     cat: 'level',   icon: '✨', name: 'Champion',          desc: 'Reach Level 15',                   threshold: 15,  reward_xp: 0,   reward_credits: 300 },
  { code: 'level_20',     cat: 'level',   icon: '💎', name: 'Legend',            desc: 'Reach Level 20',                   threshold: 20,  reward_xp: 0,   reward_credits: 1000},

  // ── Tasks ────────────────────────────────────────────────────────────────
  { code: 'tasks_10',     cat: 'tasks',   icon: '📋', name: 'Getting Started',   desc: 'Complete 10 tasks',                threshold: 10,  reward_xp: 80,  reward_credits: 30  },
  { code: 'tasks_50',     cat: 'tasks',   icon: '📋', name: 'Grinder',           desc: 'Complete 50 tasks',                threshold: 50,  reward_xp: 200, reward_credits: 100 },
  { code: 'tasks_100',    cat: 'tasks',   icon: '🏅', name: 'Centurion',         desc: 'Complete 100 tasks',               threshold: 100, reward_xp: 500, reward_credits: 250 },
  { code: 'tasks_500',    cat: 'tasks',   icon: '🏆', name: 'Task Master',       desc: 'Complete 500 tasks',               threshold: 500, reward_xp: 2000,reward_credits: 1000},

  // ── Stats ────────────────────────────────────────────────────────────────
  { code: 'int_50',       cat: 'stats',   icon: '📘', name: 'Sharp Mind',        desc: 'Reach 50 Intelligence',            threshold: 50,  reward_xp: 200, reward_credits: 80,  stat: 'int' },
  { code: 'int_100',      cat: 'stats',   icon: '🧠', name: 'Genius',            desc: 'Max out Intelligence',             threshold: 100, reward_xp: 800, reward_credits: 400, stat: 'int' },
  { code: 'str_50',       cat: 'stats',   icon: '💪', name: 'Iron Fist',         desc: 'Reach 50 Strength',                threshold: 50,  reward_xp: 200, reward_credits: 80,  stat: 'str' },
  { code: 'str_100',      cat: 'stats',   icon: '🏋️', name: 'Iron Body',         desc: 'Max out Strength',                 threshold: 100, reward_xp: 800, reward_credits: 400, stat: 'str' },
  { code: 'dis_50',       cat: 'stats',   icon: '🎯', name: 'Focused',           desc: 'Reach 50 Discipline',              threshold: 50,  reward_xp: 200, reward_credits: 80,  stat: 'dis' },
  { code: 'dis_100',      cat: 'stats',   icon: '🧘', name: 'Unbreakable',       desc: 'Max out Discipline',               threshold: 100, reward_xp: 800, reward_credits: 400, stat: 'dis' },
  { code: 'soc_50',       cat: 'stats',   icon: '🤝', name: 'People Person',     desc: 'Reach 50 Social',                  threshold: 50,  reward_xp: 200, reward_credits: 80,  stat: 'soc' },
  { code: 'soc_100',      cat: 'stats',   icon: '🌐', name: 'Networker',         desc: 'Max out Social',                   threshold: 100, reward_xp: 800, reward_credits: 400, stat: 'soc' },

  // ── Credits ──────────────────────────────────────────────────────────────
  { code: 'credits_500',  cat: 'credits', icon: '🪙', name: 'Coin Hoarder',      desc: 'Earn 500 credits lifetime',        threshold: 500,  reward_xp: 100, reward_credits: 50  },
  { code: 'credits_5000', cat: 'credits', icon: '💰', name: 'Wealthy Hero',       desc: 'Earn 5,000 credits lifetime',      threshold: 5000, reward_xp: 400, reward_credits: 200 },

  // ── Special ──────────────────────────────────────────────────────────────
  { code: 'loan_clear',   cat: 'special', icon: '🏦', name: 'Debt Slayer',       desc: 'Repay a loan in full',             threshold: 1,   reward_xp: 150, reward_credits: 50  },
  { code: 'leaderboard_top3', cat: 'special', icon: '🥇', name: 'Podium Finish', desc: 'Reach top 3 on the weekly leaderboard', threshold: 1, reward_xp: 300, reward_credits: 150 },
  { code: 'epic_task',    cat: 'special', icon: '💎', name: 'Epic Challenger',   desc: 'Complete your first Epic quest',   threshold: 1,   reward_xp: 200, reward_credits: 100 },
  { code: 'all_stats_50', cat: 'special', icon: '⚔️', name: 'Well Rounded',      desc: 'All stats above 50',               threshold: 4,   reward_xp: 500, reward_credits: 250 },
]

const CATEGORIES = [
  { id: 'all',     label: 'All'      },
  { id: 'streak',  label: '🔥 Streak' },
  { id: 'level',   label: '⭐ Level'  },
  { id: 'tasks',   label: '📋 Tasks'  },
  { id: 'stats',   label: '📊 Stats'  },
  { id: 'credits', label: '🪙 Credits'},
  { id: 'special', label: '💎 Special'},
]

const STAT_COLORS = { int: 'var(--int)', str: 'var(--str)', dis: 'var(--dis)', soc: 'var(--soc)' }

import { useState } from 'react'

export default function AchievementsPage() {
  const { profile } = useGame()
  const [cat, setCat] = useState('all')

  const unlockedCodes = new Set(
    (profile?.recent_achievements ?? []).map(a => a.achievement_id)
  )

  const char    = profile?.character
  const stats   = profile?.stats
  const credits = profile?.credits

  // Derive progress from profile data
  function getProgress(a) {
    if (!profile) return { current: 0, pct: 0, unlocked: false }
    let current = 0
    switch (a.cat) {
      case 'streak':  current = char?.streak_days ?? 0; break
      case 'level':   current = char?.level ?? 0; break
      case 'tasks':   current = char?.tasks_completed ?? 0; break
      case 'credits': current = credits?.lifetime_earned ?? 0; break
      case 'stats':
        if (a.stat) {
          const key = a.stat === 'int' ? 'intelligence' : a.stat === 'str' ? 'strength' : a.stat === 'dis' ? 'discipline' : 'social'
          current = stats?.[key] ?? 0
        }
        break
      case 'special':
        // approximate from what we know
        if (a.code === 'all_stats_50') {
          current = ['intelligence','strength','discipline','social'].filter(s => (stats?.[s] ?? 0) >= 50).length
        } else {
          current = unlockedCodes.has(a.code) ? 1 : 0
        }
        break
      default: current = 0
    }
    const unlocked = current >= a.threshold
    const pct      = Math.min(100, Math.round((current / a.threshold) * 100))
    return { current, pct, unlocked }
  }

  const filtered = cat === 'all' ? ALL_ACHIEVEMENTS : ALL_ACHIEVEMENTS.filter(a => a.cat === cat)
  const unlocked = ALL_ACHIEVEMENTS.filter(a => getProgress(a).unlocked).length

  return (
    <div className="page-z">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1>Achievements</h1>
        <div style={{ fontSize: 14, color: 'var(--dim)' }}>
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 20 }}>{unlocked}</span>
          <span> / {ALL_ACHIEVEMENTS.length} unlocked</span>
        </div>
      </div>
      <p style={{ color: 'var(--dim)', marginBottom: 20, fontSize: 15 }}>Complete real-life challenges to unlock titles, XP, and credits.</p>

      {/* Overall progress bar */}
      <div className="card card-gold fade-up" style={{ marginBottom: 24, padding: '16px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>Overall completion</span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{Math.round((unlocked / ALL_ACHIEVEMENTS.length) * 100)}%</span>
        </div>
        <div className="bar-bg" style={{ height: 10 }}>
          <div className="bar-fill bar-gold" style={{ width: `${(unlocked / ALL_ACHIEVEMENTS.length) * 100}%` }} />
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
          {CATEGORIES.slice(1).map(c => {
            const count    = ALL_ACHIEVEMENTS.filter(a => a.cat === c.id).length
            const unlockd  = ALL_ACHIEVEMENTS.filter(a => a.cat === c.id && getProgress(a).unlocked).length
            return (
              <div key={c.id} style={{ fontSize: 12, color: 'var(--faint)' }}>
                {c.label} <span style={{ color: unlockd === count ? 'var(--success)' : 'var(--dim)', fontWeight: 600 }}>{unlockd}/{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {CATEGORIES.map(c => (
          <button key={c.id}
            className={`btn btn-sm ${cat === c.id ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>

      {/* Achievement grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtered.map((a, i) => {
          const { current, pct, unlocked } = getProgress(a)
          const statColor = a.stat ? STAT_COLORS[a.stat] : null

          return (
            <div key={a.code}
              className={`card fade-up`}
              style={{
                animationDelay: `${i * 0.04}s`,
                opacity: unlocked ? 1 : 0.65,
                border: unlocked ? '1px solid var(--border-g)' : '1px solid var(--border)',
                background: unlocked ? 'linear-gradient(135deg, var(--panel), var(--panel2))' : 'var(--panel)',
                position: 'relative', overflow: 'hidden', padding: '16px 18px',
                transition: 'transform 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!unlocked) e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = unlocked ? '1' : '0.65'; e.currentTarget.style.transform = 'none' }}>

              {/* Unlocked glow strip */}
              {unlocked && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: statColor ?? 'linear-gradient(90deg, var(--gold2), var(--gold))',
                }} />
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                  background: unlocked ? (statColor ? `${statColor}20` : 'var(--gold-glow)') : 'var(--bg2)',
                  border: `1px solid ${unlocked ? (statColor ?? 'var(--border-g)') : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  filter: unlocked ? 'none' : 'grayscale(0.6)',
                }}>{a.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: unlocked ? (statColor ?? 'var(--gold)') : 'var(--text)',
                    marginBottom: 2,
                  }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.4 }}>{a.desc}</div>
                </div>

                {unlocked && (
                  <div style={{ fontSize: 18, color: 'var(--success)', flexShrink: 0 }}>✓</div>
                )}
              </div>

              {/* Progress bar */}
              {!unlocked && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>
                    <span>{current.toLocaleString()} / {a.threshold.toLocaleString()}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="bar-bg" style={{ height: 5 }}>
                    <div className="bar-fill" style={{
                      width: `${pct}%`,
                      background: statColor ?? 'var(--gold)',
                    }} />
                  </div>
                </div>
              )}

              {/* Rewards */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.reward_xp > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--dis)', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 99 }}>
                    +{a.reward_xp} XP
                  </span>
                )}
                {a.reward_credits > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(240,180,41,0.1)', padding: '2px 8px', borderRadius: 99 }}>
                    +{a.reward_credits} 🪙
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
