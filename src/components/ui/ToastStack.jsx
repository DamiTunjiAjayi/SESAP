// Renders transient toast notifications from the app store.
import { useApp } from '../../context/AppContext.jsx'

const ICON = { success: '✓', info: 'ℹ', warning: '!', error: '✕' }

export default function ToastStack() {
  const { toasts, dismissToast } = useApp()
  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => dismissToast(t.id)}>
          <span className="t-ico">{ICON[t.type] || 'ℹ'}</span>
          <div className="t-body">
            <strong>{t.title}</strong>
            {t.message && <span>{t.message}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
