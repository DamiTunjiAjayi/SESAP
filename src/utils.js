// =============================================================================
// Shared helpers: SLA/dates, export (CSV/Excel/print), email, and chart maths.
// Pure functions — no React. Easy to unit test and reuse.
// =============================================================================

export const SLA_HOURS = { urgent: 24, high: 48, medium: 96, low: 168 }

export function dueDate(ticket) {
  const created = new Date(ticket.createdAt).getTime()
  const hours = SLA_HOURS[ticket.priority] ?? 96
  return new Date(created + hours * 3600 * 1000)
}

export function isActive(ticket) {
  return ticket.status === 'open' || ticket.status === 'in_progress'
}

// True if `ticket` belongs to `user` — matches on assignee email OR name, so it
// works whether the assignment came from the app (email known) or was loaded
// from Data Fabric (only the name is stored).
export function isAssignedTo(ticket, user) {
  if (!ticket || !user) return false
  const email = (user.email || '').toLowerCase()
  const name = (user.name || '').toLowerCase()
  return (
    (!!ticket.assigneeEmail && ticket.assigneeEmail.toLowerCase() === email) ||
    (!!ticket.assignee && ticket.assignee.toLowerCase() === name)
  )
}

// HITL policy: which cases must get supervisor sign-off before an agent may
// resolve or close them. High-impact / sensitive work — fraud, disputes,
// chargebacks, compliance — or anything flagged High/Critical risk.
const SENSITIVE_RX = /fraud|dispute|chargeback|compliance|aml|sanction|reversal|refund/i
export function needsApproval(ticket) {
  if (!ticket) return false
  return (
    needsApprovalOnCreate(ticket) ||
    SENSITIVE_RX.test(`${ticket.category || ''} ${ticket.subCategory || ''} ${ticket.subject || ''}`) ||
    /high|critical/i.test(ticket.riskLevel || '')
  )
}

// Internal staff requests (purchases, reimbursements, vendor contracts, …) must
// be approved by a supervisor at creation time before any work proceeds.
export function needsApprovalOnCreate(ticket) {
  return (ticket?.category || '') === 'Internal Requests'
}

export function isOverdue(ticket) {
  return isActive(ticket) && Date.now() > dueDate(ticket).getTime()
}

// Fraction of the SLA window already consumed (0..1+). >1 means breached.
export function slaProgress(ticket) {
  const created = new Date(ticket.createdAt).getTime()
  const total = dueDate(ticket).getTime() - created
  const elapsed = Date.now() - created
  return Math.max(0, elapsed / total)
}

// ---- Live analytics (computed from the real ticket set) ---------------------
// Created-vs-resolved volume over the last `days` days, derived from the actual
// tickets loaded from Data Fabric — no seed data. `created` buckets by CreatedAt;
// `resolved` buckets resolved/closed tickets by their last-update day.
export function volumeTrendFromTickets(tickets, days = 14) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  const idx = {}
  const buckets = []
  for (let i = 0; i < days; i++) {
    const dt = new Date(start)
    dt.setUTCDate(start.getUTCDate() + i)
    const key = dt.toISOString().slice(0, 10)
    idx[key] = i
    buckets.push({ key, d: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), created: 0, resolved: 0 })
  }
  for (const t of tickets || []) {
    const c = String(t.createdAt || '').slice(0, 10)
    if (c in idx) buckets[idx[c]].created++
    if (t.status === 'resolved' || t.status === 'closed') {
      const r = String(t.updatedAt || t.createdAt || '').slice(0, 10)
      if (r in idx) buckets[idx[r]].resolved++
    }
  }
  return buckets
}

// Average resolution time (hours) over resolved/closed tickets. null if no data.
export function avgResolutionHours(tickets) {
  const diffs = (tickets || [])
    .filter((t) => (t.status === 'resolved' || t.status === 'closed') && t.createdAt && t.updatedAt)
    .map((t) => (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
    .filter((h) => h > 0)
  if (!diffs.length) return null
  return diffs.reduce((s, h) => s + h, 0) / diffs.length
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 0) return 'just now'
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ]
  for (const [label, size] of units) {
    const v = Math.floor(secs / size)
    if (v >= 1) return `${v}${label} ago`
  }
  return 'just now'
}

// Countdown like "3h 12m" or "-2h 5m" (negative = overdue).
export function countdown(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now()
  const neg = diff < 0
  let s = Math.floor(Math.abs(diff) / 1000)
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60)
  const parts = d ? [`${d}d`, `${h}h`] : [`${h}h`, `${m}m`]
  return (neg ? '-' : '') + parts.join(' ')
}

export function dueLabel(ticket) {
  if (!isActive(ticket)) return null
  const diff = dueDate(ticket).getTime() - Date.now()
  const hours = Math.round(diff / 3600000)
  if (hours < 0) return { text: `${Math.abs(Math.round(hours / 24)) || Math.abs(hours) + 'h'} overdue`, overdue: true }
  if (hours < 24) return { text: `due in ${hours}h`, overdue: false, soon: true }
  return { text: `due in ${Math.round(hours / 24)}d`, overdue: false }
}

export const humanBytes = (n) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export const titleCase = (s) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '')

export const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

// ---- IDs & refs -------------------------------------------------------------
export const nextId = (tickets) => Math.max(1000, ...tickets.map((t) => t.id)) + 1
export const refFor = (id) => `SESAP-${id}`
export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`

// ---- Email (client-side) ----------------------------------------------------
// Frontend-only: builds a mailto: link and opens the user's mail client with a
// pre-filled message. Real, but requires the sender to press "send". When the
// backend lands, replace openMail() with a server/UiPath email API call.
export function buildMailto({ to, cc, subject, body }) {
  const q = new URLSearchParams()
  if (cc) q.set('cc', cc)
  if (subject) q.set('subject', subject)
  if (body) q.set('body', body)
  const qs = q.toString().replace(/\+/g, '%20')
  return `mailto:${encodeURIComponent(to)}${qs ? '?' + qs : ''}`
}

export function openMail({ to, cc, subject, body }) {
  const a = document.createElement('a')
  a.href = buildMailto({ to, cc, subject, body })
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function assignmentEmail(ticket, assigneeName) {
  const subject = `[${ticket.ref}] Assigned to you — ${ticket.subject}`
  const body =
    `Hello ${assigneeName || 'colleague'},\n\n` +
    `A support ticket has been assigned to you on SESAP.\n\n` +
    `Reference : ${ticket.ref}\n` +
    `Subject   : ${ticket.subject}\n` +
    `Priority  : ${titleCase(ticket.priority)}\n` +
    `Status    : ${STATUS_LABELS[ticket.status]}\n` +
    `Requester : ${ticket.requester} (${ticket.requesterEmail || 'n/a'})\n` +
    `Service   : ${ticket.businessService || 'n/a'}\n` +
    `SLA due   : ${formatDateTime(dueDate(ticket).toISOString())}\n\n` +
    `Description:\n${ticket.description || '(none)'}\n\n` +
    `Please review and action this ticket in SESAP.\n\n— SESAP Automated Notification`
  return { subject, body }
}

// ---- Export -----------------------------------------------------------------
const COLUMNS = [
  ['ref', (t) => t.ref],
  ['subject', (t) => t.subject],
  ['status', (t) => t.status],
  ['priority', (t) => t.priority],
  ['category', (t) => t.category],
  ['department', (t) => t.department],
  ['channel', (t) => t.channel],
  ['team', (t) => t.team],
  ['assignee', (t) => t.assignee || ''],
  ['businessService', (t) => t.businessService || ''],
  ['riskLevel', (t) => t.riskLevel || ''],
  ['requester', (t) => t.requester],
  ['created', (t) => t.createdAt],
  ['updated', (t) => t.updatedAt],
  ['due', (t) => dueDate(t).toISOString()],
  ['overdue', (t) => (isOverdue(t) ? 'yes' : 'no')],
]

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function ticketsToCSV(tickets) {
  const header = COLUMNS.map(([name]) => name).join(',')
  const rows = tickets.map((t) => COLUMNS.map(([, get]) => csvCell(get(t))).join(','))
  return [header, ...rows].join('\n')
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function ticketsToExcel(tickets) {
  const head = COLUMNS.map(([name]) => `<th>${esc(name)}</th>`).join('')
  const body = tickets
    .map((t) => `<tr>${COLUMNS.map(([, get]) => `<td>${esc(get(t))}</td>`).join('')}</tr>`)
    .join('')
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCSV(tickets, name = 'sesap-tickets') {
  downloadFile(`${name}.csv`, '﻿' + ticketsToCSV(tickets), 'text/csv;charset=utf-8')
}

export function exportExcel(tickets, name = 'sesap-tickets') {
  downloadFile(`${name}.xls`, ticketsToExcel(tickets), 'application/vnd.ms-excel')
}

// Print / "Export PDF" — opens a print-friendly window; user picks "Save as PDF".
export function printTicket(ticket) {
  const rows = [
    ['Reference', ticket.ref],
    ['Subject', ticket.subject],
    ['Status', STATUS_LABELS[ticket.status]],
    ['Priority', titleCase(ticket.priority)],
    ['Category', `${ticket.category} / ${ticket.subCategory || ''}`],
    ['Department', ticket.department],
    ['Channel', ticket.channel],
    ['Team', ticket.team],
    ['Assignee', ticket.assignee || 'Unassigned'],
    ['Business service', ticket.businessService || ''],
    ['Risk', ticket.riskLevel || ''],
    ['Requester', `${ticket.requester} (${ticket.requesterEmail || ''})`],
    ['Created', formatDateTime(ticket.createdAt)],
    ['SLA due', formatDateTime(dueDate(ticket).toISOString())],
  ]
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(ticket.ref)}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;color:#0b2545;margin:40px;}
      h1{color:#0057B8;font-size:20px;margin:0 0 4px}
      .ref{color:#64748b;font-size:13px;margin-bottom:24px}
      table{border-collapse:collapse;width:100%}
      td{padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;vertical-align:top}
      td.k{color:#64748b;width:180px;font-weight:600}
      .desc{margin-top:24px}.desc h2{font-size:13px;color:#64748b;text-transform:uppercase}
      .brand{margin-top:40px;color:#94a3b8;font-size:11px}
    </style></head><body>
    <h1>${esc(ticket.subject)}</h1>
    <div class="ref">${esc(ticket.ref)}</div>
    <table>${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <div class="desc"><h2>Description</h2><p>${esc(ticket.description || '')}</p></div>
    <div class="brand">Stanbic IBTC Enterprise Support &amp; Automation Platform (SESAP) — generated ${esc(new Date().toLocaleString())}</div>
    </body></html>`
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

// ---- Chart maths ------------------------------------------------------------
// Build an SVG polyline path for a series of numeric values.
export function linePath(values, width, height, pad = 4) {
  if (!values.length) return ''
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const stepX = (width - pad * 2) / (values.length - 1 || 1)
  return values
    .map((v, i) => {
      const x = pad + i * stepX
      const y = height - pad - ((v - min) / span) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// Build donut/pie arc segments from [{value,color}]. Returns array with d paths.
export function donutSegments(data, radius = 60, thickness = 22) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = radius
  const cx = radius
  const cy = radius
  let angle = -Math.PI / 2
  return data.map((d) => {
    const frac = d.value / total
    const start = angle
    const end = angle + frac * Math.PI * 2
    angle = end
    const large = end - start > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    const ir = r - thickness
    const x3 = cx + ir * Math.cos(end)
    const y3 = cy + ir * Math.sin(end)
    const x4 = cx + ir * Math.cos(start)
    const y4 = cy + ir * Math.sin(start)
    const dPath = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 ${large} 0 ${x4},${y4} Z`
    return { ...d, d: dPath, frac }
  })
}
