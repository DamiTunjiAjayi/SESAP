// -----------------------------------------------------------------------------
// Client-side login gate for SESAP, with role-based access.
//
// IMPORTANT: FRONTEND-ONLY. No server verifies these credentials — this is a
// demo / light access barrier, NOT real security. Anyone with dev-tools can read
// or bypass it. For real auth, verify on a backend or federate with the corporate
// identity provider (Azure AD / UiPath SSO), where roles would come from claims.
//
// accessLevel drives which interface a user sees after sign-in — three distinct
// experiences (per the challenge: agent vs supervisor vs customer):
//   'supervisor'  → Supervisor Command Centre (team KPIs, approvals/HITL, all tickets)
//   'agent'       → Agent Workspace (focused on MY assigned queue)
//   'user'        → Customer Portal (raise & track your own requests)
// -----------------------------------------------------------------------------

import { ENGINEERS } from './data.js'

const SHARED_PASSWORD = 'sesap2026'

export const USERS = [
  // ---- Supervisor (full command centre + approvals/HITL) ----
  {
    username: 'admin',
    password: SHARED_PASSWORD,
    name: 'Damilare Tunji-Ajayi',
    role: 'Support Supervisor',
    email: 'damilare.tunji-ajayi@stanbicibtc.com',
    initials: 'DT',
    accessLevel: 'supervisor',
  },
  // ---- Agents: EVERY engineer onboarded in the app gets a login (username =
  //      first name, lower-case). Their email matches ENGINEERS so tickets the
  //      robot assigns to them show up under "Assigned To Me". ----
  ...ENGINEERS.map((e) => ({
    username: e.name.split(' ')[0].toLowerCase(),
    password: SHARED_PASSWORD,
    name: e.name,
    role: `Support Agent — ${e.team}`,
    email: e.email,
    initials: e.initials,
    accessLevel: 'agent',
  })),
  // ---- Customer / end-user demo account. Email matches seeded requester
  //      tickets so "My Requests" is populated on first sign-in. ----
  {
    username: 'user',
    password: SHARED_PASSWORD,
    name: 'Aisha Bello',
    role: 'Customer',
    email: 'aisha.bello@example.com',
    initials: 'AB',
    accessLevel: 'user',
  },
]

const SESSION_KEY = 'sesap_session'

// Idle timeout: an active user stays signed in (and survives reloads); after
// this much inactivity the session is dropped and the app returns to the
// landing page the next time it is opened / interacted with.
export const IDLE_LIMIT_MS = 7 * 60 * 1000 // 7 minutes

export const isSupervisor = (u) => u?.accessLevel === 'supervisor' || u?.accessLevel === 'admin'
export const isAgent = (u) => u?.accessLevel === 'agent'
export const isStaff = (u) => isSupervisor(u) || isAgent(u)
export const isCustomer = (u) => u?.accessLevel === 'user'
export const roleLabel = (u) => (isSupervisor(u) ? 'Supervisor' : isAgent(u) ? 'Agent' : 'Customer')

export function validateLogin(username, password) {
  const u = (username || '').trim().toLowerCase()
  const match = USERS.find((x) => x.username === u && x.password === password)
  if (!match) return null
  const { password: _pw, ...safe } = match
  return safe
}

// Restore a session ONLY if it is still within the idle window. A session idle
// longer than IDLE_LIMIT_MS is expired (cleared) so the app opens logged-out.
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    const last = new Date(s.lastActivity || s.at || 0).getTime()
    if (!last || Date.now() - last > IDLE_LIMIT_MS) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function saveSession(user) {
  const ts = new Date().toISOString()
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, at: ts, lastActivity: ts }))
}

// Bump the "last active" marker so an active user never times out (throttled by
// the caller to avoid excessive writes).
export function touchSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    const s = JSON.parse(raw)
    s.lastActivity = new Date().toISOString()
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
