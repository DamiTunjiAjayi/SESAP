// Enterprise ticket queue: search, filters, sorting, column toggles, bulk actions.
import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ENGINEERS, DEPARTMENTS, STATUSES, PRIORITIES, CHANNELS } from '../data.js'
import { dueLabel, isOverdue, isActive, isAssignedTo, exportCSV, exportExcel, titleCase } from '../utils.js'
import { StatusBadge, PriorityBadge, RiskBadge, Avatar } from '../components/ui/primitives.jsx'

const PRESETS = {
  queue: { title: 'Ticket Queue', sub: 'All support tickets across the bank' },
  my: { title: 'My Tickets', sub: 'Tickets assigned to you' },
  assigned: { title: 'Assigned To Me', sub: 'Active tickets in your queue' },
  high: { title: 'High Priority', sub: 'High and urgent priority tickets' },
  overdue: { title: 'Overdue', sub: 'Tickets past their SLA deadline' },
  escalations: { title: 'Escalations', sub: 'Escalated tickets requiring attention' },
  approvals: { title: 'Approvals', sub: 'Tickets awaiting your sign-off (human-in-the-loop)' },
}

const OPT_COLS = [
  ['department', 'Department'],
  ['channel', 'Channel'],
  ['team', 'Team'],
  ['risk', 'Risk'],
  ['service', 'Business Service'],
  ['logged', 'Date Logged'],
]

export default function TicketQueue({ preset = 'queue' }) {
  const { tickets, user, setOpenTicketId, bulkSetStatus, bulkAssign, bulkEscalate, bulkDelete, setStatus } = useApp()
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [fPriority, setFPriority] = useState('all')
  const [fDept, setFDept] = useState('all')
  const [sortKey, setSortKey] = useState('updatedAt')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(() => new Set())
  const [cols, setCols] = useState({ department: true, channel: false, team: false, risk: true, service: false, logged: true })
  const [showCols, setShowCols] = useState(false)
  const [bulkEng, setBulkEng] = useState('')

  const meta = PRESETS[preset] || PRESETS.queue

  const base = useMemo(() => {
    return tickets.filter((t) => {
      if (preset === 'my') return isAssignedTo(t, user)
      if (preset === 'assigned') return isAssignedTo(t, user) && isActive(t)
      if (preset === 'high') return (t.priority === 'high' || t.priority === 'urgent') && isActive(t)
      if (preset === 'overdue') return isOverdue(t)
      if (preset === 'escalations') return t.escalated
      if (preset === 'approvals') return t.approvalStatus === 'pending'
      return true
    })
  }, [tickets, preset, user])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = base
      .filter((t) => fStatus === 'all' || t.status === fStatus)
      .filter((t) => fPriority === 'all' || t.priority === fPriority)
      .filter((t) => fDept === 'all' || t.department === fDept)
      .filter((t) => {
        if (!q) return true
        return [t.ref, t.subject, t.requester, t.assignee, (t.tags || []).join(' ')].join(' ').toLowerCase().includes(q)
      })
    const dir = sortDir === 'asc' ? 1 : -1
    const pOrder = { low: 0, medium: 1, high: 2, urgent: 3 }
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (sortKey === 'priority') { av = pOrder[a.priority]; bv = pOrder[b.priority] }
      if (sortKey === 'updatedAt' || sortKey === 'createdAt') { av = new Date(av); bv = new Date(bv) }
      return av > bv ? dir : av < bv ? -dir : 0
    })
    return list
  }, [base, search, fStatus, fPriority, fDept, sortKey, sortDir])

  function sortBy(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  function toggle(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll(checked) {
    setSelected(checked ? new Set(filtered.map((t) => t.id)) : new Set())
  }
  const selectedIds = [...selected]
  const allChecked = filtered.length > 0 && filtered.every((t) => selected.has(t.id))
  const selectedTickets = tickets.filter((t) => selected.has(t.id))

  function runBulkAssign(name) {
    const eng = ENGINEERS.find((e) => e.name === name)
    if (eng) { bulkAssign(selectedIds, eng); setBulkEng(''); setSelected(new Set()) }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / {meta.title}</div>
          <h1>{meta.title}</h1>
          <p className="sub">{meta.sub}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => exportCSV(filtered)}>⬇ CSV</button>
          <button className="btn" onClick={() => exportExcel(filtered)}>⬇ Excel</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-mini">
          <span className="i">🔎</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ref, subject, requester, tag…" />
        </div>
        <select className="filter-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select className="filter-select" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
        </select>
        <select className="filter-select" value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ position: 'relative' }}>
          <button className="btn" onClick={() => setShowCols((s) => !s)}>⚙ Columns</button>
          {showCols && (
            <div className="notif-panel" style={{ position: 'absolute', top: '110%', right: 0, left: 'auto', width: 210, padding: 10 }}>
              {OPT_COLS.map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!cols[key]} onChange={(e) => setCols((c) => ({ ...c, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{filtered.length} of {base.length}</span>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
                <th onClick={() => sortBy('ref')} style={{ cursor: 'pointer' }}>Ref{arrow('ref')}</th>
                <th onClick={() => sortBy('subject')} style={{ cursor: 'pointer' }}>Subject{arrow('subject')}</th>
                <th onClick={() => sortBy('priority')} style={{ cursor: 'pointer' }}>Priority{arrow('priority')}</th>
                <th>Status</th>
                <th>Assignee</th>
                {cols.department && <th>Department</th>}
                {cols.channel && <th>Channel</th>}
                {cols.team && <th>Team</th>}
                {cols.risk && <th>Risk</th>}
                {cols.service && <th>Service</th>}
                {cols.logged && <th onClick={() => sortBy('createdAt')} style={{ cursor: 'pointer' }}>Logged{arrow('createdAt')}</th>}
                <th onClick={() => sortBy('updatedAt')} style={{ cursor: 'pointer' }}>Due{arrow('updatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const due = dueLabel(t)
                return (
                  <tr key={t.id} className={`${isOverdue(t) ? 'overdue' : ''} ${selected.has(t.id) ? 'selected' : ''}`} onClick={() => setOpenTicketId(t.id)}>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                    <td className="cell-ref">{t.ref}{t.escalated && ' ⚠️'}</td>
                    <td className="cell-subject">
                      {t.subject}
                      <small>{t.category} · {t.subCategory}{t.attachments?.length ? ' · 📎' : ''}</small>
                    </td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select className="filter-select" style={{ padding: '5px 8px', fontSize: 12 }} value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                      </select>
                    </td>
                    <td>
                      {t.assignee ? <span className="assignee-cell"><Avatar name={t.assignee} size="sm" />{t.assignee}</span> : <span className="muted">Unassigned</span>}
                    </td>
                    {cols.department && <td className="muted">{t.department}</td>}
                    {cols.channel && <td><span className="tag">{t.channel}</span></td>}
                    {cols.team && <td className="muted">{t.team}</td>}
                    {cols.risk && <td><RiskBadge risk={t.riskLevel} /></td>}
                    {cols.service && <td className="muted">{t.businessService}</td>}
                    {cols.logged && <td className="muted" style={{ whiteSpace: 'nowrap' }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>}
                    <td>{due ? <span className={`countdown ${due.overdue ? 'bad' : due.soon ? 'ok' : ''}`} style={due.overdue || due.soon ? {} : { background: 'transparent', color: 'var(--muted)' }}>{due.text}</span> : <span className="muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty-state"><div className="big-ico">🗂️</div>No tickets match your filters.</div>}
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-bar">
          <span className="count">{selectedIds.length} selected</span>
          <select value="" onChange={(e) => e.target.value && bulkSetStatus(selectedIds, e.target.value)}>
            <option value="">Set status…</option>
            {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select value={bulkEng} onChange={(e) => runBulkAssign(e.target.value)}>
            <option value="">Assign to…</option>
            {ENGINEERS.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
          <button className="btn sm" onClick={() => { bulkEscalate(selectedIds); setSelected(new Set()) }}>⚠️ Escalate</button>
          <button className="btn sm" onClick={() => exportCSV(selectedTickets, 'sesap-selected')}>⬇ Export</button>
          <button className="btn sm" onClick={() => { bulkDelete(selectedIds); setSelected(new Set()) }}>🗑 Delete</button>
          <button className="btn sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
    </div>
  )
}
