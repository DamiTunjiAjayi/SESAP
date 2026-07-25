// =============================================================================
// Live Orchestrator metrics for the dashboard — real robot health from actual
// job outcomes (uses the OR.Jobs scope granted on the External App).
// Never throws; callers fall back to a representative value if unavailable.
// =============================================================================

// Shared/SESAP-Live — where the Maestro process + RPA robot run.
const HEALTH_FOLDER_ID = 8066695

let _jobs = null
async function getJobsSvc() {
  if (_jobs) return _jobs
  const [{ UiPath }, { Jobs }] = await Promise.all([
    import('@uipath/uipath-typescript/core'),
    import('@uipath/uipath-typescript/jobs'),
  ])
  const sdk = new UiPath() // Coded App: platform-injected auth
  await sdk.initialize()
  _jobs = new Jobs(sdk)
  return _jobs
}

/**
 * Robot health % = Successful / (Successful + Faulted + Stopped) over recent jobs.
 * Returns { ok, health, total, successful, faulted, stopped } or { ok:false, error }.
 */
export async function getRobotHealth() {
  try {
    const jobs = await getJobsSvc()
    const res = await jobs.getAll({ folderId: HEALTH_FOLDER_ID, pageSize: 50 })
    const items = Array.isArray(res) ? res : (res?.items ?? res?.value ?? [])
    const s = (j) => String(j.state ?? j.State ?? '').toLowerCase()
    const successful = items.filter((j) => s(j).includes('success')).length
    const faulted = items.filter((j) => s(j).includes('fault')).length
    const stopped = items.filter((j) => s(j).includes('stop')).length
    const finished = successful + faulted + stopped
    return {
      ok: true,
      health: finished ? Math.round((successful / finished) * 100) : null,
      total: items.length, successful, faulted, stopped,
    }
  } catch (e) {
    return { ok: false, error: e?.message || 'Orchestrator job stats unavailable' }
  }
}
