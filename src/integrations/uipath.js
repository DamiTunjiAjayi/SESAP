// =============================================================================
// SESAP → UiPath integration (client side).
//
// On ticket submission we push a work item to the Orchestrator queue
// "SESAP_NewTickets". A Queue Trigger then runs the RPA process, which writes the
// ticket to UiPath Data Fabric (Data Service) with an UNASSIGNED status.
//
// WHY A PROXY: a browser cannot call Orchestrator directly (CORS + it must never
// hold the OAuth client secret). So this module POSTs the queue item to a small
// backend proxy you control, which authenticates to UiPath and calls
// "Queues/UiPathODataSvc.AddQueueItem". Configure the proxy URL via either:
//   • build-time env:  VITE_SESAP_QUEUE_ENDPOINT
//   • runtime:         localStorage.setItem('sesap_queue_endpoint', '<url>')
// If neither is set, enqueue runs in SIMULATION mode (logs the exact payload,
// never throws) so the app keeps working before the backend exists.
//
// See UIPATH_INTEGRATION.md for the proxy contract and full setup.
// =============================================================================

export const QUEUE_NAME = 'SESAP_NewTickets'

export function getQueueEndpoint() {
  const env = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SESAP_QUEUE_ENDPOINT
  let ls = null
  try { ls = localStorage.getItem('sesap_queue_endpoint') } catch { /* ignore */ }
  return env || ls || null
}

export const isQueueConfigured = () => !!getQueueEndpoint()

// Build the Orchestrator "itemData" body. SpecificContent must be flat primitives.
export function buildQueueItem(ticket) {
  return {
    Name: QUEUE_NAME,
    Priority: ticket.priority === 'urgent' ? 'High' : ticket.priority === 'high' ? 'High' : 'Normal',
    Reference: ticket.ref, // queue enforces unique reference
    SpecificContent: {
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
      // The whole point: new tickets land UNASSIGNED for triage.
      Assignee: '',
      AssignmentStatus: 'Unassigned',
      Tags: (ticket.tags || []).join(','),
      CreatedAt: ticket.createdAt || new Date().toISOString(),
      Source: 'SESAP',
    },
  }
}

// Best-effort enqueue. Never throws. Returns a small result object the caller
// can use to show a toast/notification.
export async function enqueueNewTicket(ticket) {
  const item = buildQueueItem(ticket)
  const endpoint = getQueueEndpoint()

  if (!endpoint) {
    // Simulation mode — no backend proxy configured yet.
    console.info('[SESAP→UiPath] (simulated) AddQueueItem to', QUEUE_NAME, item)
    return { ok: true, simulated: true, configured: false, item }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemData: item }),
    })
    if (!res.ok) return { ok: false, configured: true, error: `Proxy returned ${res.status}`, item }
    return { ok: true, configured: true, item }
  } catch (e) {
    return { ok: false, configured: true, error: e?.message || 'Network error', item }
  }
}
