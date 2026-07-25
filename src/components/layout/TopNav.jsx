// Global top navigation: search, notifications, help, copilot, settings, profile.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { keywordSearch } from '../../copilot.js'
import { timeAgo } from '../../utils.js'
import { Avatar, StatusBadge } from '../ui/primitives.jsx'

const NOTIF_ICON = { assignment: '📥', comment: '💬', sla: '⏰', robot: '🤖', escalation: '⚠️', approval: '✅', system: '📢' }

export default function TopNav({ onOpenCopilot }) {
  const {
    tickets, setOpenTicketId, navigate, theme, toggleTheme, user, logout,
    notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
  } = useApp()

  const [q, setQ] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const searchRef = useRef(null)
  const notifRef = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setQ('')
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const results = q.trim() ? keywordSearch(q, tickets).slice(0, 6) : []

  return (
    <header className="topnav">
      <div className="topnav-search" ref={searchRef}>
        <span className="search-ico">🔎</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tickets by ref, subject, requester, tag…"
        />
        {results.length > 0 && (
          <div className="search-pop">
            {results.map((t) => (
              <div
                key={t.id}
                className="search-res"
                onClick={() => { setOpenTicketId(t.id); setQ('') }}
              >
                <span className="cell-ref">{t.ref}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="topnav-spacer" />

      <div className="topnav-actions">
        <button className="icon-btn" title="AI Assistant" onClick={onOpenCopilot}>✨</button>
        <button className="icon-btn" title="Help Centre" onClick={() => navigate('help')}>❓</button>
        <button className="icon-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        <div ref={notifRef} style={{ position: 'relative' }}>
          <button className="icon-btn" title="Notifications" onClick={() => setShowNotif((s) => !s)}>
            🔔{unreadCount > 0 && <span className="dot-badge">{unreadCount}</span>}
          </button>
          {showNotif && (
            <div className="notif-panel">
              <div className="notif-head">
                <strong>Notifications</strong>
                <button className="btn ghost sm" onClick={markAllNotificationsRead}>Mark all read</button>
              </div>
              <div className="notif-list">
                {notifications.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No notifications</div>}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.read ? '' : 'unread'}`}
                    onClick={() => { markNotificationRead(n.id); if (n.ref) { const t = tickets.find((x) => x.ref === n.ref); if (t) setOpenTicketId(t.id) } setShowNotif(false) }}
                  >
                    <span className="notif-ico" style={{ background: 'var(--brand-tint)' }}>{NOTIF_ICON[n.type] || '📢'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <div className="t">{timeAgo(n.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="icon-btn" title="Settings" onClick={() => navigate('settings')}>⚙️</button>

        <div ref={userRef} style={{ position: 'relative' }}>
          <div className="topnav-user" onClick={() => setShowUser((s) => !s)}>
            <Avatar name={user?.name} initials={user?.initials} size="sm" />
            <div className="u-meta">
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
          </div>
          {showUser && (
            <div className="notif-panel" style={{ width: 240, right: 0, left: 'auto' }}>
              <div className="notif-head"><strong>{user?.name}</strong></div>
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>{user?.email}</div>
              <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
                <button className="btn ghost block" onClick={() => { navigate('settings'); setShowUser(false) }}>Settings</button>
                <button className="btn ghost block" onClick={logout} style={{ color: 'var(--red)' }}>Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
