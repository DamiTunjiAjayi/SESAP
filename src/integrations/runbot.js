// =============================================================================
// SESAP → start the Maestro orchestration from the app UI (the "click → run the
// flow" link, done the UiPath-native, tested-and-proven way).
//
// When a ticket is submitted, the Coded App writes it to Data Fabric (Unassigned)
// and then calls this to START the Maestro "TicketLifecycle" process. Maestro
// classifies/routes the ticket, then invokes the RPA robot (Orchestrator.StartJob)
// which writes the assignment back to Data Fabric — closing the loop the app then
// reflects.
//
// Mechanism: the official UiPath TypeScript SDK ProcessService.start(), which maps
// to Orchestrator StartJobs. Because SESAP is a Coded Web App, `new UiPath()` +
// initialize() picks up the platform auth context (same pattern as datafabric.js).
//
// SCOPES: starting a process needs Orchestrator execution scope in ADDITION to the
// Data Fabric scopes. Grant OR.Execution (and OR.Folders.Read) under *User scopes*
// on the "SESAP Coded App" External Application FIRST, then the app requests them
// via the uipath:scope meta tag (uipath.json). Until then, this fails gracefully
// and ticket creation still succeeds.
//
// Targets the Maestro TicketLifecycle release in the Shared/SESAP-Live folder.
// =============================================================================

// TicketLifecycle (ProcessOrchestration / Maestro) release — verified startable.
const DEFAULT_PROCESS_KEY = 'fedfe5d6-49f8-4cab-9503-d11f2d8ddb81'
const DEFAULT_FOLDER_KEY = 'c034c633-bf82-47ba-9e35-8955ea38d2b0' // Shared/SESAP-Live

function cfg(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    if (v) return v
  } catch { /* ignore */ }
  const env = typeof import.meta !== 'undefined' && import.meta.env
  if (env && env[`VITE_${key.toUpperCase()}`]) return env[`VITE_${key.toUpperCase()}`]
  return fallback
}

// ---------------------------------------------------------------------------
// Robot-Unit conservation. Every processes.start() below consumes Robot Units.
// "Live automation" is OFF by default so background ticket actions don't burn
// units; turn it on (Settings) for a live demo. The manual "Start Orchestration"
// button passes { force:true } so it always runs regardless of the toggle.
// ---------------------------------------------------------------------------
export function automationEnabled() {
  try { return localStorage.getItem('sesap_automation') === 'on' } catch { return false }
}
export function setAutomationEnabled(on) {
  try { localStorage.setItem('sesap_automation', on ? 'on' : 'off') } catch { /* ignore */ }
}

let _processes = null

async function getProcesses() {
  if (_processes) return _processes
  const [{ UiPath }, { Processes }] = await Promise.all([
    import('@uipath/uipath-typescript/core'),
    import('@uipath/uipath-typescript/processes'),
  ])
  const sdk = new UiPath() // Coded App: platform-injected auth
  await sdk.initialize()
  _processes = new Processes(sdk)
  return _processes
}

/**
 * Start the SESAP Maestro orchestration (TicketLifecycle) for a lifecycle action.
 *   action: 'submit' (intake→triage→route→assign→robot) | 'resolve' | 'close' | 'escalate'
 * The action drives the Maestro's "Action?" gateway to the matching branch, and the
 * ticket context (Ref/Subject/Category/RiskLevel/Priority/ActorRole) is passed so the
 * BPMN operates on the real ticket (e.g. RiskLevel="High" → Manual Assignment).
 * Returns { ok, jobKey, state } or { ok:false, error }. Never throws.
 */
export async function startOrchestration({ force = false, action = 'submit', ticket = null } = {}) {
  // Skip automatic runs when Live automation is off — conserves Robot Units.
  if (!force && !automationEnabled()) return { ok: false, disabled: true, reason: 'Live automation is off (conserving Robot Units).' }
  const processKey = cfg('sesap_process_key', DEFAULT_PROCESS_KEY)
  const folderKey = cfg('sesap_folder_key', DEFAULT_FOLDER_KEY)
  const inputArguments = JSON.stringify({
    Action: action,
    Ref: ticket?.ref || '',
    ActorRole: ticket?.actorRole || 'customer',
    Subject: ticket?.subject || '',
    Category: ticket?.category || '',
    RiskLevel: ticket?.riskLevel || 'Low',
    Priority: ticket?.priority || '',
  })
  try {
    const processes = await getProcesses()
    const res = await processes.start(
      { processKey, inputArguments },
      { folderKey, jobsCount: 1 },
    )
    const job = Array.isArray(res) ? res[0] : res
    return { ok: true, jobKey: job?.jobKey ?? null, state: job?.state ?? 'Pending' }
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not start the orchestration (grant OR.Execution on the External App).' }
  }
}

// Backward-compatible alias — existing callers keep working.
export const runAutoAssignBot = startOrchestration

// SESAP.process.TicketAutomation release (Shared/SESAP-Live). With no args it
// batch auto-assigns; with in_Stage it sends the matching lifecycle email.
const RPA_PROCESS_KEY = '38e6499b-5d0e-48bf-8456-65b37d6689b6'

/**
 * Fire a lifecycle notification email via the RPA (args-driven mode).
 * stage: 'created' | 'escalated' | 'resolved' | 'closed'. Never throws.
 */
export async function startLifecycleEmail(stage, ticket = {}) {
  // Lifecycle emails are RPA jobs — skip them when Live automation is off.
  if (!automationEnabled()) return { ok: false, disabled: true, reason: 'Live automation is off (conserving Robot Units).' }
  const folderKey = cfg('sesap_folder_key', DEFAULT_FOLDER_KEY)
  const inputArguments = JSON.stringify({
    in_Stage: stage,
    in_Ref: ticket.ref || '',
    in_Subject: ticket.subject || '',
    in_RequesterEmail: ticket.requesterEmail || '',
    in_Assignee: ticket.assignee || '',
    in_Priority: ticket.priority || '',
  })
  try {
    const processes = await getProcesses()
    const res = await processes.start(
      { processKey: RPA_PROCESS_KEY, inputArguments },
      { folderKey, jobsCount: 1 },
    )
    const job = Array.isArray(res) ? res[0] : res
    return { ok: true, jobKey: job?.jobKey ?? null, state: job?.state ?? 'Pending' }
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not send lifecycle email.' }
  }
}
