import { useState } from 'react'
import { useGame }  from '../context/GameContext.jsx'

const LOAN_PRESETS = [
  { amount: 50,  label: 'Quick Fix',    icon: '⚡', desc: 'Social media hour or snack' },
  { amount: 100, label: 'Evening Off',  icon: '🎮', desc: 'Gaming session or movie' },
  { amount: 200, label: 'Rest Day',     icon: '😴', desc: 'Full day of relaxation' },
  { amount: 500, label: 'Big Reward',   icon: '👑', desc: 'Major treat — high risk' },
]

const REWARD_IDEAS = [
  { label: 'Social media 1hr',    cost: 50,  icon: '📱', penalty: '-3 Discipline' },
  { label: 'Gaming session 2hr',  cost: 120, icon: '🎮', penalty: '-5 Discipline' },
  { label: 'Netflix binge',       cost: 80,  icon: '🎬', penalty: null },
  { label: 'Junk food day',       cost: 150, icon: '🍕', penalty: '-2 Strength' },
  { label: 'Full rest day',       cost: 200, icon: '☕', penalty: null },
  { label: 'Major purchase',      cost: 500, icon: '🎁', penalty: null },
]

export default function LoansPage() {
  const { profile, takeLoan, repayLoan, showToast } = useGame()

  const [amount,      setAmount]      = useState(100)
  const [description, setDescription] = useState('')
  const [repayAmt,    setRepayAmt]    = useState('')
  const [loading,     setLoading]     = useState(false)

  const loan    = profile?.active_loan
  const credits = profile?.credits?.balance ?? 0
  const level   = profile?.character?.level ?? 1

  const locked = level < 15

  async function handleTakeLoan(e) {
    e.preventDefault()
    if (locked) return showToast('warning', 'Locked', 'Loans unlock at Level 15')
    if (loan)   return showToast('warning', 'Active loan', 'Clear your current loan first')
    setLoading(true)
    try {
      const res = await takeLoan({ amount, rewardDescription: description || undefined })
      showToast('success', 'Loan Granted!', res.message)
      setDescription('')
    } catch (err) {
      showToast('error', 'Failed', err.message)
    } finally { setLoading(false) }
  }

  async function handleRepay(e) {
    e.preventDefault()
    const amt = parseInt(repayAmt, 10)
    if (!amt || amt <= 0) return showToast('warning', 'Invalid', 'Enter a valid amount')
    if (amt > credits)    return showToast('warning', 'Not enough credits', `You only have ${credits}`)
    setLoading(true)
    try {
      const res = await repayLoan({ loanId: loan.id, amount: amt })
      showToast('success', 'Repaid!', res.message)
      setRepayAmt('')
    } catch (err) {
      showToast('error', 'Failed', err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="page-z">
      <h1 style={{ marginBottom: 6 }}>Loan System</h1>
      <p style={{ color: 'var(--dim)', marginBottom: 24, fontSize: 15 }}>
        Spend now, pay later. Borrow credits for rewards — task earnings auto-repay your debt.
      </p>

      {/* Level lock */}
      {locked && (
        <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 14, color: 'var(--dis)' }}>
          🔒 Loans unlock at <strong>Level 15</strong>. You are Level {level}. Keep completing quests!
        </div>
      )}

      {/* Active Loan Panel */}
      {loan && (
        <div className="card card-gold fade-up" style={{
          marginBottom: 24,
          borderColor: loan.danger_level === 'critical' ? 'rgba(239,68,68,0.5)' : 'var(--border-g)',
          animation: loan.danger_level === 'critical' ? 'pulse-gold 1.5s infinite' : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18 }}>🏦 Active Loan</h2>
            <span className={loan.danger_level === 'critical' ? 'tag tag-danger' : loan.danger_level === 'warning' ? 'tag' : 'tag tag-gold'}
              style={loan.danger_level === 'warning' ? { background: 'rgba(217,119,6,0.12)', color: '#D97706', border: '1px solid rgba(217,119,6,0.3)' } : {}}>
              {loan.danger_level === 'critical' ? '🚨 Critical' : loan.danger_level === 'warning' ? '⚠️ Warning' : '✅ On Track'}
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Balance',    val: `${loan.current_balance} cr`, color: 'var(--danger)' },
              { label: 'Principal',  val: `${loan.principal} cr`,       color: 'var(--text)' },
              { label: 'Repaid',     val: `${loan.repaid_amount} cr`,   color: 'var(--success)' },
              { label: 'Overdue',    val: loan.days_overdue > 0 ? `${loan.days_overdue}d` : 'None', color: loan.days_overdue > 0 ? 'var(--danger)' : 'var(--success)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Repayment progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--dim)' }}>Repayment progress</span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{loan.repay_progress}%</span>
            </div>
            <div className="bar-bg" style={{ height: 10 }}>
              <div className="bar-fill" style={{ width: `${loan.repay_progress}%`, background: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>
              60% of all task earnings automatically applied to loan
            </div>
          </div>

          {/* Manual repay form */}
          <form onSubmit={handleRepay} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="input-label">Manual repay amount</label>
              <input className="input" type="number" min="1" max={Math.min(loan.current_balance, credits)}
                placeholder={`Max: ${Math.min(loan.current_balance, credits)}`}
                value={repayAmt} onChange={e => setRepayAmt(e.target.value)} />
            </div>
            <button className="btn btn-gold" type="submit" disabled={loading || !repayAmt} style={{ height: 42, marginBottom: 0 }}>
              Repay
            </button>
          </form>

          {loan.danger_level === 'critical' && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
              🚨 <strong>WARNING:</strong> Balance approaching default threshold ({loan.defaults_at} cr). Default = -{loan.principal > 0 ? 5 : '?'} stat penalty + "In Debt" badge on leaderboard.
            </div>
          )}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Take loan form */}
        <div className="card fade-up-1">
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>💸 Take a Loan</h2>
          <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 18 }}>You'll receive credits now. 60% of future task earnings auto-repay until cleared.</p>

          <form onSubmit={handleTakeLoan}>
            {/* Preset buttons */}
            <div className="input-group">
              <label className="input-label">Quick amounts</label>
              <div className="grid-2">
                {LOAN_PRESETS.map(p => (
                  <button key={p.amount} type="button"
                    onClick={() => setAmount(p.amount)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, border: '1px solid',
                      borderColor: amount === p.amount ? 'var(--gold)' : 'var(--border)',
                      background: amount === p.amount ? 'var(--gold-glow)' : 'var(--bg2)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{p.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: amount === p.amount ? 'var(--gold)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, fontFamily: 'var(--font-body)' }}>{p.amount} credits</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Custom amount (50–500)</label>
              <input className="input" type="number" min="50" max="500"
                value={amount} onChange={e => setAmount(parseInt(e.target.value, 10) || 50)} />
            </div>

            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">What's the reward? (optional)</label>
              <input className="input" placeholder="e.g. Gaming session tonight"
                value={description} onChange={e => setDescription(e.target.value)} maxLength={100} />
            </div>

            {/* Terms summary */}
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 13, color: 'var(--dim)', lineHeight: 1.7 }}>
              <div>✅ <strong style={{ color: 'var(--text)' }}>{amount} credits</strong> added to balance immediately</div>
              <div>📅 <strong style={{ color: 'var(--text)' }}>0% interest</strong> for 3 days</div>
              <div>📈 <strong style={{ color: 'var(--danger)' }}>+10%/day</strong> after grace period</div>
              <div>💳 <strong style={{ color: 'var(--text)' }}>60%</strong> of task earnings auto-deducted</div>
            </div>

            <button className="btn btn-gold btn-full" type="submit" disabled={loading || !!loan || locked}>
              {loan ? 'Clear active loan first' : locked ? 'Unlocks at Level 15' : `Borrow ${amount} Credits`}
            </button>
          </form>
        </div>

        {/* Reward ideas */}
        <div className="card fade-up-2">
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>🎁 Reward Ideas</h2>
          <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 18 }}>What could you spend borrowed credits on?</p>
          {REWARD_IDEAS.map((r, i) => (
            <div key={i} onClick={() => { setAmount(r.cost); setDescription(r.label) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--bg2)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-g)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
              <span style={{ fontSize: 22 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
                {r.penalty && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 1 }}>⚠️ {r.penalty}</div>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{r.cost} 🪙</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
