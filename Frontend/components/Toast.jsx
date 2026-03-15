import { useGame } from '../context/GameContext.jsx'

const ICONS = { success: '⚔️', error: '❌', info: '📜', warning: '⚠️' }

export default function Toast() {
  const { toast } = useGame()
  if (!toast) return null
  return (
    <div className="toast-root">
      <div className="toast">
        <span className="toast-icon">{ICONS[toast.type] ?? '🎯'}</span>
        <div>
          <div className="toast-title">{toast.title}</div>
          {toast.msg && <div className="toast-msg">{toast.msg}</div>}
        </div>
      </div>
    </div>
  )
}
