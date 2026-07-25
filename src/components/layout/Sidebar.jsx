// Collapsible left navigation for the SESAP workspace.
import { useApp } from '../../context/AppContext.jsx'
import { isOverdue, isActive, isAssignedTo } from '../../utils.js'

// `roles` gates an item to a role. Absent → visible to every staff member.
// Three distinct experiences: a supervisor sees the full command centre
// (team KPIs, Approvals/HITL, Reports, Automation, Audit); an agent sees a lean,
// queue-focused workspace centred on the work assigned to them.
const NAV = [
  { section: 'Operations' },
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'assigned', label: 'Assigned To Me', icon: '📥', countKey: 'assigned', roles: ['agent'] },
  { key: 'queue', label: 'Ticket Queue', icon: '☰', countKey: 'all' },
  { key: 'create', label: 'Create Ticket', icon: '＋' },
  { key: 'my', label: 'My Tickets', icon: '👤' },
  { key: 'assigned', label: 'Assigned To Me', icon: '📥', countKey: 'assigned', roles: ['supervisor'] },
  { key: 'approvals', label: 'Approvals', icon: '✅', countKey: 'pending', roles: ['supervisor'] },
  { section: 'Priority' },
  { key: 'high', label: 'High Priority', icon: '🔺', countKey: 'high' },
  { key: 'overdue', label: 'Overdue', icon: '⏰', countKey: 'overdue' },
  { key: 'escalations', label: 'Escalations', icon: '⚠️', countKey: 'escalated' },
  { section: 'Insight' },
  { key: 'reports', label: 'Reports', icon: '📊', roles: ['supervisor'] },
  { key: 'automation', label: 'Automation Health', icon: '🤖', roles: ['supervisor'] },
  { key: 'knowledge', label: 'Knowledge Base', icon: '📚' },
  { key: 'audit', label: 'Audit Trail', icon: '🧾', roles: ['supervisor'] },
  { section: 'System' },
  { key: 'notifications', label: 'Notifications', icon: '🔔', countKey: 'unread' },
  { key: 'copilot', label: 'AI Assistant', icon: '✨' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'help', label: 'Help Centre', icon: '❓' },
]

export default function Sidebar() {
  const { view, navigate, sidebarCollapsed, setSidebarCollapsed, tickets, unreadCount, user, role } = useApp()
  const roleKey = (role || '').toLowerCase() // 'supervisor' | 'agent'

  const counts = {
    all: tickets.length,
    assigned: tickets.filter((t) => isAssignedTo(t, user) && isActive(t)).length,
    high: tickets.filter((t) => (t.priority === 'high' || t.priority === 'urgent') && isActive(t)).length,
    overdue: tickets.filter(isOverdue).length,
    escalated: tickets.filter((t) => t.escalated && isActive(t)).length,
    pending: tickets.filter((t) => t.approvalStatus === 'pending').length,
    unread: unreadCount,
  }

  // Keep only items this role may see, then drop any section header left with no
  // items under it (so an agent never sees an empty "Insight" heading).
  const visible = NAV.filter((it) => !it.roles || it.roles.includes(roleKey))
  const nav = visible.filter((it, i) => {
    if (!it.section) return true
    const next = visible[i + 1]
    return next && !next.section
  })

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo"><b>S</b></div>
        <div className="sidebar-brand-text">
          <strong>SESAP</strong>
          <span>Enterprise Support</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map((item, i) =>
          item.section ? (
            <div className="nav-section" key={`s-${i}`}>{item.section}</div>
          ) : (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => navigate(item.key)}
              title={item.label}
            >
              <span className="nav-ico">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.countKey && counts[item.countKey] > 0 && (
                <span className="nav-count">{counts[item.countKey]}</span>
              )}
            </button>
          ),
        )}
      </nav>

      <div className="sidebar-foot">
        <button className="nav-item sidebar-collapse-btn" onClick={() => setSidebarCollapsed((c) => !c)}>
          <span className="nav-ico">{sidebarCollapsed ? '»' : '«'}</span>
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </aside>
  )
}
