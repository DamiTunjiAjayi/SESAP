// Notification centre with grouped alerts.
import { useApp } from '../context/AppContext.jsx'
import { timeAgo } from '../utils.js'

const GROUPS = [
  { key: 'assignment', label: 'Assignments', ico: '📥', bg: 'var(--blue-bg)', color: 'var(--blue)' },
  { key: 'escalation', label: 'Escalations', ico: '⚠️', bg: 'var(--red-bg)', color: 'var(--red)' },
  { key: 'sla', label: 'SLA Alerts', ico: '⏰', bg: 'var(--amber-bg)', color: 'var(--amber)' },
  { key: 'robot', label: 'Automation & Robots', ico: '🤖', bg: 'var(--violet-bg)', color: 'var(--violet)' },
  { key: 'approval', label: 'Approvals', ico: '✅', bg: 'var(--green-bg)', color: 'var(--green)' },
  { key: 'system', label: 'System', ico: '📢', bg: 'var(--surface-2)', color: 'var(--muted)' },
]

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllNotificationsRead, markNotificationRead, tickets, setOpenTicketId } = useApp()

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Notifications</div>
          <h1>Notification Centre</h1>
          <p className="sub">{unreadCount} unread · grouped by type</p>
        </div>
        <div className="page-actions"><button className="btn" onClick={markAllNotificationsRead}>Mark all read</button></div>
      </div>

      <div className="grid-2">
        {GROUPS.map((g) => {
          const items = notifications.filter((n) => (n.type || 'system') === g.key)
          return (
            <div className="chart-card" key={g.key}>
              <div className="card-head">
                <h3><span style={{ marginRight: 8 }}>{g.ico}</span>{g.label}</h3>
                <span className="tag">{items.length}</span>
              </div>
              {items.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>No notifications.</div>}
              {items.map((n) => (
                <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} style={{ borderRadius: 10, marginBottom: 4 }}
                  onClick={() => { markNotificationRead(n.id); if (n.ref) { const t = tickets.find((x) => x.ref === n.ref); if (t) setOpenTicketId(t.id) } }}>
                  <span className="notif-ico" style={{ background: g.bg, color: g.color }}>{g.ico}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <div className="t">{timeAgo(n.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
