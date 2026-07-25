// =============================================================================
// AppContext — the single source of truth for SESAP.
//
// Holds auth, navigation, theme, tickets, notifications and toasts, and exposes
// every mutation. Components read state and call actions via the useApp() hook,
// which keeps prop-drilling out of the deep component tree.
// =============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { sampleTickets } from '../data.js'
import { getSession, saveSession, clearSession, touchSession, IDLE_LIMIT_MS } from '../auth.js'
import {
  nextId,
  refFor,
  uid,
  openMail,
  assignmentEmail,
  isOverdue,
  STATUS_LABELS,
} from '../utils.js'
import { QUEUE_NAME } from '../integrations/uipath.js'
import { syncNewTicket } from '../integrations/sync.js'
import { listTicketsFromDataFabric, updateTicketInDataFabric } from '../integrations/datafabric.js'
import { isSupervisor, isAgent, roleLabel } from '../auth.js'
import { isActive, needsApprovalOnCreate } from '../utils.js'
import { uploadAttachment } from '../integrations/storage.js'
import { startOrchestration, startLifecycleEmail } from '../integrations/runbot.js'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const now = () => new Date().toISOString()

// Supervisor mailbox for HITL approvals + SLA-breach escalation notices.
const SUPERVISOR_EMAIL = 'damilaretunjiajayi+supervisor@gmail.com'

// App ticket field  →  Data Fabric column. The single mapping that keeps the
// entity in lock-step with the UI: whenever a ticket field that has a Data
// Fabric column is mutated in the app, patchTicket() writes it straight back.
// Fields with no Data Fabric column (escalated, approvalStatus, assigneeEmail,
// attachments, activity, …) are intentionally absent and simply skipped.
const DF_FIELD_MAP = {
  status: 'Status',
  priority: 'Priority',
  category: 'Category',
  subCategory: 'SubCategory',
  assignee: 'AssignedTo',
  team: 'Team',
  assignmentStatus: 'AssignmentStatus',
  subject: 'Subject',
  description: 'Description',
  requester: 'Requester',
  requesterEmail: 'RequesterEmail',
  riskLevel: 'RiskLevel',
  department: 'Department',
  channel: 'Channel',
  businessService: 'BusinessService',
}

function mapPatchToDataFabric(patch) {
  const df = {}
  for (const k of Object.keys(patch || {})) {
    if (k === 'tags' && Array.isArray(patch.tags)) { df.Tags = patch.tags.join(','); continue }
    const col = DF_FIELD_MAP[k]
    if (col) df[col] = patch[k] == null ? '' : patch[k]
  }
  return df
}

function initTheme() {
  const saved = localStorage.getItem('sesap_theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadTickets() {
  try {
    const raw = localStorage.getItem('sesap_tickets')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore corrupt storage */
  }
  return sampleTickets
}

function loadNotifications() {
  try {
    const raw = localStorage.getItem('sesap_notifications')
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return [
    { id: uid('n'), type: 'sla', title: 'SLA breach warning', body: 'SESAP-1042 is within 24h of breach.', at: now(), read: false, ref: 'SESAP-1042' },
    { id: uid('n'), type: 'robot', title: 'Robot degraded', body: 'BOT-01 Nightly Reconciliation running at 82%.', at: now(), read: false },
    { id: uid('n'), type: 'escalation', title: 'Ticket escalated', body: 'SESAP-1039 escalated to Tier 2.', at: now(), read: true },
  ]
}

export function AppProvider({ children }) {
  // Restore an ACTIVE session (survives reloads) but not an expired one:
  // getSession() returns null once the session has been idle past IDLE_LIMIT_MS,
  // so a stale session opens on the landing page while an active user stays in.
  const [user, setUser] = useState(getSession)
  const [entered, setEntered] = useState(false) // clicked "Sign In" from landing
  const [theme, setTheme] = useState(initTheme)
  const [view, setView] = useState('dashboard')
  const [viewParams, setViewParams] = useState({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [tickets, setTickets] = useState(loadTickets)
  // Always-current mirror of `tickets` so callbacks (patchTicket) can read a
  // ticket's Data Fabric recordId without being re-created on every change.
  const ticketsRef = useRef(tickets)
  useEffect(() => { ticketsRef.current = tickets }, [tickets])
  const [dataSource, setDataSource] = useState('local') // 'local' | 'datafabric'
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [openTicketId, setOpenTicketId] = useState(null)
  const [notifications, setNotifications] = useState(loadNotifications)
  const [toasts, setToasts] = useState([])

  // ---- Persistence --------------------------------------------------------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sesap_theme', theme)
  }, [theme])

  useEffect(() => {
    try {
      const serializable = tickets.map((t) => ({
        ...t,
        attachments: (t.attachments || []).map(({ url, ...rest }) => rest),
      }))
      localStorage.setItem('sesap_tickets', JSON.stringify(serializable))
    } catch {
      /* storage full — skip */
    }
  }, [tickets])

  useEffect(() => {
    try {
      localStorage.setItem('sesap_notifications', JSON.stringify(notifications.slice(0, 40)))
    } catch {
      /* skip */
    }
  }, [notifications])

  // ---- Toasts -------------------------------------------------------------
  const addToast = useCallback((toast) => {
    const id = uid('t')
    setToasts((prev) => [...prev, { id, type: 'info', ...toast }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), toast.duration || 4200)
  }, [])
  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((x) => x.id !== id)), [])

  // ---- Live Data Fabric read (challenge baseline 4.1) ----------------------
  // The grid must read LIVE from the Data Fabric Ticket entity. We hydrate on
  // sign-in and fall back to the local cache when the SDK is unavailable
  // (e.g. running outside the Coded App shell during local development).
  const refreshFromDataFabric = useCallback(
    async ({ silent = false } = {}) => {
      setIsLoadingTickets(true)
      const res = await listTicketsFromDataFabric()
      setIsLoadingTickets(false)
      if (res.ok && res.tickets.length) {
        setTickets(res.tickets)
        setDataSource('datafabric')
        if (!silent) addToast({ type: 'success', title: 'Live data loaded', message: `${res.tickets.length} ticket(s) from Data Fabric.` })
        return true
      }
      if (!silent) addToast({ type: 'warning', title: 'Data Fabric unavailable', message: 'Showing locally cached tickets.' })
      return false
    },
    [addToast],
  )

  // Hydrate live data once a user is signed in.
  useEffect(() => {
    if (user) refreshFromDataFabric({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Deep link from an email button (?ticket=<Ref>): once signed in and tickets
  // are loaded, open that ticket. Ref is stashed in main.jsx so it survives the
  // OAuth/login round-trip.
  useEffect(() => {
    if (!user || !tickets.length) return
    let ref
    try { ref = sessionStorage.getItem('sesap_deeplink_ticket') } catch { /* ignore */ }
    if (!ref) return
    const hit = tickets.find((x) => (x.ref || '').toLowerCase() === ref.toLowerCase())
    if (hit) {
      setOpenTicketId(hit.id)
      setView('queue')
      addToast({ type: 'info', title: 'Opened from email', message: `Ticket ${hit.ref}` })
      try { sessionStorage.removeItem('sesap_deeplink_ticket') } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tickets])

  // ---- Notifications ------------------------------------------------------
  const pushNotification = useCallback((n) => {
    setNotifications((prev) => [{ id: uid('n'), at: now(), read: false, ...n }, ...prev].slice(0, 40))
  }, [])
  const markNotificationRead = useCallback(
    (id) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [],
  )
  const markAllNotificationsRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  )
  const unreadCount = notifications.filter((n) => !n.read).length

  // ---- Auth / navigation --------------------------------------------------
  const login = useCallback((u) => {
    saveSession(u)
    setUser(u)
    setEntered(true)
    setView('dashboard')
  }, [])
  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setEntered(false)
  }, [])

  // Idle-timeout session: while signed in, any real interaction keeps the session
  // alive (and bumps the persisted "last active" marker so a reload restores it);
  // after IDLE_LIMIT_MS with no interaction the user is signed out to the landing
  // page. Reopening a session already idle past the limit is handled by getSession.
  useEffect(() => {
    if (!user) return
    let timer
    let lastTouch = 0
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => logout(), IDLE_LIMIT_MS) }
    const onActivity = () => {
      const t = Date.now()
      if (t - lastTouch > 15000) { touchSession(); lastTouch = t } // throttle localStorage writes
      reset()
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    reset()
    return () => { clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, onActivity)) }
  }, [user, logout])
  const navigate = useCallback((v, params = {}) => {
    setView(v)
    setViewParams(params)
    if (window.innerWidth < 860) setSidebarCollapsed(true)
  }, [])
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  // ---- Ticket mutations ---------------------------------------------------
  const patchTicket = useCallback((id, patch, type, text, author = 'You') => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const activity = text
          ? [...(t.activity || []), { type: type || 'comment', text, author, at: now() }]
          : t.activity
        return { ...t, ...patch, updatedAt: now(), activity }
      }),
    )
    // Single source of truth for Data Fabric write-back: every UI edit flows
    // through patchTicket, so mapping the patch to entity columns here keeps the
    // Data Fabric record updated "as operated in the App at all times" — status,
    // priority, category, sub-category, assignee, team, tags, risk, etc.
    const df = mapPatchToDataFabric(patch)
    if (Object.keys(df).length) {
      const rec = ticketsRef.current.find((x) => x.id === id)
      if (rec?.recordId) updateTicketInDataFabric(rec.recordId, df)
    }
  }, [])

  const addComment = useCallback((id, text, author = 'You') => patchTicket(id, {}, 'comment', text, author), [patchTicket])

  // refHint is REQUIRED when uploading during creation: React hasn't committed
  // the new ticket to `tickets` yet, so ticketsRef can't resolve the ref — the
  // caller passes created.ref explicitly (else files land under tickets/UNKNOWN/).
  const uploadFiles = useCallback(async (id, files, refHint) => {
    const rec = ticketsRef.current.find((t) => t.id === id)
    const ref = refHint || rec?.ref
    const attachments = files.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f), // local blob for instant view
    }))
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              attachments: [...(t.attachments || []), ...attachments],
              updatedAt: now(),
              activity: [
                ...(t.activity || []),
                { type: 'attachment', text: `Uploaded ${attachments.length} file(s): ${attachments.map((a) => a.name).join(', ')}`, author: 'You', at: now() },
              ],
            }
          : t,
      ),
    )
    // Persist each file to the UiPath Storage Bucket so it survives reloads and is
    // reachable by robots / Document Understanding. Best-effort — the local blob
    // above keeps the UI working even if the bucket is unavailable. We surface the
    // outcome so a failure (scope/CORS) is visible rather than silently lost.
    const results = await Promise.all(files.map((f, i) =>
      uploadAttachment(ref, f).then((res) => ({ res, attId: attachments[i].id }))))
    let ok = 0
    let reason = null
    results.forEach(({ res, attId }) => {
      if (res?.ok && res.path) {
        ok++
        setTickets((prev) => prev.map((t) => t.id === id
          ? { ...t, attachments: (t.attachments || []).map((x) => x.id === attId ? { ...x, bucketPath: res.path } : x) }
          : t))
      } else {
        reason = res?.error || res?.reason || 'unavailable'
      }
    })
    if (ok === files.length) {
      addToast({ type: 'success', title: 'Attached & stored', message: `${ok} file(s) saved to the Storage Bucket.` })
    } else {
      addToast({ type: 'warning', title: 'Stored locally only', message: `Bucket unavailable (${reason}); file(s) may not survive a reload.` })
    }
  }, [addToast])

  const removeAttachment = useCallback((id, attId) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, attachments: (t.attachments || []).filter((a) => a.id !== attId), updatedAt: now() } : t,
      ),
    )
  }, [])

  // Assign (and optionally send an email notification via the mail client).
  const assignTicket = useCallback(
    (id, engineer, { notify = true } = {}) => {
      const t0 = tickets.find((x) => x.id === id)
      patchTicket(
        id,
        { assignee: engineer.name, assigneeEmail: engineer.email, team: engineer.team || t0?.team, assignmentStatus: 'Assigned' },
        'assign',
        `Assigned to ${engineer.name}`,
      )
      // AssignedTo / Team / AssignmentStatus are persisted to Data Fabric by patchTicket.
      pushNotification({ type: 'assignment', title: 'Ticket reassigned', body: `${t0?.ref} assigned to ${engineer.name}.`, ref: t0?.ref })
      // Notify the newly assigned engineer with a real email (both parties).
      if (notify && t0) startLifecycleEmail('assigned', { ...t0, assignee: engineer.name, team: engineer.team || t0?.team })
      addToast({ type: 'success', title: 'Reassigned', message: `${t0?.ref} → ${engineer.name}.` })
    },
    [tickets, patchTicket, pushNotification, addToast],
  )

  const escalateTicket = useCallback(
    (id, { auto = false } = {}) => {
      const t0 = tickets.find((x) => x.id === id)
      patchTicket(id, { escalated: true, priority: 'urgent' }, 'status', auto ? 'Auto-escalated — SLA breached' : 'Escalated — priority raised to Urgent')
      pushNotification({ type: 'escalation', title: auto ? 'SLA auto-escalation' : 'Ticket escalated', body: `${t0?.ref} escalated${auto ? ' (SLA breach)' : ''}.`, ref: t0?.ref })
      // Auto-escalations are summarised by the SLA sweep (one toast), not one each.
      if (!auto) addToast({ type: 'warning', title: 'Escalated', message: `${t0?.ref} raised to Urgent.` })
      // Priority is persisted to Data Fabric by patchTicket.
      // Email ONLY on a human-initiated escalation. The automatic SLA sweep must
      // never blast the requester per ticket (that caused back-to-back mail); it
      // updates Data Fabric + raises an in-app alert instead.
      if (t0 && !auto) {
        startLifecycleEmail('escalated', { ...t0, priority: 'urgent' })
        startOrchestration({ action: 'escalate', ticket: { ...t0, priority: 'urgent' } }) // drives the Maestro Escalate branch
      }
      // On an AUTOMATIC (SLA breach) escalation, notify the SUPERVISOR by email so
      // overdue tickets surface to them. Deduped by the SLA sweep (once per ticket)
      // and gated by the "Live automation" toggle inside startLifecycleEmail, so it
      // stays dormant until automation is deliberately turned on (no email spam).
      if (t0 && auto) startLifecycleEmail('sla', { ...t0, priority: 'urgent', requesterEmail: SUPERVISOR_EMAIL })
    },
    [tickets, patchTicket, pushNotification, addToast],
  )

  const setStatus = useCallback(
    (id, status) => {
      const t0 = tickets.find((x) => x.id === id)
      patchTicket(id, { status }, 'status', `Status → ${STATUS_LABELS[status]}`)
      addToast({ type: 'info', title: 'Status updated', message: `${t0?.ref} → ${STATUS_LABELS[status]}.` })
      // Status is persisted to Data Fabric by patchTicket.
      if (t0 && (status === 'resolved' || status === 'closed')) {
        startLifecycleEmail(status, t0)
        startOrchestration({ action: status === 'resolved' ? 'resolve' : 'close', ticket: t0 }) // drives the Maestro Resolve/Close branch
      }
    },
    [tickets, patchTicket, addToast],
  )

  // ---- Human-in-the-loop: supervisor approval (surfaced in-app AND by email) ----
  const requestApproval = useCallback(
    (id) => {
      const t0 = tickets.find((x) => x.id === id)
      // AssignmentStatus 'PendingApproval' is persisted to Data Fabric by patchTicket
      // (it round-trips back to approvalStatus='pending' via fromEntityRecord on reload).
      patchTicket(id, { approvalStatus: 'pending', assignmentStatus: 'PendingApproval' }, 'status', 'Sent for supervisor approval')
      pushNotification({ type: 'escalation', title: 'Approval requested', body: `${t0?.ref} awaiting supervisor sign-off.`, ref: t0?.ref })
      if (t0) startLifecycleEmail('approval', { ...t0, requesterEmail: SUPERVISOR_EMAIL }) // emails the supervisor w/ deep link
      addToast({ type: 'info', title: 'Sent for approval', message: `${t0?.ref} routed to a supervisor.` })
    },
    [tickets, patchTicket, pushNotification, addToast],
  )
  const approveTicket = useCallback(
    (id) => {
      const t0 = tickets.find((x) => x.id === id)
      const hasAgent = !!t0?.assignee
      // Approval routes BACK to the agent: if someone is working it, it stays with
      // them (unlocked to resolve/close); if it was unassigned, it is released to
      // the robot to auto-assign. AssignmentStatus is persisted by patchTicket.
      patchTicket(id, { approvalStatus: 'approved', assignmentStatus: hasAgent ? 'Assigned' : 'Unassigned' }, 'status', `Approved by ${user?.name || 'supervisor'}`)
      pushNotification({ type: 'assignment', title: 'Approval granted', body: hasAgent ? `${t0?.ref} approved — ${t0.assignee} can now proceed.` : `${t0?.ref} approved — routing to an agent.`, ref: t0?.ref })
      if (t0) { if (!hasAgent) startOrchestration(); startLifecycleEmail('approved', t0) } // notify requester; robot assigns only if unassigned
      addToast({ type: 'success', title: 'Approved', message: hasAgent ? `${t0?.ref} approved — ${t0.assignee} can close it.` : `${t0?.ref} approved — the robot will assign it.` })
    },
    [tickets, patchTicket, pushNotification, addToast, user],
  )
  const rejectTicket = useCallback(
    (id) => {
      const t0 = tickets.find((x) => x.id === id)
      // Reject = returned for rework (NOT force-closed): the ticket stays active
      // with the agent, who can address the supervisor's concern and re-request.
      patchTicket(id, { approvalStatus: 'rejected', assignmentStatus: t0?.assignee ? 'Assigned' : 'Unassigned' }, 'status', `Approval rejected by ${user?.name || 'supervisor'} — returned for rework`)
      pushNotification({ type: 'escalation', title: 'Approval rejected', body: `${t0?.ref} sent back for rework.`, ref: t0?.ref })
      if (t0) startLifecycleEmail('rejected', t0)
      addToast({ type: 'warning', title: 'Rejected', message: `${t0?.ref} returned to the agent for rework.` })
    },
    [tickets, patchTicket, pushNotification, addToast, user],
  )

  // SLA auto-escalation: any active, non-urgent ticket past its SLA window is
  // escalated automatically (priority → Urgent, persisted to Data Fabric, plus an
  // in-app alert). It does NOT email — see escalateTicket({auto}) — and each
  // ticket is processed at most ONCE per session (the ref guard) so the sweep can
  // never re-fire on the same ticket. The interval is created a single time per
  // sign-in and reads the always-current ticketsRef.
  const autoEscalatedRef = useRef(new Set())
  useEffect(() => {
    if (!user) return
    const sweep = () => {
      let n = 0
      ticketsRef.current.forEach((t) => {
        if (autoEscalatedRef.current.has(t.id)) return
        if (isActive(t) && (t.priority || '').toLowerCase() !== 'urgent' && !t.escalated && t.approvalStatus !== 'pending' && isOverdue(t)) {
          autoEscalatedRef.current.add(t.id)
          escalateTicket(t.id, { auto: true })
          n++
        }
      })
      if (n) addToast({ type: 'warning', title: 'SLA auto-escalation', message: `${n} overdue ticket(s) raised to Urgent and updated in Data Fabric.` })
    }
    sweep()
    const iv = setInterval(sweep, 60000) // re-check every minute for newly-breached tickets
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // HITL from an approval email: ?approve / ?reject deep link (supervisor only).
  useEffect(() => {
    if (!user || !tickets.length) return
    let action, ref
    try { action = sessionStorage.getItem('sesap_deeplink_action'); ref = sessionStorage.getItem('sesap_deeplink_ticket') } catch { /* ignore */ }
    if (!action || !ref) return
    // Only a supervisor may action an approval; if someone else signed in, drop
    // the pending action rather than leaving it to fire on a later session.
    if (isSupervisor(user)) {
      const hit = tickets.find((x) => (x.ref || '').toLowerCase() === ref.toLowerCase())
      if (hit && hit.approvalStatus === 'pending') {
        if (action === 'approve') approveTicket(hit.id)
        else if (action === 'reject') rejectTicket(hit.id)
      }
    } else {
      addToast({ type: 'info', title: 'Approval needs a supervisor', message: 'Sign in with a supervisor account to approve or reject.' })
    }
    try { sessionStorage.removeItem('sesap_deeplink_action') } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tickets])

  const deleteTicket = useCallback(
    (id) => {
      if (!window.confirm('Delete this ticket? This cannot be undone.')) return
      const t0 = tickets.find((x) => x.id === id)
      setTickets((prev) => prev.filter((t) => t.id !== id))
      if (openTicketId === id) setOpenTicketId(null)
      addToast({ type: 'error', title: 'Ticket deleted', message: `${t0?.ref} removed.` })
    },
    [tickets, openTicketId, addToast],
  )

  const createTicket = useCallback(
    (data, { notifyAssignee = false } = {}) => {
      const id = nextId(tickets)
      const ref = refFor(id)
      const ts = now()
      const ticket = {
        id,
        ref,
        attachments: [],
        escalated: false,
        // Drives the Maestro actor gateway (customer vs staff intake). A staff
        // member (agent/supervisor) raising a ticket routes down the staff path.
        actorRole: (user?.accessLevel === 'agent' || user?.accessLevel === 'supervisor') ? 'staff' : 'customer',
        tags: data.tags || [],
        ...data,
        createdAt: ts,
        updatedAt: ts,
        activity: [
          { type: 'created', text: `Ticket created via ${data.channel || 'Portal'}`, author: 'You', at: ts },
          { type: 'status', text: `Routed to Orchestrator queue "${QUEUE_NAME}" for Data Fabric sync — status: Unassigned`, author: 'System', at: ts },
        ],
      }
      // Internal requests (purchases, reimbursements, vendor contracts, …) are
      // created straight into PENDING APPROVAL and routed to a supervisor before
      // any work / auto-assignment proceeds.
      const requiresApproval = needsApprovalOnCreate(ticket)
      if (requiresApproval) {
        ticket.approvalStatus = 'pending'
        ticket.assignmentStatus = 'PendingApproval'
        ticket.activity.push({ type: 'status', text: 'Internal request — routed to a supervisor for approval before work begins', author: 'System', at: ts })
      }
      setTickets((prev) => [ticket, ...prev])
      addToast({ type: requiresApproval ? 'info' : 'success', title: requiresApproval ? 'Sent for approval' : 'Ticket created', message: requiresApproval ? `${ref} routed to a supervisor for sign-off.` : `${ref} logged successfully.` })
      if (requiresApproval) {
        pushNotification({ type: 'escalation', title: 'Approval requested', body: `${ref} (${ticket.category}) awaiting supervisor sign-off.`, ref })
        startLifecycleEmail('approval', { ...ticket, requesterEmail: SUPERVISOR_EMAIL })
      }

      // Store in Data Fabric (SDK, direct) → else Orchestrator queue → else simulate.
      // Best-effort: never blocks or breaks ticket creation.
      syncNewTicket(ticket).then((res) => {
        if (res.ok && res.via === 'datafabric') {
          pushNotification({ type: 'system', title: 'Stored in Data Fabric', body: `${ref} saved to the Ticket entity (Unassigned).`, ref })
          // Send the requester an acknowledgement email (lifecycle stage: created).
          if (!requiresApproval) startLifecycleEmail('created', ticket)
          // Ticket is in Data Fabric → start the Maestro orchestration (classify → route →
          // assign → RPA robot → write-back). This is the click → flow trigger. Internal
          // requests wait for supervisor approval first, so orchestration is deferred.
          if (!requiresApproval) startOrchestration({ action: 'submit', ticket }).then((o) => {
            if (o.ok) {
              pushNotification({ type: 'system', title: 'Orchestration started', body: `Maestro TicketLifecycle launched for ${ref} (job ${o.jobKey || 'queued'}).`, ref })
              addToast({ type: 'info', title: 'Orchestration started', message: `Maestro is triaging & auto-assigning ${ref}.` })
            } else if (!o.disabled) {
              // Silent when Live automation is intentionally off (conserving Robot Units).
              addToast({ type: 'warning', title: 'Orchestration not started', message: o.error })
            }
          })
        } else if (res.ok && res.via === 'queue') {
          pushNotification({ type: 'system', title: 'Queued for Data Fabric', body: `${ref} added to ${QUEUE_NAME} (unassigned).`, ref })
        } else if (!res.ok) {
          addToast({ type: 'warning', title: 'Data Fabric sync failed', message: res.error || 'Ticket saved locally only.' })
        }
      })

      if (data.assignee) {
        pushNotification({ type: 'assignment', title: 'Ticket assigned', body: `${ref} assigned to ${data.assignee}.`, ref })
        if (notifyAssignee && data.assigneeEmail) {
          const { subject, body } = assignmentEmail(ticket, data.assignee)
          openMail({ to: data.assigneeEmail, subject, body })
          addToast({ type: 'info', title: 'Assignee notified', message: `Email drafted to ${data.assignee}.` })
        }
      }
      return ticket
    },
    [tickets, addToast, pushNotification],
  )

  // ---- Bulk ---------------------------------------------------------------
  const bulkSetStatus = useCallback(
    (ids, status) => {
      ids.forEach((id) => patchTicket(id, { status }, 'status', `Status → ${STATUS_LABELS[status]} (bulk)`))
      addToast({ type: 'info', title: 'Bulk update', message: `${ids.length} ticket(s) → ${STATUS_LABELS[status]}.` })
    },
    [patchTicket, addToast],
  )
  const bulkAssign = useCallback(
    (ids, engineer) => {
      ids.forEach((id) => patchTicket(id, { assignee: engineer.name, assigneeEmail: engineer.email }, 'assign', `Assigned to ${engineer.name} (bulk)`))
      addToast({ type: 'success', title: 'Bulk assign', message: `${ids.length} ticket(s) → ${engineer.name}.` })
    },
    [patchTicket, addToast],
  )
  const bulkEscalate = useCallback(
    (ids) => {
      ids.forEach((id) => patchTicket(id, { escalated: true, priority: 'urgent' }, 'status', 'Escalated (bulk)'))
      addToast({ type: 'warning', title: 'Bulk escalate', message: `${ids.length} ticket(s) escalated.` })
    },
    [patchTicket, addToast],
  )
  const bulkDelete = useCallback(
    (ids) => {
      if (!window.confirm(`Delete ${ids.length} ticket(s)? This cannot be undone.`)) return
      const set = new Set(ids)
      setTickets((prev) => prev.filter((t) => !set.has(t.id)))
      addToast({ type: 'error', title: 'Bulk delete', message: `${ids.length} ticket(s) removed.` })
    },
    [addToast],
  )

  const openTicket = tickets.find((t) => t.id === openTicketId) || null

  const value = useMemo(
    () => ({
      user, entered, setEntered, login, logout,
      theme, toggleTheme,
      view, viewParams, navigate,
      sidebarCollapsed, setSidebarCollapsed,
      tickets, openTicket, openTicketId, setOpenTicketId,
      dataSource, isLoadingTickets, refreshFromDataFabric,
      patchTicket, addComment, uploadFiles, removeAttachment,
      assignTicket, escalateTicket, setStatus, deleteTicket, createTicket,
      requestApproval, approveTicket, rejectTicket,
      role: roleLabel(user), isSupervisor: isSupervisor(user), isAgent: isAgent(user),
      pendingApprovals: tickets.filter((t) => t.approvalStatus === 'pending'),
      bulkSetStatus, bulkAssign, bulkEscalate, bulkDelete,
      notifications, unreadCount, pushNotification, markNotificationRead, markAllNotificationsRead,
      toasts, addToast, dismissToast,
    }),
    [
      user, entered, login, logout, theme, toggleTheme, view, viewParams, navigate,
      sidebarCollapsed, tickets, openTicket, openTicketId, patchTicket, addComment,
      uploadFiles, removeAttachment, assignTicket, escalateTicket, setStatus, deleteTicket,
      createTicket, bulkSetStatus, bulkAssign, bulkEscalate, bulkDelete, notifications,
      unreadCount, pushNotification, markNotificationRead, markAllNotificationsRead, toasts,
      addToast, dismissToast,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
