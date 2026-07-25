# SESAP — Code Build & Review Guide (v2.1.0)

> **v2.1.0 adds role-based access:** a **Staff Workspace** (admin/agent) and a separate
> **Customer Portal** (end-user), chosen at login. See [§6a Roles & the Customer Portal](#6a-roles--the-customer-portal).


> **Stanbic IBTC Enterprise Support & Automation Platform (SESAP)**
> A single, annotated reference to the entire codebase for review by any human or
> AI agent. **All secrets are redacted** — see [§11 Security & Redactions](#11-security--redactions).

- **Type:** Single-page web application (SPA), frontend-only
- **Stack:** React 18 + Vite 5 (plain JS/JSX, zero runtime dependencies beyond React)
- **Data:** In-browser mock data persisted to `localStorage` (real backend/DB is the next milestone)
- **Deployed as:** UiPath Coded Web App at `https://stanbvosiacv.uipath.host/support-dashboard-damilare`
- **Version:** 2.1.0 (role-based access; builds on the v2.0.0 enterprise redesign)

---

## Table of Contents
1. [What changed in v2.0.0](#1-what-changed-in-v200)
2. [Executive Overview](#2-executive-overview)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [Project Structure](#4-project-structure)
5. [The Data Model](#5-the-data-model)
6. [Application Flow (Landing → Login → Workspace)](#6-application-flow)
7. [Core Logic Modules (full source)](#7-core-logic-modules-full-source)
8. [The Store — AppContext (full source)](#8-the-store--appcontext-full-source)
9. [UI Components & Pages (documented)](#9-ui-components--pages-documented)
10. [Feature → Code Map](#10-feature--code-map)
11. [Security & Redactions](#11-security--redactions)
12. [Build & Deployment](#12-build--deployment)
13. [Known Limitations & Reviewer Notes](#13-known-limitations--reviewer-notes)

---

## 1. What changed in v2.0.0

The v1.x app was a single-page ticket table. v2.0.0 is a **multi-module enterprise
platform** rebuilt around a banking-blue design system (Azure/ServiceNow/Jira/Power BI
inspiration), a central state store, and a routed workspace. New in this version:

- **Rebrand to SESAP** across the whole UI.
- **Public landing page**, **premium split-screen login**, and an authenticated
  **workspace shell** (collapsible sidebar + global top nav).
- **Executive dashboard**: 10 KPIs with animated counters + sparklines, line/donut
  charts, an Executive Progress Centre, agent leaderboard, recent-activity feed, and
  SLA-breach countdowns.
- **Enterprise ticket queue**: search, multi-filter, sort, column toggles, and bulk
  actions (status/assign/escalate/export/delete).
- **Create Ticket** with full classification and **assign + email-the-assignee**.
- **Tabbed ticket workspace** (Overview, Activity, Internal Notes, Attachments,
  Related, Audit Trail, Approvals, Automation Logs, Communication) with ~13 actions.
- **AI Support Copilot** (floating + full page): NL search, summaries, assignee
  recommendations, SLA-risk radar, response drafts, executive summaries.
- **Modules**: Knowledge Centre, Automation Health, Reports, Notification Centre,
  Audit Trail, Settings, Help Centre.
- **Micro-interactions**: toasts, animated counters, skeleton class, hover elevation,
  sidebar/drawer transitions.

---

## 2. Executive Overview

SESAP unifies support-ticket operations, RPA automation health, analytics, and an AI
copilot into one banking-grade console. A user lands on a marketing-style landing page,
signs in through a split-screen login, and enters a workspace with a sidebar of 16
destinations. All ticket data lives in React state, mirrored to `localStorage`.

**The single most important fact for a reviewer:** there is still **no backend**.
The login is a client-side gate (not real auth), uploaded files are session-only, and
"email the assignee" opens the user's mail client via a `mailto:` link rather than
sending server-side. These are deliberate, documented trade-offs pending the backend.

---

## 3. Architecture & Data Flow

```
                       main.jsx
                          │  wraps everything in <AppProvider>
                          ▼
                   context/AppContext.jsx  ◀── single source of truth
   (auth · navigation · theme · tickets · notifications · toasts · all mutations)
                          │  exposed via useApp()
                          ▼
                        App.jsx  ── routes on (user, entered):
              ┌───────────┼─────────────────────────────┐
              ▼           ▼                               ▼
          Landing       Login                    layouts/Workspace
                                          ┌────────────┼─────────────┐
                                          ▼            ▼             ▼
                                       Sidebar      TopNav      Router(view)
                                                                    │
                        ┌───────────────────────────────────────────┤
                        ▼         ▼         ▼        ▼        ▼       ▼ …
                    Dashboard  TicketQueue  Create  Reports  Knowledge  (11 pages)
                                          │
                        overlays: <TicketWorkspace> · <AICopilot> · <ToastStack>
```

**Principles**
- **One store.** `AppContext` holds all mutable state and every action (`useApp()`).
  Components never mutate tickets directly; they call store actions, which also fire
  notifications/toasts and handle email side-effects.
- **View-based routing without a router dependency.** `view` is a string in the store;
  `Workspace`'s `Router` maps it to a page. Six sidebar entries reuse one `TicketQueue`
  with a `preset` prop.
- **Pure logic modules.** `utils.js`, `copilot.js`, `auth.js`, `data.js` are React-free
  and unit-testable.
- **Derived state via `useMemo`** in pages (KPIs, filtered lists, leaderboards) so
  numbers never drift from the ticket array.

---

## 4. Project Structure

```
src/
├── main.jsx                     # Entry — mounts <AppProvider><App/></AppProvider>
├── App.jsx                      # Top router: Landing | Login | Workspace + ToastStack
├── index.css                    # Entire enterprise design system (~900 lines)
├── data.js                      # Seed tickets, taxonomies, people, KB, robots, trends
├── utils.js                     # SLA/dates, export (CSV/Excel/print), email, chart maths
├── copilot.js                   # Offline AI copilot engine (NL over ticket data)
├── auth.js                      # Client-side login/session       [SECRETS REDACTED]
├── context/
│   └── AppContext.jsx           # The store: state + all mutations (useApp hook)
├── layouts/
│   ├── Workspace.jsx            # STAFF shell: sidebar + topnav + routed page
│   └── CustomerPortal.jsx       # CUSTOMER shell: portal nav + home/requests/raise + ticket view
├── components/
│   ├── TicketWorkspace.jsx      # Tabbed ticket detail (9 tabs, ~13 actions)
│   ├── AICopilot.jsx            # Floating copilot panel
│   ├── layout/
│   │   ├── Sidebar.jsx          # Collapsible left navigation (16 items, live counts)
│   │   └── TopNav.jsx           # Global search, notifications, theme, profile menu
│   └── ui/
│       ├── primitives.jsx       # Badges, Avatar, AnimatedNumber, Skeleton, ProgressRing
│       ├── Charts.jsx           # SVG Donut, LineChart, Sparkline, BarList, ChartLegend
│       └── ToastStack.jsx       # Renders transient toasts from the store
└── pages/
    ├── Landing.jsx              # Public hero + 6 modules + health + announcements
    ├── Login.jsx                # Split-screen sign-in
    ├── Dashboard.jsx            # Executive command centre
    ├── TicketQueue.jsx          # Enterprise table (presets, filters, bulk)
    ├── CreateTicket.jsx         # Create + classify + assign + email
    ├── Reports.jsx              # Analytics charts
    ├── AutomationHealth.jsx     # RPA robot fleet health
    ├── KnowledgeCentre.jsx      # FAQ/SOP/Runbook/Known-error articles
    ├── AuditTrail.jsx           # Global activity log
    ├── NotificationsPage.jsx    # Grouped notification centre
    ├── CopilotPage.jsx          # Full-page AI copilot
    ├── Settings.jsx             # Profile, appearance, prefs, data reset
    └── HelpCentre.jsx           # Getting-started + FAQ
```

---

## 5. The Data Model

A ticket (see `data.js`) now carries enterprise fields:

```js
{
  id: 1042,
  ref: 'SESAP-1042',            // human reference used everywhere
  subject, description,
  requester, requesterEmail,
  status,                        // open | in_progress | resolved | closed
  priority,                      // low | medium | high | urgent
  category, subCategory,         // from CATEGORIES taxonomy
  department,                    // from DEPARTMENTS
  channel,                       // Portal | Email | Phone | Chat | Branch | Automation
  team,                          // owning support team
  assignee, assigneeEmail,       // engineer (nullable)
  businessService,               // Internet Banking, ATM Network, …
  riskLevel,                     // Low | Medium | High
  tags: [],
  escalated: bool,
  createdAt, updatedAt,          // ISO strings
  attachments: [{ id, name, size, type, url }],   // url dropped on persist
  activity: [{ type, text, at, author }],          // append-only audit log
}
```

Reference data also exported by `data.js`: `CATEGORIES`, `DEPARTMENTS`, `TEAMS`,
`CHANNELS`, `BUSINESS_SERVICES`, `RISK_LEVELS`, `ENGINEERS` (with emails/teams/initials),
`knowledgeArticles`, `automations` (RPA robots), `announcements`, and `volumeTrend`
(14-day series for the dashboard line chart). **Derived** values (SLA due date, overdue,
progress) are computed live in `utils.js`, never stored.

---

## 6. Application Flow

`App.jsx` chooses the screen from two store flags:

```jsx
if (user) return <Workspace/>        // authenticated
else if (entered) return <Login/>     // clicked "Sign In" on the landing page
else return <Landing/>                // public
```

- **Landing** → `setEntered(true)` on any Sign-In CTA → **Login**.
- **Login** → `validateLogin()` → `login(user)` sets the session → **Workspace**.
- **Workspace** renders `Sidebar` + `TopNav` + the routed page, plus the ticket
  workspace overlay, the floating copilot, and the toast stack. `navigate(view)`
  switches pages; `setOpenTicketId(id)` opens the tabbed workspace over any page.

---

## 6a. Roles & the Customer Portal

Each account in `auth.js` carries an `accessLevel`:

| accessLevel | Interface | Demo login |
|---|---|---|
| `admin` | Staff Workspace (full command centre) | `admin` / `‹REDACTED›` |
| `agent` | Staff Workspace | `ngozi` / `‹REDACTED›` |
| `user` | **Customer Portal** | `user` / `‹REDACTED›` (Aisha Bello) |

**Login** shows a **Staff Portal / Customer Portal** toggle. On submit, the selected
portal is enforced against the account's role (`isCustomer`/`isStaff` in `auth.js`), so a
staff account cannot sign into the customer portal and vice-versa — the two logins are
genuinely distinct. `App.jsx` then routes:

```jsx
if (user) return isCustomer(user) ? <CustomerPortal/> : <Workspace/>
```

**`layouts/CustomerPortal.jsx`** is a deliberately scoped end-user experience — its own
lightweight top bar + horizontal nav (Home · My Requests · Raise a Request · Knowledge
Base), no admin sidebar. It manages its own local `view` and selected-ticket state and
**only ever shows the signed-in user's own tickets** (`tickets.filter(t => t.requesterEmail
=== user.email)`). Sub-views (all in this one file):
- **PortalHome** — welcome hero, my-ticket stat tiles, recent requests, announcements.
- **MyRequests** — filterable list of the user's requests with status badges.
- **RaiseRequest** — simplified create form (no internal fields, no assignee/team); calls
  `createTicket` with `requester`/`requesterEmail` set to the current user, `status: open`,
  unassigned — so it lands in the staff queue for triage.
- **CustomerTicket** — a read-mostly ticket view with a **status stepper**
  (Open → In progress → Resolved → Closed), a public conversation timeline, attachment
  list, and a **reply + attach** box (customers can comment and upload, but cannot edit
  status/priority/assignee or see internal-only admin tabs).

**Privacy:** the customer's floating **AI Copilot is scoped to their own tickets** —
`AICopilot` accepts an optional `tickets` prop, and the portal passes only `mine`, so the
assistant can never surface another customer's data. (Staff get the full ticket set.)

---

## 7. Core Logic Modules (full source)

### `src/auth.js` ⚠️ SECRETS REDACTED
Client-side credential check + session persistence. Passwords redacted in this doc.

```js
// FRONTEND-ONLY gate — NOT real authentication (see §11). accessLevel drives the UI.
export const USERS = [
  { username: 'admin', password: '‹REDACTED›', name: 'Damilare Tunji-Ajayi',
    role: 'Platform Administrator', email: 'damilare.tunji-ajayi@stanbicibtc.com', initials: 'DT', accessLevel: 'admin' },
  { username: 'ngozi', password: '‹REDACTED›', name: 'Ngozi Eze',
    role: 'Payments Operations Lead', email: 'ngozi.eze@stanbicibtc.com', initials: 'NE', accessLevel: 'agent' },
  { username: 'user',  password: '‹REDACTED›', name: 'Aisha Bello',
    role: 'Customer', email: 'aisha.bello@example.com', initials: 'AB', accessLevel: 'user' },
]
const SESSION_KEY = 'sesap_session'
export const isStaff = (u) => u?.accessLevel === 'admin' || u?.accessLevel === 'agent'
export const isCustomer = (u) => u?.accessLevel === 'user'
export function validateLogin(username, password) {
  const u = (username || '').trim().toLowerCase()
  const match = USERS.find((x) => x.username === u && x.password === password)
  if (!match) return null
  const { password: _pw, ...safe } = match   // never expose the password on the session
  return safe
}
export const getSession = () => { try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null } catch { return null } }
export const saveSession = (user) => localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, at: new Date().toISOString() }))
export const clearSession = () => localStorage.removeItem(SESSION_KEY)
```

### `src/utils.js`
SLA maths, date formatting, export (CSV/Excel/print), the client-side email helpers,
and SVG chart geometry. Full source:

```js
export const SLA_HOURS = { urgent: 24, high: 48, medium: 96, low: 168 }
export function dueDate(ticket) {
  const created = new Date(ticket.createdAt).getTime()
  const hours = SLA_HOURS[ticket.priority] ?? 96
  return new Date(created + hours * 3600 * 1000)
}
export const isActive = (t) => t.status === 'open' || t.status === 'in_progress'
export const isOverdue = (t) => isActive(t) && Date.now() > dueDate(t).getTime()
export function slaProgress(t) {
  const c = new Date(t.createdAt).getTime()
  return Math.max(0, (Date.now() - c) / (dueDate(t).getTime() - c))
}
export const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const formatDateTime = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
export function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 0) return 'just now'
  for (const [label, size] of [['y',31536000],['mo',2592000],['d',86400],['h',3600],['m',60]]) {
    const v = Math.floor(secs / size); if (v >= 1) return `${v}${label} ago`
  }
  return 'just now'
}
export function countdown(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now(); const neg = diff < 0
  let s = Math.floor(Math.abs(diff) / 1000)
  const d = Math.floor(s/86400); s -= d*86400; const h = Math.floor(s/3600); s -= h*3600; const m = Math.floor(s/60)
  return (neg ? '-' : '') + (d ? [`${d}d`,`${h}h`] : [`${h}h`,`${m}m`]).join(' ')
}
export function dueLabel(ticket) {
  if (!isActive(ticket)) return null
  const hours = Math.round((dueDate(ticket).getTime() - Date.now()) / 3600000)
  if (hours < 0) return { text: `${Math.abs(Math.round(hours/24)) || Math.abs(hours)+'h'} overdue`, overdue: true }
  if (hours < 24) return { text: `due in ${hours}h`, soon: true }
  return { text: `due in ${Math.round(hours/24)}d` }
}
export const humanBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`
export const initials = (name) => (name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
export const titleCase = (s) => s ? s[0].toUpperCase()+s.slice(1).replace(/_/g,' ') : ''
export const STATUS_LABELS = { open:'Open', in_progress:'In progress', resolved:'Resolved', closed:'Closed' }
export const nextId = (tickets) => Math.max(1000, ...tickets.map(t=>t.id)) + 1
export const refFor = (id) => `SESAP-${id}`
export const uid = (p='id') => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`

// ---- Email (client-side): builds a mailto: and opens the mail client --------
export function buildMailto({ to, cc, subject, body }) {
  const q = new URLSearchParams(); if (cc) q.set('cc', cc); if (subject) q.set('subject', subject); if (body) q.set('body', body)
  const qs = q.toString().replace(/\+/g, '%20')
  return `mailto:${encodeURIComponent(to)}${qs ? '?' + qs : ''}`
}
export function openMail(opts) { const a = document.createElement('a'); a.href = buildMailto(opts); document.body.appendChild(a); a.click(); a.remove() }
export function assignmentEmail(ticket, assigneeName) { /* builds subject + templated body for an assignment */ }

// ---- Export: CSV (RFC-4180-safe), Excel (.xls HTML table), print/PDF window --
// ticketsToCSV, ticketsToExcel, downloadFile, exportCSV, exportExcel, printTicket

// ---- Chart geometry ---------------------------------------------------------
export function linePath(values, width, height, pad = 4) { /* → SVG path string */ }
export function donutSegments(data, radius = 60, thickness = 22) { /* → [{...d, frac}] arc paths */ }
```
> (Bodies of `assignmentEmail`, the export functions, `linePath`, and `donutSegments`
> are present in the file; abbreviated here for length. They are pure and dependency-free.)

### `src/copilot.js`
The offline AI engine. `answerQuestion(raw, tickets)` matches intents and returns text:
greetings/help, **response draft** for a ticket id, **assignee recommendation** (lightest
active load on the ticket's team), **ticket summary**, **SLA-risk radar** (active tickets
within 24h of `dueDate`), **executive summary** (counts + compliance), and **NL keyword
search** via `keywordSearch()` (scores tickets by term hits across ref/subject/description/
requester/assignee/category/tags). Comment block documents the Claude-API upgrade path
(call from a backend, never the browser). Exports `SUGGESTIONS`, `answerQuestion`,
`keywordSearch`.

### `src/data.js`
Pure data: `APP_NAME`, `APP_VERSION`, the vocabularies, `ENGINEERS`, 12 seed tickets in
the enterprise shape, `knowledgeArticles`, `automations`, `announcements`, `volumeTrend`.
> Engineer emails are **illustrative placeholders** on the corporate domain — replace via
> the directory/SSO integration when the backend lands. Not secrets, but flagged.

---

## 8. The Store — AppContext (full source)

`context/AppContext.jsx` is the heart of the app. It initialises theme/tickets/
notifications/session from `localStorage`, persists them via `useEffect` (stripping
attachment blob URLs, which can't survive a reload), and exposes every action through
`useApp()`.

**State:** `user, entered, theme, view, viewParams, sidebarCollapsed, tickets,
openTicketId, notifications, toasts`.

**Actions (abridged signatures):**
```
login(user) / logout() / navigate(view, params) / toggleTheme()
addToast({type,title,message}) [auto-dismiss] / dismissToast(id)
pushNotification(n) / markNotificationRead(id) / markAllNotificationsRead()
patchTicket(id, patch, type, text, author)   ← generic updater + activity log
addComment(id, text) / uploadFiles(id, files) / removeAttachment(id, attId)
assignTicket(id, engineer, {notify})          ← assigns + notifies + (mailto)
escalateTicket(id) / setStatus(id, status) / deleteTicket(id)
createTicket(data, {notifyAssignee})          ← new ticket + optional email
bulkSetStatus / bulkAssign / bulkEscalate / bulkDelete
```

The email side-effect lives here: `assignTicket` and `createTicket` call `openMail()`
(from `utils.js`) with a templated `assignmentEmail()` body when a notify flag is set and
the engineer has an email — this is the working "they get a mail when I input their mail"
mechanism today. Key excerpt:

```js
const assignTicket = useCallback((id, engineer, { notify = true } = {}) => {
  const t0 = tickets.find((x) => x.id === id)
  patchTicket(id, { assignee: engineer.name, assigneeEmail: engineer.email, team: engineer.team || t0?.team }, 'assign', `Assigned to ${engineer.name}`)
  pushNotification({ type: 'assignment', title: 'Ticket assigned', body: `${t0?.ref} assigned to ${engineer.name}.`, ref: t0?.ref })
  if (notify && engineer.email) {
    const { subject, body } = assignmentEmail({ ...t0, assignee: engineer.name }, engineer.name)
    openMail({ to: engineer.email, subject, body })         // opens the mail client
    addToast({ type: 'success', title: 'Assigned & notified', message: `Email drafted to ${engineer.name}.` })
  } else {
    addToast({ type: 'success', title: 'Assigned', message: `Assigned to ${engineer.name}.` })
  }
}, [tickets, patchTicket, pushNotification, addToast])
```

Persistence uses SESAP-scoped keys (`sesap_tickets`, `sesap_theme`, `sesap_notifications`,
`sesap_session`) so it does not collide with the old v1.x keys.

---

## 9. UI Components & Pages (documented)

Full source for every file below lives in the repo; here is what each does, its props,
and its notable logic — enough to review behaviour without re-reading each file.

### Layout
- **`layouts/Workspace.jsx`** — the authenticated shell. Holds local `copilotOpen`
  state, renders `<Sidebar/>`, `<TopNav onOpenCopilot/>`, the routed page via a `Router`
  function (six queue views share `<TicketQueue preset=…/>`), plus overlays:
  `<TicketWorkspace/>` (when `openTicket`), the copilot FAB + `<AICopilot/>`.
- **`components/layout/Sidebar.jsx`** — 16-item collapsible nav grouped into Operations /
  Priority / Insight / System. Computes live counts (all, assigned-to-me, high, overdue,
  escalated, unread) from the store. `collapsed` toggles width via CSS transition.
- **`components/layout/TopNav.jsx`** — global search (dropdown using `keywordSearch`,
  opens a ticket on click), notification bell with unread badge + dropdown panel, theme
  toggle, help/copilot buttons, and a user menu with sign-out. Closes popovers on
  outside-click.

### Shared UI
- **`components/ui/primitives.jsx`** — `StatusBadge`, `PriorityBadge`, `RiskBadge`
  (classname-driven colours), `Avatar` (initials), `AnimatedNumber` (requestAnimationFrame
  easeOutCubic count-up), `Skeleton`, `ProgressRing` (SVG gauge).
- **`components/ui/Charts.jsx`** — dependency-free SVG charts: `Donut` (arc segments from
  `donutSegments`), `LineChart` (multi-series area/line with gridlines), `Sparkline`,
  `BarList` (horizontal proportional bars), `ChartLegend`.
- **`components/ui/ToastStack.jsx`** — renders `toasts` from the store; click to dismiss.

### Pages
- **`Landing.jsx`** — hero with gradient + floating system-health card, six feature
  modules, announcements strip, version footer. Any CTA calls `setEntered(true)`.
- **`Login.jsx`** — split-screen; brand/illustration side + glass form with remember-me,
  forgot-password placeholder, security notice, spinner, and the redacted demo hint.
- **`Dashboard.jsx`** — 10 KPI cards (`AnimatedNumber` + `Sparkline`), created-vs-resolved
  `LineChart`, status `Donut`, Executive Progress Centre (`BarList` + progress bars),
  agent leaderboard, recent-activity feed, SLA-breach countdowns, executive insights.
  All metrics `useMemo`-derived from `tickets`.
- **`TicketQueue.jsx`** — enterprise table driven by a `preset` prop
  (`queue|my|assigned|high|overdue|escalations`). Search, status/priority/department
  filters, click-to-sort headers, column-visibility toggles, row selection, inline status
  edit, and a sticky bulk bar (status, assign, escalate, export, delete). Row click opens
  the workspace.
- **`CreateTicket.jsx`** — full classification form (category→sub-category dependency,
  department, channel, service, risk, tags) + assignee picker + a "email the assignee on
  creation" checkbox. Submits via `createTicket(data, { notifyAssignee })`.
- **`components/TicketWorkspace.jsx`** — the tabbed slide-over. Tabs: **Overview** (every
  property editable via store patches), **Activity**, **Internal Notes** (composer +
  filtered comments), **Attachments** (upload/drag-drop/remove/download), **Related**
  (same category/service), **Audit Trail**, **Approvals**, **Automation Logs**,
  **Communication**. Action bar: Assign/Reassign, Escalate, Resolve, Close, Reopen, Email
  User (`openMail`), Notify Team, Clone (`createTicket`), Print/PDF (`printTicket`),
  Delete. Esc / click-outside close.
- **`Reports.jsx`** — volume line chart + status/priority donuts + channel & department
  `BarList`s + dataset export.
- **`AutomationHealth.jsx`** — fleet KPIs, `ProgressRing` for overall health, per-robot
  cards with success-rate bars and status tags.
- **`KnowledgeCentre.jsx`** — searchable, type-filtered KB cards (FAQ/SOP/Runbook/Known
  Error).
- **`NotificationsPage.jsx`** — notifications grouped by type into cards.
- **`AuditTrail.jsx`** — global, type-filterable activity table flattened from every
  ticket's `activity`.
- **`CopilotPage.jsx`** — full-page copilot chat + a capabilities panel.
- **`AICopilot.jsx`** — the floating copilot panel (same engine, compact UI).
- **`Settings.jsx`** — profile card, dark-theme toggle, notification-preference toggles,
  about/version, and a **Reset demo data** action (clears SESAP localStorage keys).
- **`HelpCentre.jsx`** — getting-started steps, FAQ accordion, quick links.

### `src/index.css`
The entire design system in one file (~900 lines): banking-blue token palette with
light + dark theme blocks, buttons/badges/avatars/cards, the app shell (sidebar + top
nav), KPI/chart/leaderboard/progress styling, data table, ticket workspace, forms,
landing, split-login, notifications, knowledge, automation, copilot, toasts, skeletons,
keyframe animations (`fadeUp`, `slideInRight`, `popIn`, `shimmer`, `floaty`, `spin`), and
responsive breakpoints at 1200 / 860px. No secrets; styling only.

---

## 10. Feature → Code Map

| Requested feature | Where it lives |
|---|---|
| Role-based login (Staff vs Customer) | `auth.js` (`accessLevel`, `isStaff/isCustomer`) + `pages/Login.jsx` toggle + `App.jsx` routing |
| Customer interface | `layouts/CustomerPortal.jsx` (Home / My Requests / Raise / ticket view) |
| Create a ticket | `pages/CreateTicket.jsx` (staff) & `RaiseRequest` (customer) → `createTicket()` |
| Assign to someone | assignee picker (Create + Workspace) → `assignTicket()` |
| Email on input of their mail | `openMail()` + `assignmentEmail()` (`utils.js`), triggered by `assignTicket`/`createTicket` |
| Landing page | `pages/Landing.jsx` |
| Premium login | `pages/Login.jsx` + `.login-split` CSS |
| Sidebar + top nav | `components/layout/*` |
| Executive dashboard + charts | `pages/Dashboard.jsx` + `components/ui/Charts.jsx` |
| Enterprise ticket table + bulk | `pages/TicketQueue.jsx` |
| Tabbed ticket workspace + actions | `components/TicketWorkspace.jsx` |
| Executive Progress Centre | `Dashboard.jsx` (progress bars + BarList) |
| AI Copilot | `copilot.js` + `AICopilot.jsx` + `CopilotPage.jsx` |
| Knowledge Centre | `pages/KnowledgeCentre.jsx` + `knowledgeArticles` |
| Notifications | `AppContext` notifications + `TopNav` panel + `NotificationsPage` |
| Automation monitoring | `pages/AutomationHealth.jsx` + `automations` |
| Micro-interactions | `AnimatedNumber`, `ToastStack`, CSS keyframes |
| Source data → real backend (future) | documented in `copilot.js`, `Settings.jsx`, and §13 |

---

## 11. Security & Redactions

**Redacted in this document only** (the app files are unchanged):

| Location | What | Replaced with |
|---|---|---|
| `src/auth.js` → `USERS` | The three demo passwords (admin, agent, customer) | `‹REDACTED›` |
| `src/pages/Login.jsx` | On-screen demo-credential hints (staff + customer) | `‹REDACTED›` |

**Posture — read before evaluating:**
1. **Login is not real authentication.** Credentials are compared in the browser against
   a hard-coded list; anyone with dev-tools can read or bypass it. Demo/light barrier only.
2. **Never put secrets of value in this frontend.** Any real key/token/password shipped in
   `src/**` reaches every visitor. Engineer emails in `data.js` are placeholders.
3. **Real access control** should use UiPath app/folder permissions (the Coded App already
   sits behind UiPath sign-in) and/or a backend that verifies credentials and issues tokens.
4. **Email is client-side** (`mailto:`), so nothing is sent server-side and no mail
   credentials exist in the app.

---

## 12. Build & Deployment

```bash
npm install
npm run dev         # http://localhost:5173
npm run build       # → dist/  (57 modules, ~76 kB gzip JS)
npm run preview
```

**UiPath Coded Web App (this app is live):**
```bash
npm run build
uip codedapp pack ./dist --name "Support Dashboard Damilare" --version "2.1.0" \
    --content-type webapp --main-file index.html
uip codedapp publish --name "supportdashboarddamilare" --version "2.1.0" --type Web
uip codedapp deploy  --name "Support Dashboard Damilare" --folder-key "<UipathWorkshop key>"
#   ^ upgrades in place; OMIT --path-name on upgrades to keep the same URL/routing.
```
- **Live URL:** `https://stanbvosiacv.uipath.host/support-dashboard-damilare`
- **Org / tenant / folder:** `stanbvosiacv` / DefaultTenant / Shared › UipathWorkshop
- **Deploy version:** 4 (package v2.1.0)
- The in-app branding is **SESAP**; the UiPath deployment name stays "Support Dashboard
  Damilare" so the URL is preserved across upgrades.
- `vite.config.js` sets `base: './'` so assets resolve under the UiPath sub-path.

---

## 13. Known Limitations & Reviewer Notes

**Deliberate limitations (no backend yet):**
- **Auth is client-side only** — not a security boundary (see §11).
- **Attachments are session-only** — file bytes live as in-memory object URLs; only
  metadata persists, so files aren't downloadable after reload.
- **Email is `mailto:`** — opens the user's mail client; it does not send automatically.
  Server-sent email (or a UiPath email activity) arrives with the backend.
- **Data is per-browser** (`localStorage`), not shared across users/devices. "Reset demo
  data" in Settings clears it.
- **Charts, robots, announcements, volume trend, CSAT/avg-resolution KPIs** use seeded/
  representative data; wire them to real telemetry with the backend.
- **"Excel" export** is an HTML-table `.xls` (opens in Excel/Numbers/LibreOffice), not a
  native `.xlsx`.

**The path to "source data + real backend database" (next milestone):**
1. Stand up an API (tickets, users, notifications, KB, automation telemetry).
2. Replace `loadTickets()/persist` in `AppContext` with API calls (React Query or fetch);
   keep the same action names so components don't change.
3. Move auth to the backend / corporate SSO (Azure AD, UiPath identity); drop `auth.js`.
4. Send assignment email server-side; keep `mailto:` as a manual fallback.
5. Store attachments in object storage; return durable URLs.
6. Point `copilot.js` at the Claude API from a backend endpoint for open-ended answers,
   keeping the offline engine as a fallback.

**Reviewer notes:**
- **State** is a single Context store — clean at this size. If it grows, split into
  feature slices or adopt a store library; memoise selectors to avoid broad re-renders.
- **No automated tests.** The pure modules (`utils.js`, `copilot.js`, `auth.js`) are the
  highest-value first targets and have no React/DOM dependencies.
- **Accessibility**: aria-labels, semantic landmarks, and focus styles are present; a full
  audit (focus trapping in the workspace/copilot, keyboard operation of the queue) is a
  sensible next step.
- **Charts** are hand-rolled SVG (zero dependencies) — swap for a library only if you need
  richer interactivity.

---

*End of document. Reflects SESAP v2.1.0. Regenerate after significant changes so it stays
authoritative.*
