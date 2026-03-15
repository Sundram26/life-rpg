const STAT_CONFIG = {
  intelligence: { icon: '📘', label: 'Intelligence', cls: 'bar-int',  color: 'var(--int)' },
  strength:     { icon: '💪', label: 'Strength',     cls: 'bar-str',  color: 'var(--str)' },
  discipline:   { icon: '🎯', label: 'Discipline',   cls: 'bar-dis',  color: 'var(--dis)' },
  social:       { icon: '🤝', label: 'Social',       cls: 'bar-soc',  color: 'var(--soc)' },
}

export function StatBar({ stat, value }) {
  const cfg = STAT_CONFIG[stat]
  if (!cfg) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600 }}>
          <span>{cfg.icon}</span>
          <span style={{ color: cfg.color }}>{cfg.label}</span>
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: cfg.color }}>{value}</span>
      </div>
      <div className="bar-bg" style={{ height: 8 }}>
        <div className={`bar-fill ${cfg.cls}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

export { STAT_CONFIG }
