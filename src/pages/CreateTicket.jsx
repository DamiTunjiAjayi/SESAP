// Create a ticket, assign an engineer, and optionally email them on submit.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { CATEGORIES, DEPARTMENTS, TEAMS, CHANNELS, BUSINESS_SERVICES, PRIORITIES, RISK_LEVELS, ENGINEERS } from '../data.js'
import { titleCase } from '../utils.js'

const CAT_KEYS = Object.keys(CATEGORIES)

const EMPTY = {
  subject: '', description: '', requester: '', requesterEmail: '',
  priority: 'medium', category: CAT_KEYS[0], subCategory: CATEGORIES[CAT_KEYS[0]][0],
  department: DEPARTMENTS[0], channel: 'Portal', team: TEAMS[0],
  businessService: BUSINESS_SERVICES[0], riskLevel: 'Medium',
  assigneeName: '', tags: '', status: 'open',
}

export default function CreateTicket() {
  const { createTicket, uploadFiles, navigate } = useApp()
  const [f, setF] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState('')

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }))
  const subCats = CATEGORIES[f.category] || []
  const willNeedApproval = f.category === 'Internal Requests'

  function submit(e) {
    e.preventDefault()
    if (!f.subject.trim()) return setError('Subject is required.')
    if (!f.requester.trim()) return setError('Requester name is required.')
    const eng = ENGINEERS.find((x) => x.name === f.assigneeName) || null
    if (notify && eng && !eng.email) return setError('Selected assignee has no email on file.')

    const created = createTicket(
      {
        subject: f.subject.trim(),
        description: f.description.trim(),
        requester: f.requester.trim(),
        requesterEmail: f.requesterEmail.trim(),
        priority: f.priority,
        category: f.category,
        subCategory: f.subCategory,
        department: f.department,
        channel: f.channel,
        team: eng?.team || f.team,
        businessService: f.businessService,
        riskLevel: f.riskLevel,
        status: f.status,
        // Internal requests wait for approval — don't pre-assign them.
        assignee: willNeedApproval ? null : (eng?.name || null),
        assigneeEmail: willNeedApproval ? null : (eng?.email || null),
        tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean),
      },
      { notifyAssignee: notify && !willNeedApproval },
    )
    // Attach files (persisted to the Storage Bucket) to the new ticket. Pass the
    // ref explicitly — the new ticket isn't in state yet at this point.
    if (created && files.length) uploadFiles(created.id, files, created.ref)
    navigate('queue')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Create Ticket</div>
          <h1>Create Ticket</h1>
          <p className="sub">Log a new support request, classify it, and assign an engineer.</p>
        </div>
      </div>

      <form className="form-card" onSubmit={submit}>
        <div className="form-grid">
          <div className="field full">
            <label>Subject *</label>
            <input value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Short summary of the issue" />
          </div>
          <div className="field full">
            <label>Description</label>
            <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Detailed description, impact, and steps to reproduce" />
          </div>

          <div className="field">
            <label>Requester name *</label>
            <input value={f.requester} onChange={(e) => set('requester', e.target.value)} placeholder="Customer or staff name" />
          </div>
          <div className="field">
            <label>Requester email</label>
            <input type="email" value={f.requesterEmail} onChange={(e) => set('requesterEmail', e.target.value)} placeholder="name@example.com" />
          </div>

          <div className="field">
            <label>Category</label>
            <select value={f.category} onChange={(e) => { set('category', e.target.value); set('subCategory', CATEGORIES[e.target.value][0]) }}>
              {CAT_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sub-category</label>
            <select value={f.subCategory} onChange={(e) => set('subCategory', e.target.value)}>
              {subCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Priority</label>
            <select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Risk level</label>
            <select value={f.riskLevel} onChange={(e) => set('riskLevel', e.target.value)}>
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Department</label>
            <select value={f.department} onChange={(e) => set('department', e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Source channel</label>
            <select value={f.channel} onChange={(e) => set('channel', e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Business service</label>
            <select value={f.businessService} onChange={(e) => set('businessService', e.target.value)}>
              {BUSINESS_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Assign to engineer</label>
            <select value={f.assigneeName} onChange={(e) => set('assigneeName', e.target.value)}>
              <option value="">Unassigned</option>
              {ENGINEERS.map((e) => <option key={e.name} value={e.name}>{e.name} — {e.team}</option>)}
            </select>
          </div>

          <div className="field full">
            <label>Tags (comma-separated)</label>
            <input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. billing, vip, fx" />
          </div>

          <div className="field full">
            <label>Attachments</label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {files.length > 0
                ? `${files.length} file(s): ${files.map((x) => x.name).join(', ')}`
                : 'Attach quotes, invoices, forms or evidence — stored in the SESAP Storage Bucket.'}
            </div>
          </div>
        </div>

        {willNeedApproval && (
          <div style={{ marginTop: 4, padding: '10px 14px', borderRadius: 10, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.10)', fontSize: 13 }}>
            <b>⚠️ Supervisor approval required.</b> Internal requests (purchases, reimbursements, vendor contracts, travel, licences, facilities) are routed to a supervisor for sign-off before any work or assignment proceeds.
          </div>
        )}

        <label className="form-note" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            <b>Email the assignee on creation.</b> When enabled, submitting opens a pre-filled notification email
            to the selected engineer via your mail client. (Automated server-sent email arrives with the backend.)
          </span>
        </label>

        {error && <div className="form-err">{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => navigate('dashboard')}>Cancel</button>
          <button type="submit" className="btn primary">Create Ticket</button>
        </div>
      </form>
    </div>
  )
}
