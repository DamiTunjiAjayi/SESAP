// Customer Portal — the end-user interface (raise & track your own requests).
// Deliberately scoped: no admin command centre, no all-tickets queue, no
// assign/escalate/delete, no internal notes/audit. Users only see their own data.
import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { CATEGORIES, PRIORITIES, BUSINESS_SERVICES, STATUSES, knowledgeArticles, announcements } from '../data.js'
import { STATUS_LABELS, timeAgo, formatDateTime, titleCase, humanBytes } from '../utils.js'
import { StatusBadge, PriorityBadge, Avatar, AnimatedNumber } from '../components/ui/primitives.jsx'
import AICopilot from '../components/AICopilot.jsx'

const NAV = [
  ['home', 'Home', '🏠'],
  ['requests', 'My Requests', '🎫'],
  ['raise', 'Raise a Request', '＋'],
  ['knowledge', 'Knowledge Base', '📚'],
]

export default function CustomerPortal() {
  const { user, logout, theme, toggleTheme, tickets } = useApp()
  const [view, setView] = useState('home')
  const [openId, setOpenId] = useState(null)
  const [copilotOpen, setCopilotOpen] = useState(false)

  const mine = useMemo(
    () => tickets.filter((t) => t.requesterEmail === user?.email).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [tickets, user],
  )
  const openTicket = mine.find((t) => t.id === openId) || null

  return (
    <div className="portal">
      <header className="portal-top">
        <div className="landing-brand" style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
          <div className="logo">S</div>
          <div><b>SESAP</b><span>Customer Portal</span></div>
        </div>
        <nav className="portal-nav">
          {NAV.map(([key, label, ico]) => (
            <button key={key} className={`portal-link ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>
              <span>{ico}</span> {label}
            </button>
          ))}
        </nav>
        <div className="portal-top-actions">
          <button className="icon-btn" title="AI Assistant" onClick={() => setCopilotOpen((o) => !o)}>✨</button>
          <button className="icon-btn" title="Theme" onClick={toggleTheme}>{theme === 'dark' ? '🌙' : '☀️'}</button>
          <div className="portal-user">
            <Avatar name={user?.name} initials={user?.initials} size="sm" />
            <span className="pu-name">{user?.name?.split(' ')[0]}</span>
            <button className="btn ghost sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </header>

      <main>
        {view === 'home' && <PortalHome mine={mine} user={user} onOpen={setOpenId} go={setView} />}
        {view === 'requests' && <MyRequests mine={mine} onOpen={setOpenId} go={setView} />}
        {view === 'raise' && <RaiseRequest onDone={() => setView('requests')} />}
        {view === 'knowledge' && <PortalKnowledge />}
      </main>

      {openTicket && <CustomerTicket ticket={openTicket} onClose={() => setOpenId(null)} />}

      <button className="copilot-fab" title="AI Assistant" onClick={() => setCopilotOpen((o) => !o)}>{copilotOpen ? '✕' : '✨'}</button>
      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} tickets={mine}
        greeting={`Hi ${user?.name?.split(' ')[0]} 👋 I can help you track your requests. Ask about the status of your tickets or how to raise a new one.`} />
    </div>
  )
}

/* ---- Home ---------------------------------------------------------------- */
function PortalHome({ mine, user, onOpen, go }) {
  const open = mine.filter((t) => t.status === 'open').length
  const prog = mine.filter((t) => t.status === 'in_progress').length
  const resolved = mine.filter((t) => t.status === 'resolved' || t.status === 'closed').length

  return (
    <div className="portal-page">
      <section className="portal-hero">
        <div>
          <span className="hero-pill">🏦 Stanbic IBTC Support</span>
          <h1>Hello, {user?.name?.split(' ')[0]} 👋</h1>
          <p>Raise a new request or track the status of your existing ones. Our team is here to help.</p>
          <div className="hero-cta">
            <button className="btn primary lg" onClick={() => go('raise')}>＋ Raise a Request</button>
            <button className="btn ghost lg" onClick={() => go('requests')}>View My Requests</button>
          </div>
        </div>
        <div className="portal-hero-stats">
          <div className="phs"><div className="phs-num"><AnimatedNumber value={open} /></div><div className="phs-lbl">Open</div></div>
          <div className="phs"><div className="phs-num"><AnimatedNumber value={prog} /></div><div className="phs-lbl">In progress</div></div>
          <div className="phs"><div className="phs-num"><AnimatedNumber value={resolved} /></div><div className="phs-lbl">Resolved</div></div>
        </div>
      </section>

      <div className="grid-12" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="card-head"><h3>Recent requests</h3><button className="btn ghost sm" onClick={() => go('requests')}>View all →</button></div>
          {mine.slice(0, 4).map((t) => <RequestRow key={t.id} t={t} onOpen={onOpen} />)}
          {mine.length === 0 && <div className="muted" style={{ padding: 16 }}>You have no requests yet.</div>}
        </div>
        <div className="card">
          <div className="card-head"><h3>Announcements</h3></div>
          {announcements.map((a) => (
            <div className="feed-item" key={a.id}>
              <span className="feed-ico">📢</span>
              <div className="feed-body"><p><b>{a.title}</b></p><div className="t">{a.body}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---- My Requests --------------------------------------------------------- */
function MyRequests({ mine, onOpen, go }) {
  const [filter, setFilter] = useState('all')
  const list = mine.filter((t) => filter === 'all' || (filter === 'active' ? t.status === 'open' || t.status === 'in_progress' : t.status === filter))
  return (
    <div className="portal-page">
      <div className="page-head">
        <div><h1>My Requests</h1><p className="sub">Track and reply to your support requests.</p></div>
        <button className="btn primary" onClick={() => go('raise')}>＋ Raise a Request</button>
      </div>
      <div className="toolbar">
        {['all', 'active', 'resolved', 'closed'].map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : titleCase(f)}</button>
        ))}
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{list.length} request(s)</span>
      </div>
      <div className="card pad-0">
        {list.map((t) => <RequestRow key={t.id} t={t} onOpen={onOpen} bordered />)}
        {list.length === 0 && <div className="empty-state"><div className="big-ico">🎫</div>No requests here.</div>}
      </div>
    </div>
  )
}

function RequestRow({ t, onOpen, bordered }) {
  return (
    <div className="req-row" style={bordered ? { borderBottom: '1px solid var(--border)' } : {}} onClick={() => onOpen(t.id)}>
      <div className="req-main">
        <div className="req-title"><span className="cell-ref">{t.ref}</span> {t.subject}</div>
        <div className="req-sub">{t.category} · updated {timeAgo(t.updatedAt)}</div>
      </div>
      <PriorityBadge priority={t.priority} />
      <StatusBadge status={t.status} />
    </div>
  )
}

/* ---- Raise a Request ----------------------------------------------------- */
function RaiseRequest({ onDone }) {
  const { createTicket, uploadFiles, user } = useApp()
  // Internal Requests are a staff-only (procurement) category — not for customers.
  const CAT_KEYS = Object.keys(CATEGORIES).filter((c) => c !== 'Internal Requests')
  const [f, setF] = useState({ subject: '', description: '', category: CAT_KEYS[0], subCategory: CATEGORIES[CAT_KEYS[0]][0], priority: 'medium', businessService: BUSINESS_SERVICES[0] })
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  function submit(e) {
    e.preventDefault()
    if (!f.subject.trim()) return setError('Please describe your issue in the subject.')
    const created = createTicket({
      subject: f.subject.trim(),
      description: f.description.trim(),
      requester: user.name,
      requesterEmail: user.email,
      priority: f.priority,
      category: f.category,
      subCategory: f.subCategory,
      department: 'Retail Banking',
      channel: 'Portal',
      team: 'Tier 1 Support',
      businessService: f.businessService,
      riskLevel: 'Low',
      status: 'open',
      assignee: null,
      assigneeEmail: null,
      tags: [],
    })
    // Attach any chosen files (persisted to the Storage Bucket) to the new ticket.
    // Pass the ref explicitly — the new ticket isn't in state yet at this point.
    if (created && files.length) uploadFiles(created.id, files, created.ref)
    onDone()
  }

  return (
    <div className="portal-page">
      <div className="page-head"><div><h1>Raise a Request</h1><p className="sub">Tell us what you need help with — we'll route it to the right team.</p></div></div>
      <form className="form-card" onSubmit={submit}>
        <div className="form-grid">
          <div className="field full"><label>What do you need help with? *</label>
            <input value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. My card was declined at an ATM" /></div>
          <div className="field full"><label>Details</label>
            <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe what happened, when, and any error messages" /></div>
          <div className="field full"><label>Attachments (optional)</label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {files.length > 0
                ? `${files.length} file(s) attached: ${files.map((x) => x.name).join(', ')}`
                : 'Attach a screenshot, statement or document to help us resolve faster.'}
            </div>
          </div>
          <div className="field"><label>Category</label>
            <select value={f.category} onChange={(e) => { set('category', e.target.value); set('subCategory', CATEGORIES[e.target.value][0]) }}>
              {CAT_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="field"><label>Sub-category</label>
            <select value={f.subCategory} onChange={(e) => set('subCategory', e.target.value)}>
              {CATEGORIES[f.category].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="field"><label>Priority</label>
            <select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
            </select></div>
          <div className="field"><label>Related service</label>
            <select value={f.businessService} onChange={(e) => set('businessService', e.target.value)}>
              {BUSINESS_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </div>
        <div className="form-note"><span>💬</span><span>You'll be able to track progress and reply to our team under <b>My Requests</b> once submitted.</span></div>
        {error && <div className="form-err">{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn" onClick={onDone}>Cancel</button>
          <button type="submit" className="btn primary">Submit Request</button>
        </div>
      </form>
    </div>
  )
}

/* ---- Knowledge (reused, read-only cards) --------------------------------- */
function PortalKnowledge() {
  const [q, setQ] = useState('')
  const items = knowledgeArticles.filter((a) => !q.trim() || (a.title + a.summary).toLowerCase().includes(q.toLowerCase()))
  const cls = (t) => `kb-type ${t === 'Known Error' ? 'kb-type-known' : t}`
  return (
    <div className="portal-page">
      <div className="page-head"><div><h1>Knowledge Base</h1><p className="sub">Answers to common questions and how-to guides.</p></div></div>
      <div className="toolbar"><div className="search-mini"><span className="i">🔎</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" /></div></div>
      <div className="kb-grid">
        {items.map((a) => (
          <div className="kb-card" key={a.id}>
            <span className={cls(a.type)}>{a.type}</span>
            <h3>{a.title}</h3><p>{a.summary}</p>
            <div className="meta">{a.category} · {a.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- Customer ticket view (read-mostly + reply + attach) ----------------- */
function CustomerTicket({ ticket: t, onClose }) {
  const { addComment, uploadFiles, user } = useApp()
  const [reply, setReply] = useState('')
  const stepIndex = STATUSES.indexOf(t.status)
  const updates = [...(t.activity || [])].filter((a) => a.type === 'comment' || a.type === 'created').sort((a, b) => new Date(a.at) - new Date(b.at))

  return (
    <div className="ws-overlay" onMouseDown={onClose}>
      <aside className="ws" onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(620px, 100vw)' }}>
        <div className="ws-header">
          <div className="ws-header-top">
            <div><span className="ws-ref">{t.ref}</span><h2>{t.subject}</h2>
              <div className="ws-badges"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /><span className="tag">{t.category}</span></div>
            </div>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ws-body">
          {/* Status tracker */}
          <div className="status-steps">
            {STATUSES.map((s, i) => (
              <div key={s} className={`step ${i <= stepIndex ? 'done' : ''} ${i === stepIndex ? 'current' : ''}`}>
                <span className="step-dot">{i < stepIndex ? '✓' : i + 1}</span>
                <span className="step-lbl">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ margin: '18px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
              <div><span className="muted" style={{ fontSize: 12 }}>Logged</span><div>{formatDateTime(t.createdAt)}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Handled by</span><div>{t.assignee || 'Being assigned'}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Service</span><div>{t.businessService}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>Category</span><div>{t.category} · {t.subCategory}</div></div>
            </div>
          </div>

          {t.description && (<><div className="ws-section-title">Your description</div><p style={{ marginTop: 0 }}>{t.description}</p></>)}

          <div className="ws-section-title" style={{ marginTop: 18 }}>Conversation</div>
          <ul className="timeline">
            {updates.map((a, i) => (
              <li className="tl-item" key={i}>
                <span className="tl-ico">{a.author === user.name ? '🙋' : '🏦'}</span>
                <div className="tl-body"><p>{a.text}</p><span className="t">{a.author === user.name ? 'You' : a.author} · {timeAgo(a.at)}</span></div>
              </li>
            ))}
          </ul>

          {t.attachments?.length > 0 && (
            <>
              <div className="ws-section-title" style={{ marginTop: 18 }}>Attachments</div>
              <ul className="attach-list">
                {t.attachments.map((a) => (
                  <li key={a.id}><span>📎</span><div className="attach-meta">{a.url ? <a href={a.url} download={a.name}>{a.name}</a> : <span>{a.name}</span>}<small>{humanBytes(a.size)}</small></div></li>
                ))}
              </ul>
            </>
          )}

          {(t.status === 'open' || t.status === 'in_progress') && (
            <div className="comment-box" style={{ marginTop: 18 }}>
              <textarea rows={3} placeholder="Reply to the support team…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  📎 Attach
                  <input type="file" multiple hidden onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) uploadFiles(t.id, files); e.target.value = '' }} />
                </label>
                <button className="btn primary sm" disabled={!reply.trim()} onClick={() => { addComment(t.id, reply.trim(), user.name); setReply('') }}>Send reply</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
