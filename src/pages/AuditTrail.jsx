// Global audit trail — every activity event across all tickets.
import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { formatDateTime } from '../utils.js'

const TYPES = ['all', 'created', 'status', 'assign', 'priority', 'comment', 'attachment']
const ICON = { created: '🆕', comment: '💬', status: '🔄', priority: '⚑', assign: '👤', attachment: '📎' }

export default function AuditTrail() {
  const { tickets, setOpenTicketId } = useApp()
  const [type, setType] = useState('all')

  const rows = useMemo(() => {
    return tickets
      .flatMap((t) => (t.activity || []).map((a) => ({ ...a, ref: t.ref, id: t.id })))
      .filter((r) => type === 'all' || r.type === type)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 200)
  }, [tickets, type])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Audit Trail</div>
          <h1>Audit Trail</h1>
          <p className="sub">Immutable log of every action across all tickets.</p>
        </div>
      </div>

      <div className="toolbar">
        {TYPES.map((t) => <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t === 'all' ? 'All events' : t}</button>)}
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{rows.length} events</span>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Ticket</th><th>Event</th><th>Actor</th><th>Timestamp</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} onClick={() => setOpenTicketId(r.id)}>
                  <td><span className="tag">{ICON[r.type] || '•'} {r.type}</span></td>
                  <td className="cell-ref">{r.ref}</td>
                  <td>{r.text}</td>
                  <td>{r.author}</td>
                  <td className="muted">{formatDateTime(r.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
