// Rich, tabbed ticket workspace (replaces the old drawer).
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ENGINEERS, CATEGORIES, DEPARTMENTS, TEAMS, CHANNELS, BUSINESS_SERVICES, PRIORITIES, RISK_LEVELS, STATUSES, automations } from '../data.js'
import { dueDate, dueLabel, formatDateTime, humanBytes, timeAgo, titleCase, openMail, printTicket, needsApproval } from '../utils.js'
import { StatusBadge, PriorityBadge, RiskBadge, Avatar } from './ui/primitives.jsx'
import { extractDocument, duNote } from '../documentAI.js'
import { listAttachments, attachmentUrl, deleteAttachment as deleteFromBucket } from '../integrations/storage.js'

const TABS = ['Overview', 'Activity', 'Internal Notes', 'Attachments', 'Related', 'Audit Trail', 'Approvals', 'Automation Logs', 'Communication']
const ICON = { created: '🆕', comment: '💬', status: '🔄', priority: '⚑', assign: '👤', attachment: '📎' }

export default function TicketWorkspace() {
  const {
    openTicket: ticket, setOpenTicketId, tickets, patchTicket, addComment, uploadFiles,
    removeAttachment, assignTicket, escalateTicket, setStatus, deleteTicket, createTicket,
    addToast, pushNotification,
    requestApproval, approveTicket, rejectTicket, isSupervisor, isAgent,
  } = useApp()

  const [tab, setTab] = useState('Overview')
  const [desc, setDesc] = useState('')
  const [note, setNote] = useState('')
  const [du, setDu] = useState({})        // attachment.id -> Document Understanding result
  const [duBusy, setDuBusy] = useState(null)
  const [bucketFiles, setBucketFiles] = useState([]) // files hydrated from the Storage Bucket
  const fileRef = useRef(null)

  useEffect(() => { if (ticket) setDesc(ticket.description || '') }, [ticket?.id])

  // Hydrate attachments from the Storage Bucket so files persist across reloads
  // (local blob URLs die on refresh). Bucket-only files are shown alongside any
  // just-uploaded local ones. Best-effort — no-op if the bucket is unavailable.
  useEffect(() => {
    let cancelled = false
    setBucketFiles([])
    if (ticket?.ref) {
      listAttachments(ticket.ref).then((r) => {
        if (cancelled || !r.ok) return
        const localNames = new Set((ticket.attachments || []).map((a) => a.name))
        setBucketFiles(r.files.filter((bf) => !localNames.has(bf.name)))
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpenTicketId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpenTicketId])

  if (!ticket) return null
  const t = ticket
  const due = dueLabel(t)
  const subCats = CATEGORIES[t.category] || []
  const related = tickets.filter((x) => x.id !== t.id && (x.category === t.category || x.businessService === t.businessService)).slice(0, 6)
  const activity = [...(t.activity || [])].sort((a, b) => new Date(b.at) - new Date(a.at))
  const notes = activity.filter((a) => a.type === 'comment')
  const audit = activity.filter((a) => ['status', 'assign', 'priority', 'created'].includes(a.type))
  const botLogs = automations.filter((a) => t.category.includes('Automation') || t.businessService === 'Core Banking').slice(0, 3)

  const patch = (p, type, text) => patchTicket(t.id, p, type, text)

  // Document Understanding: read an attachment and write the read-out to the
  // timeline so it is visible to the agent (and everyone on the ticket).
  async function analyzeAttachment(a) {
    setDuBusy(a.id)
    // Resolve a fetchable URL — a just-uploaded local blob, or a fresh bucket read-URI.
    let target = a
    if (!a.url && a.bucketPath) { const url = await attachmentUrl(a.bucketPath); target = { ...a, url } }
    const result = await extractDocument(target)
    setDu((prev) => ({ ...prev, [a.id]: result }))
    setDuBusy(null)
    addComment(t.id, duNote(result), 'Document Understanding')
    addToast({
      type: result.ok ? 'success' : 'warning',
      title: 'Document Understanding',
      message: result.ok ? `${a.name}: ${result.docType}` : `Could not read ${a.name}`,
    })
  }
  async function openAttachment(a) {
    let url = a.url
    if (!url && a.bucketPath) url = await attachmentUrl(a.bucketPath) // fresh pre-signed URL from the bucket
    if (url) window.open(url, '_blank', 'noopener')
    else addToast({ type: 'warning', title: 'Unavailable', message: 'No stored content for this attachment.' })
  }
  // Delete an attachment everywhere: remove from the Storage Bucket (if it's
  // there) AND from the local view, so it can't reappear on reload.
  async function onDeleteAttachment(a) {
    if (!window.confirm(`Delete "${a.name}"? This removes it from the ticket and the storage bucket.`)) return
    let bucketOk = true
    if (a.bucketPath) { const r = await deleteFromBucket(a.bucketPath); bucketOk = r?.ok !== false }
    if (a.fromBucket) setBucketFiles((prev) => prev.filter((bf) => bf.path !== a.bucketPath))
    else removeAttachment(t.id, a.id)
    setDu((prev) => { const n = { ...prev }; delete n[a.id]; return n })
    addToast({
      type: bucketOk ? 'success' : 'warning',
      title: 'Attachment removed',
      message: bucketOk ? `${a.name} deleted.` : `${a.name} removed from view — bucket delete failed (${a.bucketPath ? 'check permissions' : 'local only'}).`,
    })
  }

  // Local (just-uploaded) attachments + files hydrated from the Storage Bucket.
  const bucketAsAtt = bucketFiles.map((bf) => ({ id: `bkt-${bf.path}`, name: bf.name, size: bf.size, type: bf.type, bucketPath: bf.path, fromBucket: true }))
  const allAttachments = [...(t.attachments || []), ...bucketAsAtt]

  function emailUser() {
    if (!t.requesterEmail) return addToast({ type: 'warning', title: 'No email', message: 'Requester has no email on file.' })
    openMail({
      to: t.requesterEmail,
      subject: `[${t.ref}] Update on your request — ${t.subject}`,
      body: `Hello ${t.requester},\n\nRegarding your request "${t.subject}" (${t.ref})...\n\nKind regards,\nStanbic IBTC Support`,
    })
    addToast({ type: 'info', title: 'Email drafted', message: `Compose window opened for ${t.requester}.` })
  }
  function notifyTeam() {
    pushNotification({ type: 'assignment', title: 'Team notified', body: `${t.team} notified about ${t.ref}.`, ref: t.ref })
    addToast({ type: 'success', title: 'Team notified', message: `${t.team} has been alerted.` })
  }
  function clone() {
    const { id, ref, createdAt, updatedAt, activity: _a, attachments: _at, ...rest } = t
    const c = createTicket({ ...rest, subject: `${t.subject} (copy)` })
    setOpenTicketId(c.id)
  }
  function assign(name) {
    const eng = ENGINEERS.find((e) => e.name === name)
    if (eng) assignTicket(t.id, eng, { notify: true })
  }

  return (
    <div className="ws-overlay" onMouseDown={() => setOpenTicketId(null)}>
      <aside className="ws" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ws-header">
          <div className="ws-header-top">
            <div>
              <span className="ws-ref">{t.ref}</span>
              <h2>{t.subject}</h2>
              <div className="ws-badges">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <RiskBadge risk={t.riskLevel} />
                {t.escalated && <span className="badge pr-urgent">⚠️ Escalated</span>}
                {t.approvalStatus === 'pending' && <span className="badge pr-high">⏳ Awaiting approval</span>}
                {t.approvalStatus === 'approved' && <span className="badge pr-low">✓ Approved</span>}
                {t.approvalStatus === 'rejected' && <span className="badge pr-urgent">✗ Rejected</span>}
                <span className="tag">{t.businessService}</span>
              </div>
            </div>
            <button className="icon-btn" onClick={() => setOpenTicketId(null)} aria-label="Close">✕</button>
          </div>
        </div>

        {/* AI triage (written by the Claude agent in the RPA flow) */}
        {(t.subCategory || (t.tags && t.tags.length > 0)) && (
          <div style={{ margin: '14px 0 0', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(0,87,184,0.06), rgba(15,118,110,0.06))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>🤖 AI Triage</span>
              <span className="tag" style={{ background: '#eef2ff', color: '#4338ca' }}>Claude · auto‑categorised &amp; prioritised</span>
            </div>
            {t.subCategory && <p style={{ margin: '0 0 6px', fontSize: 13 }}><b>Summary:</b> {t.subCategory}</p>}
            {t.tags?.length > 0 && <p style={{ margin: 0, fontSize: 13 }}><b>Recommended action:</b> {t.tags.join(' ')}</p>}
          </div>
        )}

        {/* HITL policy banner — sensitive/high-risk cases need supervisor sign-off */}
        {needsApproval(t) && (
          <div style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 10, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.10)', fontSize: 13 }}>
            <b>⚠️ Supervisor sign-off required (HITL policy).</b>{' '}
            {t.approvalStatus === 'approved'
              ? 'Approved — this case can now be resolved or closed.'
              : t.approvalStatus === 'pending'
                ? 'Awaiting a supervisor’s approve/reject decision (in-app or by email).'
                : t.approvalStatus === 'rejected'
                  ? 'A supervisor rejected this case.'
                  : 'Fraud, dispute, chargeback, compliance or high-risk case — an agent must get supervisor approval before resolving or closing it.'}
          </div>
        )}

        {/* Action bar */}
        <div className="ws-actions">
          <select className="filter-select" value="" onChange={(e) => e.target.value && assign(e.target.value)}>
            <option value="">{t.assignee ? '↻ Reassign' : '👤 Assign'}</option>
            {ENGINEERS.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
          {!t.escalated && <button className="btn sm" onClick={() => escalateTicket(t.id)}>⚠️ Escalate</button>}
          {/* HITL — agents raise sensitive cases for sign-off; supervisors approve/reject (also actionable from the email). */}
          {isAgent && needsApproval(t) && t.approvalStatus !== 'pending' && t.approvalStatus !== 'approved' && (
            <button className="btn sm" style={{ borderColor: '#f59e0b', color: '#b45309' }} onClick={() => requestApproval(t.id)}>🙋 Request approval</button>
          )}
          {isSupervisor && t.approvalStatus === 'pending' && (
            <>
              <button className="btn sm success" onClick={() => approveTicket(t.id)}>✓ Approve</button>
              <button className="btn sm danger" onClick={() => rejectTicket(t.id)}>✗ Reject</button>
            </>
          )}
          {/* Resolve / Close — locked for agents on sensitive cases until approved. */}
          {needsApproval(t) && isAgent && t.approvalStatus !== 'approved' ? (
            <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>🔒 Resolve/Close locked until a supervisor approves</span>
          ) : (
            <>
              {t.status !== 'resolved' && <button className="btn sm success" onClick={() => setStatus(t.id, 'resolved')}>✓ Resolve</button>}
              {t.status !== 'closed' && <button className="btn sm" onClick={() => setStatus(t.id, 'closed')}>Close</button>}
              {(t.status === 'resolved' || t.status === 'closed') && <button className="btn sm" onClick={() => setStatus(t.id, 'open')}>↺ Reopen</button>}
            </>
          )}
          <button className="btn sm" onClick={emailUser}>✉️ Email User</button>
          <button className="btn sm" onClick={notifyTeam}>📣 Notify Team</button>
          <button className="btn sm" onClick={clone}>⧉ Clone</button>
          <button className="btn sm" onClick={() => printTicket(t)}>🖨 Print / PDF</button>
          <button className="btn sm danger" onClick={() => deleteTicket(t.id)}>🗑 Delete</button>
        </div>

        {/* Tabs */}
        <div className="ws-tabs">
          {TABS.map((x) => (
            <button key={x} className={`ws-tab ${tab === x ? 'active' : ''}`} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>

        <div className="ws-body">
          {tab === 'Overview' && (
            <>
              <div className="ws-grid">
                <Field label="Status">
                  <select value={t.status} onChange={(e) => patch({ status: e.target.value }, 'status', `Status → ${titleCase(e.target.value)}`)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={t.priority} onChange={(e) => patch({ priority: e.target.value }, 'priority', `Priority → ${titleCase(e.target.value)}`)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
                  </select>
                </Field>
                <Field label="Assignee">
                  <select value={t.assignee || ''} onChange={(e) => { const eng = ENGINEERS.find((x) => x.name === e.target.value); eng ? assignTicket(t.id, eng, { notify: false }) : patch({ assignee: null, assigneeEmail: null }, 'assign', 'Unassigned') }}>
                    <option value="">Unassigned</option>
                    {ENGINEERS.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                </Field>
                <Field label="Team">
                  <select value={t.team} onChange={(e) => patch({ team: e.target.value }, 'assign', `Team → ${e.target.value}`)}>
                    {TEAMS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={t.category} onChange={(e) => patch({ category: e.target.value, subCategory: CATEGORIES[e.target.value][0] }, 'status', `Category → ${e.target.value}`)}>
                    {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Sub-category">
                  <select value={t.subCategory} onChange={(e) => patch({ subCategory: e.target.value })}>
                    {subCats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Department">
                  <select value={t.department} onChange={(e) => patch({ department: e.target.value })}>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Channel">
                  <select value={t.channel} onChange={(e) => patch({ channel: e.target.value })}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Business service">
                  <select value={t.businessService} onChange={(e) => patch({ businessService: e.target.value })}>
                    {BUSINESS_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Risk level">
                  <select value={t.riskLevel} onChange={(e) => patch({ riskLevel: e.target.value })}>
                    {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>SLA due</label>
                <div className={`countdown ${due?.overdue ? 'bad' : due?.soon ? 'ok' : ''}`} style={{ display: 'inline-block', alignSelf: 'flex-start', ...(due?.overdue || due?.soon ? {} : { background: 'var(--surface-2)', color: 'var(--text)' }) }}>
                  {formatDateTime(dueDate(t).toISOString())} {due && `· ${due.text}`}
                </div>
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>Requester</label>
                <div style={{ fontSize: 14 }}>{t.requester} {t.requesterEmail && <span className="muted">· {t.requesterEmail}</span>}</div>
              </div>

              <div className="field">
                <label>Description</label>
                <textarea rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} />
                {desc !== (t.description || '') && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn sm" onClick={() => setDesc(t.description || '')}>Reset</button>
                    <button className="btn sm primary" onClick={() => patch({ description: desc }, 'comment', 'Description updated')}>Save</button>
                  </div>
                )}
              </div>

              {t.tags?.length > 0 && (
                <div style={{ marginTop: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {t.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}
                </div>
              )}
            </>
          )}

          {tab === 'Activity' && <Timeline items={activity} />}

          {tab === 'Internal Notes' && (
            <>
              <div className="comment-box">
                <textarea rows={2} placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn primary sm" disabled={!note.trim()} onClick={() => { addComment(t.id, note.trim()); setNote('') }}>Post note</button>
              </div>
              <Timeline items={notes} empty="No internal notes yet." />
            </>
          )}

          {tab === 'Attachments' && (
            <>
              <div className="ws-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Attachments {allAttachments.length ? `(${allAttachments.length})` : ''}</span>
                <button className="btn sm" onClick={() => fileRef.current?.click()}>＋ Upload</button>
                <input ref={fileRef} type="file" multiple hidden onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) uploadFiles(t.id, files); e.target.value = '' }} />
              </div>
              {allAttachments.length ? (
                <ul className="attach-list">
                  {allAttachments.map((a) => {
                    const r = du[a.id]
                    const canOpen = !!a.url || !!a.bucketPath
                    return (
                    <li key={a.id} style={{ flexWrap: 'wrap' }}>
                      <span>📎</span>
                      <div className="attach-meta" style={{ flex: 1 }}>
                        {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a> : <span>{a.name}</span>}
                        <small>{humanBytes(a.size)}{a.type ? ` · ${a.type}` : ''}{a.bucketPath ? ' · ☁ bucket' : ''}</small>
                      </div>
                      <button className="btn sm" onClick={() => openAttachment(a)} disabled={!canOpen}>🔍 Open</button>
                      <button className="btn sm primary" onClick={() => analyzeAttachment(a)} disabled={duBusy === a.id || !canOpen}>
                        {duBusy === a.id ? '⏳ Reading…' : '🧠 Analyze'}
                      </button>
                      <button className="icon-btn" style={{ width: 30, height: 30 }} title="Delete attachment" onClick={() => onDeleteAttachment(a)}>🗑</button>
                      {r && (
                        <div style={{ flexBasis: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(0,87,184,0.06), rgba(15,118,110,0.06))' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🧠 Document Understanding — {r.docType}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: r.fields ? 8 : 0 }}>{r.summary || r.note}</div>
                          {r.fields && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6, fontSize: 12 }}>
                              {[['Amounts', r.fields.amounts], ['Dates', r.fields.dates], ['Account numbers', r.fields.accounts], ['References', r.fields.references], ['Emails', r.fields.emails], ['Phone numbers', r.fields.phones]]
                                .filter(([, v]) => v && v.length)
                                .map(([label, v]) => (
                                  <div key={label}><b>{label}:</b> {v.join(', ')}</div>
                                ))}
                            </div>
                          )}
                          {r.note && r.fields && <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>{r.note}</div>}
                          {r.textPreview && (
                            <details style={{ marginTop: 8 }}>
                              <summary style={{ cursor: 'pointer', fontSize: 12 }}>View extracted text</summary>
                              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 6, maxHeight: 200, overflow: 'auto' }}>{r.textPreview}</pre>
                            </details>
                          )}
                        </div>
                      )}
                    </li>
                  )})}
                </ul>
              ) : (
                <p className="dropzone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const files = Array.from(e.dataTransfer.files || []); if (files.length) uploadFiles(t.id, files) }}>
                  Drop files here or click to upload
                </p>
              )}
            </>
          )}

          {tab === 'Related' && (
            related.length ? related.map((r) => (
              <div className="feed-item" key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenTicketId(r.id)}>
                <span className="feed-ico">🎫</span>
                <div className="feed-body">
                  <p><b>{r.ref}</b> — {r.subject}</p>
                  <div className="t"><StatusBadge status={r.status} /> · {r.category}</div>
                </div>
              </div>
            )) : <Empty text="No related tickets found." />
          )}

          {tab === 'Audit Trail' && <Timeline items={audit} empty="No audit records." />}

          {tab === 'Approvals' && (
            <Empty text="No approvals required for this ticket. Approval workflows activate with the backend integration." />
          )}

          {tab === 'Automation Logs' && (
            botLogs.length ? botLogs.map((b) => (
              <div className="feed-item" key={b.id}>
                <span className="feed-ico" style={{ background: 'var(--violet-bg)', color: 'var(--violet)' }}>🤖</span>
                <div className="feed-body">
                  <p><b>{b.name}</b> — {b.successRate}% success · {b.runsToday} runs today</p>
                  <div className="t">Last run {timeAgo(b.lastRun)} · status {b.status}</div>
                </div>
              </div>
            )) : <Empty text="No automation activity linked to this ticket." />
          )}

          {tab === 'Communication' && (
            <>
              <div className="feed-item">
                <span className="feed-ico" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>✉️</span>
                <div className="feed-body">
                  <p>Ticket acknowledgement sent to <b>{t.requester}</b></p>
                  <div className="t">{t.requesterEmail || 'no email'} · {timeAgo(t.createdAt)}</div>
                </div>
              </div>
              {notes.map((n, i) => (
                <div className="feed-item" key={i}>
                  <span className="feed-ico">💬</span>
                  <div className="feed-body"><p>{n.text}</p><div className="t">{n.author} · {timeAgo(n.at)}</div></div>
                </div>
              ))}
              <button className="btn sm" style={{ marginTop: 10 }} onClick={emailUser}>✉️ Compose email to requester</button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

function Timeline({ items, empty }) {
  if (!items.length) return <Empty text={empty || 'Nothing here yet.'} />
  return (
    <ul className="timeline">
      {items.map((a, i) => (
        <li className="tl-item" key={i}>
          <span className="tl-ico">{ICON[a.type] || '•'}</span>
          <div className="tl-body">
            <p>{a.text}</p>
            <span className="t">{a.author} · {timeAgo(a.at)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Empty({ text }) {
  return <div className="empty-state" style={{ padding: 40 }}><div className="big-ico">🗂️</div>{text}</div>
}
