// =============================================================================
// SESAP → UiPath Data Fabric (Data Service) via the official TypeScript SDK.
//   Docs: https://uipath.github.io/uipath-typescript/api/interfaces/entity/
//
// WHY THIS IS THE PRIMARY PATH:
// SESAP is deployed as a UiPath **Coded Web App**, so `new UiPath()` +
// `initialize()` picks up the platform-injected auth context automatically —
// no client secret, no CORS proxy, no robot required. On submit we insert the
// ticket straight into the "Ticket" entity with AssignmentStatus = "Unassigned".
//
// NOTE: single `insertRecord()` calls DO raise Data Fabric trigger events (batch
// `insertRecords()` does not) — so an RPA process can be attached to a Data
// Fabric trigger and fire on every new ticket.
//
// The SDK is loaded with dynamic import() so it is code-split out of the main
// bundle and a failure here can never break the app. Outside a Coded App (e.g.
// local dev) initialization fails harmlessly and the caller falls back to the
// Orchestrator queue / simulation path.
// =============================================================================

import { engineerByName } from '../data.js'

export const ENTITY_NAME = 'Ticket'

let _state = null // { available, entity, entities }

async function init() {
  if (_state) return _state
  try {
    const [{ UiPath }, { Entities }] = await Promise.all([
      import('@uipath/uipath-typescript/core'),
      import('@uipath/uipath-typescript/entities'),
    ])
    // Coded App: the platform injects baseUrl/org/tenant/token.
    const sdk = new UiPath()
    await sdk.initialize()
    const entities = new Entities(sdk)
    const all = await entities.getAll()
    const entity = all.find((e) => e.name === ENTITY_NAME) || null
    _state = { available: !!entity, entity, entities }
    if (!entity) console.info(`[SESAP] Data Fabric reachable but entity "${ENTITY_NAME}" not found. Run: npm run provision:datafabric`)
  } catch (e) {
    console.info('[SESAP] Data Fabric unavailable (expected outside a Coded App):', e?.message || e)
    _state = { available: false, entity: null, entities: null }
  }
  return _state
}

// Map a SESAP ticket onto the Data Fabric entity record.
export function toEntityRecord(ticket) {
  return {
    Ref: ticket.ref,
    Subject: ticket.subject || '',
    Description: ticket.description || '',
    Requester: ticket.requester || '',
    RequesterEmail: ticket.requesterEmail || '',
    Category: ticket.category || '',
    SubCategory: ticket.subCategory || '',
    Department: ticket.department || '',
    Channel: ticket.channel || 'Portal',
    Team: ticket.team || '',
    BusinessService: ticket.businessService || '',
    RiskLevel: ticket.riskLevel || '',
    Priority: ticket.priority || 'medium',
    Status: ticket.status || 'open',
    // Customer tickets are stored UNASSIGNED (challenge baseline); agent-created
    // tickets may already carry an assignee, and internal requests come in as
    // PendingApproval — honour whatever the ticket specifies.
    AssignedTo: ticket.assignee || '',
    AssignmentStatus: ticket.assignmentStatus || (ticket.assignee ? 'Assigned' : 'Unassigned'),
    Tags: (ticket.tags || []).join(','),
    Source: 'SESAP',
    CreatedAt: ticket.createdAt || new Date().toISOString(),
  }
}

// Map a Data Fabric record back into the app's ticket shape.
// Challenge baseline 4.1: the grid must read LIVE from Data Fabric.
export function fromEntityRecord(r, index = 0) {
  const ref = r.Ref || `SESAP-${1000 + index}`
  const idFromRef = Number(String(ref).replace(/\D/g, '')) || 1000 + index
  return {
    id: idFromRef,
    ref,
    recordId: r.Id,               // Data Fabric primary key — needed for write-back
    subject: r.Subject || '(no subject)',
    description: r.Description || '',
    requester: r.Requester || '',
    requesterEmail: r.RequesterEmail || '',
    status: r.Status || 'open',
    priority: r.Priority || 'medium',
    category: r.Category || '',
    subCategory: r.SubCategory || '',
    department: r.Department || '',
    channel: r.Channel || 'Portal',
    team: r.Team || '',
    assignee: r.AssignedTo || null,
    // Data Fabric stores only the assignee's NAME (AssignedTo). Resolve it back
    // to the engineer's email so "Assigned To Me" (which matches on email) works
    // after a reload from Data Fabric, not just within the session.
    assigneeEmail: engineerByName(r.AssignedTo)?.email || null,
    businessService: r.BusinessService || '',
    riskLevel: r.RiskLevel || 'Low',
    assignmentStatus: r.AssignmentStatus || 'Unassigned',
    approvalStatus: r.AssignmentStatus === 'PendingApproval' ? 'pending' : (r.AssignmentStatus === 'Rejected' ? 'rejected' : ''),
    tags: r.Tags ? String(r.Tags).split(',').filter(Boolean) : [],
    escalated: false,
    createdAt: r.CreatedAt || r.CreateTime || new Date().toISOString(),
    // Map to the Data Service-managed UpdateTime (last modified) — NOT CreatedAt.
    // Using CreatedAt for both made every resolved ticket look like it took 0h,
    // so "Avg Resolution" was always empty. UpdateTime advances when the app/robot
    // writes back (e.g. status → resolved), giving a real resolution time.
    updatedAt: r.UpdateTime || r.UpdatedAt || r.CreatedAt || r.CreateTime || new Date().toISOString(),
    attachments: [],
    activity: [
      { type: 'created', text: `Loaded from Data Fabric (${r.AssignmentStatus || 'Unassigned'})`, author: 'System', at: r.CreatedAt || new Date().toISOString() },
    ],
    source: 'datafabric',
  }
}

/** Read every ticket from Data Fabric. Never throws. */
export async function listTicketsFromDataFabric() {
  const s = await init()
  if (!s.available) return { ok: false, reason: 'unavailable', tickets: [] }
  try {
    const res = await s.entity.getAllRecords()
    const items = res?.items ?? res ?? []
    return { ok: true, tickets: items.map(fromEntityRecord) }
  } catch (e) {
    return { ok: false, error: e?.message || 'getAllRecords failed', tickets: [] }
  }
}

/** Insert a ticket into Data Fabric. Never throws. */
export async function saveTicketToDataFabric(ticket) {
  const s = await init()
  if (!s.available) return { ok: false, reason: 'unavailable' }
  try {
    const res = await s.entity.insertRecord(toEntityRecord(ticket))
    return { ok: true, id: res?.id ?? null }
  } catch (e) {
    return { ok: false, error: e?.message || 'insertRecord failed' }
  }
}

/**
 * Patch a ticket's fields in Data Fabric by record id (status/priority/approval
 * etc.). Persists app-side lifecycle changes so they survive a reload and are
 * shared with the robots. Never throws.
 */
export async function updateTicketInDataFabric(recordId, fields) {
  const s = await init()
  if (!s.available || !recordId) return { ok: false, reason: 'unavailable' }
  try {
    await s.entities.updateRecordById(s.entity.id, recordId, fields)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'updateRecordById failed' }
  }
}
