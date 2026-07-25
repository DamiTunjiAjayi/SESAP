// =============================================================================
// SESAP AI Support Copilot — a natural-language engine over ticket data that is
// scoped to the SIGNED-IN user and can DO things, not just answer.
//
//  • Role scope:   supervisor → all tickets · agent → the tickets assigned to
//                  them · customer → their own requests. Counts, summaries and
//                  "my" questions are answered against that scope.
//  • Actions:      when handed the app's action handlers it can take, escalate,
//                  resolve, close or send-for-approval a ticket by reference,
//                  and open a ticket — respecting the user's permissions.
//
// Deterministic and offline (no key in the browser). UPGRADE PATH: forward the
// message + a compact JSON of the scoped tickets to Claude from a backend and
// return the model's reply; this rule engine becomes the instant fallback.
// =============================================================================

import { ENGINEERS, engineerByName } from './data.js'
import { dueDate, isOverdue, isActive, isAssignedTo, STATUS_LABELS, titleCase } from './utils.js'
import { isSupervisor, isAgent, isCustomer } from './auth.js'

const daysOld = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000)
const fmt = (t) => `${t.ref} — ${t.subject}`

// ---- role helpers ----------------------------------------------------------
function scopeFor(all, user) {
  if (!user || isSupervisor(user)) return all
  if (isAgent(user)) return all.filter((t) => isAssignedTo(t, user))
  if (isCustomer(user)) return all.filter((t) => (t.requesterEmail || '').toLowerCase() === (user.email || '').toLowerCase())
  return all
}
const scopeWord = (user) => (isAgent(user) ? 'assigned to you' : isCustomer(user) ? 'you raised' : 'across the bank')

export function getSuggestions(user) {
  if (isCustomer(user)) return ['How many open requests do I have?', 'Show my requests at SLA risk', 'Summarise my latest request', 'What is the status of #1042?']
  if (isAgent(user)) return ['What is on my plate today?', 'My tickets at SLA risk', 'Escalate #1042', 'Resolve #1039', 'Take #1037']
  return ['Give me an executive summary', 'Which tickets are at SLA risk?', 'Recommend an assignee for #1037', 'Escalate #1042', 'Draft a response for #1042']
}
export const SUGGESTIONS = getSuggestions(null)

function recommendAssignee(ticket, tickets) {
  const load = {}
  tickets.forEach((t) => { if (t.assignee && isActive(t)) load[t.assignee] = (load[t.assignee] || 0) + 1 })
  const candidates = ENGINEERS.filter((e) => !ticket?.team || e.team === ticket.team)
  const pool = candidates.length ? candidates : ENGINEERS
  return [...pool].sort((a, b) => (load[a.name] || 0) - (load[b.name] || 0))[0]
}

// ---------------------------------------------------------------------------
// answerQuestion(raw, ctx)
//   ctx = { tickets, user, actions } — `actions` optional:
//   { take, escalate, resolve, close, reopen, requestApproval, open }
// Backward compatible: passing an array as ctx is treated as {tickets}.
// ---------------------------------------------------------------------------
export function answerQuestion(raw, ctx = {}) {
  if (Array.isArray(ctx)) ctx = { tickets: ctx }
  const all = ctx.tickets || []
  const user = ctx.user || null
  const A = ctx.actions || null
  const q = (raw || '').toLowerCase().trim()
  const has = (...w) => w.some((x) => q.includes(x))
  if (!q) return 'Ask me to summarise, search, recommend an assignee, draft a response — or tell me to take, escalate, resolve or close a ticket by its reference.'

  const scope = scopeFor(all, user)
  const idMatch = q.match(/#?\b(\d{3,})\b/)
  const ticketById = idMatch ? all.find((t) => t.id === Number(idMatch[1])) : null

  if (has('hello', 'hi ', 'hey', 'help', 'what can you')) {
    const who = isCustomer(user) ? 'track and summarise your requests' : isAgent(user) ? 'manage the tickets assigned to you — summarise, take, escalate, resolve or close them' : 'run the whole support desk — summaries, SLA risk, assignee recommendations, and act on any ticket'
    return `I am your SESAP Copilot. Signed in as ${user?.name || 'guest'} (${roleWord(user)}), I can help you ${who}.\nTry:\n` + getSuggestions(user).map((s) => `• ${s}`).join('\n')
  }

  // ---- ACTIONS (require handlers + permission) -----------------------------
  if (A && !isCustomer(user) && ticketById) {
    const t = ticketById
    const guard = () => {
      // Agents may only act on their own tickets; supervisors on any.
      if (isSupervisor(user)) return null
      if (isAgent(user) && !isAssignedTo(t, user)) return `${t.ref} is not assigned to you, so I can't change it. Ask a supervisor, or take it first.`
      return null
    }
    if (has('take', 'assign to me', 'assign it to me', "i'll take", 'give it to me')) {
      const eng = engineerByName(user?.name) || { name: user?.name, email: user?.email, team: t.team }
      A.take?.(t.id, eng)
      return `Done — ${t.ref} is now assigned to you (${user?.name}). It will show under "Assigned To Me".`
    }
    if (has('escalate')) { const g = guard(); if (g) return g; A.escalate?.(t.id); return `Escalated ${t.ref} to Urgent priority. ${isCustomer(user) ? '' : 'Data Fabric updated.'}` }
    if (has('resolve', 'mark resolved', 'close it as resolved')) { const g = guard(); if (g) return g; A.resolve?.(t.id); return `Marked ${t.ref} as Resolved.` }
    if (has('close')) { const g = guard(); if (g) return g; A.close?.(t.id); return `Closed ${t.ref}.` }
    if (has('reopen')) { const g = guard(); if (g) return g; A.reopen?.(t.id); return `Reopened ${t.ref}.` }
    if (has('approval', 'sign-off', 'sign off', 'approve request')) { const g = guard(); if (g) return g; A.requestApproval?.(t.id); return `Sent ${t.ref} to a supervisor for approval.` }
  }
  // Open / show a specific ticket
  if (A && ticketById && has('open', 'show me', 'go to', 'take me to')) { A.open?.(ticketById.id); return `Opening ${ticketById.ref}…` }

  // ---- Response draft ------------------------------------------------------
  if (has('draft', 'response', 'reply') && ticketById) {
    const t = ticketById
    return (
      `Suggested response for ${t.ref}:\n\n` +
      `Hi ${t.requester},\n\nThank you for contacting Stanbic IBTC support regarding "${t.subject}". ` +
      `Our ${t.team} team is actively working on this and it is currently marked ${STATUS_LABELS[t.status].toLowerCase()}. ` +
      `We understand the ${t.priority} priority and are treating it accordingly.\n\n` +
      `We will update you shortly with progress. Your reference is ${t.ref}.\n\nKind regards,\nStanbic IBTC Support`
    )
  }

  // ---- Recommend assignee (staff only) -------------------------------------
  if (!isCustomer(user) && has('recommend', 'who should', 'best person') && !has('take')) {
    const t = ticketById || all.find((x) => !x.assignee && isActive(x))
    if (!t) return 'No unassigned active tickets to recommend for.'
    const rec = recommendAssignee(t, all)
    return `For ${t.ref} (${t.team}), I recommend **${rec.name}** (${rec.team}) — lightest active load on that team. Email: ${rec.email}.`
  }

  // ---- Summarise a specific ticket -----------------------------------------
  if (has('summar', 'about', 'tell me', 'status of') && ticketById) {
    const t = ticketById
    const notes = (t.activity || []).filter((a) => a.type === 'comment').slice(-2)
    return (
      `${t.ref} — ${t.subject}\n` +
      `Status ${STATUS_LABELS[t.status]} · ${titleCase(t.priority)} priority · ${t.team}\n` +
      `Assignee: ${t.assignee || 'unassigned'} · Service: ${t.businessService}\n` +
      `Opened ${daysOld(t.createdAt)}d ago · SLA ${isOverdue(t) ? '⚠️ BREACHED' : 'on track'}\n` +
      (notes.length ? `\nLatest notes:\n${notes.map((n) => `• ${n.text}`).join('\n')}` : '')
    )
  }

  // ---- "What's on my plate" / my tickets -----------------------------------
  if (has('my plate', 'my tickets', 'my queue', 'my requests', 'assigned to me', 'on my plate', 'my work')) {
    const active = scope.filter(isActive)
    const overdue = scope.filter(isOverdue)
    if (!scope.length) return isCustomer(user) ? 'You have no requests on record.' : 'Nothing is assigned to you right now. 🎉'
    return (
      `You have ${scope.length} ticket(s) ${scopeWord(user)} — ${active.length} active, ${overdue.length} overdue.\n` +
      active.slice(0, 8).map((t) => `• ${fmt(t)} — ${titleCase(t.priority)}${isOverdue(t) ? ' ⚠️ overdue' : ''}`).join('\n')
    )
  }

  // ---- SLA risk (scoped) ---------------------------------------------------
  if (has('sla', 'risk', 'breach', 'overdue', 'late')) {
    const risky = scope.filter(isActive).map((t) => ({ t, due: dueDate(t).getTime() }))
      .filter(({ due }) => due - Date.now() < 24 * 3600 * 1000).sort((a, b) => a.due - b.due).slice(0, 8)
    if (!risky.length) return `No tickets ${scopeWord(user)} are within 24h of an SLA breach. 👍`
    return `${risky.length} ticket(s) ${scopeWord(user)} at SLA risk (next 24h):\n` +
      risky.map(({ t }) => `• ${fmt(t)} — ${isOverdue(t) ? 'BREACHED' : 'due soon'}`).join('\n')
  }

  // ---- Executive / overview (scoped) ---------------------------------------
  if (has('executive', 'overview', 'summary', 'briefing', 'how are we', 'how many')) {
    const total = scope.length
    const open = scope.filter((t) => t.status === 'open').length
    const prog = scope.filter((t) => t.status === 'in_progress').length
    const overdue = scope.filter(isOverdue).length
    const esc = scope.filter((t) => t.escalated).length
    const compliance = Math.round((scope.filter((t) => !isOverdue(t)).length / (total || 1)) * 100)
    const head = isSupervisor(user) ? 'Executive summary' : isAgent(user) ? 'Your workload' : 'Your requests'
    return (
      `${head} (${scopeWord(user)}):\n` +
      `• ${total} ticket(s) — ${open} open, ${prog} in progress\n` +
      `• SLA compliance: ${compliance}%\n` +
      `• ${overdue} overdue, ${esc} escalated` +
      (isSupervisor(user) ? `\n• Focus: ${overdue > 0 ? 'clear the overdue queue' : 'maintain response times'}.` : '')
    )
  }

  // ---- NL search (scoped) --------------------------------------------------
  if (has('search', 'find', 'show', 'list', 'tickets about', 'related to')) {
    const terms = q.replace(/search|find|show|list|tickets|about|related to|:/g, '').trim()
    const results = keywordSearch(terms, scope).slice(0, 8)
    return results.length
      ? `Found ${results.length} ticket(s) for "${terms}" ${scopeWord(user)}:\n${results.map((t) => `• ${fmt(t)}`).join('\n')}`
      : `No tickets ${scopeWord(user)} matched "${terms}".`
  }

  // ---- Priority quick counts (scoped) --------------------------------------
  const pri = ['urgent', 'high', 'medium', 'low'].find((p) => q.includes(p))
  if (pri) {
    const list = scope.filter((t) => t.priority === pri)
    return `${list.length} ${pri}-priority ticket(s) ${scopeWord(user)}.\n${list.slice(0, 8).map((t) => `• ${fmt(t)}`).join('\n')}`
  }

  // ---- Last resort: scoped keyword search ----------------------------------
  const results = keywordSearch(q, scope).slice(0, 6)
  if (results.length) return `Here is what I found ${scopeWord(user)}:\n${results.map((t) => `• ${fmt(t)}`).join('\n')}`
  return isCustomer(user)
    ? 'I can tell you how many requests you have, flag ones at SLA risk, or summarise a request by its reference (e.g. "status of #1042").'
    : 'I can summarise tickets, flag SLA risks, recommend assignees, draft responses, or act on a ticket ("escalate #1042", "resolve #1039", "take #1037"). Try a suggestion.'
}

function roleWord(user) { return isSupervisor(user) ? 'supervisor' : isAgent(user) ? 'agent' : isCustomer(user) ? 'customer' : 'guest' }

// A proactive, data-grounded opener for the copilot — so it greets you with what
// actually needs attention rather than a generic hello.
export function openingInsight(all, user) {
  const scope = scopeFor(all || [], user)
  const active = scope.filter(isActive).length
  const overdue = scope.filter(isOverdue).length
  const risk = scope.filter((t) => isActive(t) && !isOverdue(t) && dueDate(t).getTime() - Date.now() < 24 * 3600 * 1000).length
  if (isCustomer(user)) return scope.length ? `You have ${scope.length} request(s) on record${active ? `, ${active} still active` : ''}.` : 'You have no open requests.'
  if (!scope.length) return isAgent(user) ? 'Nothing is assigned to you right now — enjoy the calm. 🎉' : 'The desk is clear right now. 🎉'
  const bits = [`${active} active`]
  if (overdue) bits.push(`⚠️ ${overdue} overdue`)
  if (risk) bits.push(`${risk} nearing SLA`)
  return `You have ${scope.length} ticket(s) ${scopeWord(user)} — ${bits.join(', ')}.`
}

export function keywordSearch(query, tickets) {
  const q = (query || '').toLowerCase().trim()
  if (!q) return []
  const words = q.split(/\s+/).filter(Boolean)
  return tickets
    .map((t) => {
      const hay = [t.ref, t.subject, t.description, t.requester, t.assignee, t.category, t.subCategory, t.businessService, (t.tags || []).join(' ')].join(' ').toLowerCase()
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0)
      return { t, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t)
}
