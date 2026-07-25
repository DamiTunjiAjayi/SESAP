// Orchestrates where a newly submitted ticket goes, in priority order:
//   1. Data Fabric direct insert via the UiPath SDK (Coded App auto-auth) —
//      immediate, no robot, and raises a Data Fabric trigger event.
//   2. Orchestrator queue "SESAP_NewTickets" via the backend proxy — the RPA
//      path (Queue Trigger → robot → Create Entity Record).
//   3. Simulation — logs the payload so local dev/demo keeps working.
// Never throws.
import { saveTicketToDataFabric } from './datafabric.js'
import { enqueueNewTicket } from './uipath.js'

export async function syncNewTicket(ticket) {
  const df = await saveTicketToDataFabric(ticket)
  if (df.ok) return { ok: true, via: 'datafabric', id: df.id }

  const q = await enqueueNewTicket(ticket)
  return {
    ok: q.ok,
    via: q.configured ? 'queue' : 'simulated',
    error: q.error,
    dfReason: df.reason || df.error,
    item: q.item,
  }
}
