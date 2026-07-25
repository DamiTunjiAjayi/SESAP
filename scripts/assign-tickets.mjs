/**
 * SESAP — Auto-Assign robot logic.
 *
 * This is the BRAIN of the "Assign Ticket" RPA workflow, written as plain code so
 * it can be (a) proven against real Data Fabric data today, and (b) ported 1:1
 * into a Studio process or a Maestro BPMN task later.
 *
 * Rule: LEAST-LOAD WITHIN MATCHING TEAM
 *   1. Map the ticket's Category → owning Team.
 *   2. Count each engineer's ACTIVE load (open / in_progress) on that team.
 *   3. Assign to the engineer with the fewest active tickets (ties → first).
 *   4. Write back AssignedTo + AssignmentStatus="Assigned" (+ Team).
 *
 * Usage:
 *   UIPATH_TOKEN=… UIPATH_ORG=… UIPATH_TENANT=… node scripts/assign-tickets.mjs [--dry-run]
 */
import { UiPath } from '@uipath/uipath-typescript/core'
import { Entities } from '@uipath/uipath-typescript/entities'

const DRY = process.argv.includes('--dry-run')
const { UIPATH_TOKEN, UIPATH_BASE_URL = 'https://cloud.uipath.com', UIPATH_ORG, UIPATH_TENANT } = process.env
if (!UIPATH_TOKEN || !UIPATH_ORG || !UIPATH_TENANT) { console.error('Missing env'); process.exit(1) }

// --- Routing rules (single source of truth for the robot) --------------------
const CATEGORY_TEAM = {
  'Payments': 'Payments Operations',
  'Digital Banking': 'Tier 2 Support',
  'Accounts': 'Tier 1 Support',
  'Lending': 'Tier 1 Support',
  'Automation / RPA': 'Automation Team',
  'Infrastructure': 'Infrastructure',
}
const DEFAULT_TEAM = 'Tier 1 Support'

const ENGINEERS = [
  { name: 'Kunle Adeyemi', email: 'kunle.adeyemi@stanbicibtc.com', team: 'Tier 2 Support' },
  { name: 'Ngozi Eze', email: 'ngozi.eze@stanbicibtc.com', team: 'Payments Operations' },
  { name: 'Tobi Martins', email: 'tobi.martins@stanbicibtc.com', team: 'Tier 1 Support' },
  { name: 'Chidi Okonkwo', email: 'chidi.okonkwo@stanbicibtc.com', team: 'Automation Team' },
  { name: 'Fatima Sani', email: 'fatima.sani@stanbicibtc.com', team: 'Infrastructure' },
  { name: 'Emeka Obi', email: 'emeka.obi@stanbicibtc.com', team: 'Tier 2 Support' },
]

const isActive = (r) => r.Status === 'open' || r.Status === 'in_progress'

// --- Connect ----------------------------------------------------------------
const sdk = new UiPath({ baseUrl: UIPATH_BASE_URL, orgName: UIPATH_ORG, tenantName: UIPATH_TENANT, secret: UIPATH_TOKEN })
const entities = new Entities(sdk)
const entity = (await entities.getAll()).find((e) => e.name === 'Ticket')
if (!entity) { console.error('Ticket entity not found'); process.exit(2) }

const res = await entity.getAllRecords()
const records = res?.items ?? res ?? []

// --- 2. Current active load per engineer ------------------------------------
const load = Object.fromEntries(ENGINEERS.map((e) => [e.name, 0]))
for (const r of records) {
  if (r.AssignedTo && isActive(r) && load[r.AssignedTo] !== undefined) load[r.AssignedTo]++
}

// --- 4. Queue of unassigned work --------------------------------------------
const unassigned = records.filter((r) => isActive(r) && (r.AssignmentStatus === 'Unassigned' || !r.AssignedTo))

console.log(`Entity: Ticket (${entity.id})`)
console.log(`Records: ${records.length} · Unassigned & active: ${unassigned.length}`)
console.log('Current load:', Object.entries(load).map(([n, c]) => `${n.split(' ')[0]}=${c}`).join(' '))
if (!unassigned.length) { console.log('Nothing to assign. ✔'); process.exit(0) }

let assigned = 0
for (const t of unassigned) {
  const team = CATEGORY_TEAM[t.Category] || DEFAULT_TEAM
  const pool = ENGINEERS.filter((e) => e.team === team)
  const candidates = pool.length ? pool : ENGINEERS
  // 3. least-loaded on that team (ties → first)
  const pick = [...candidates].sort((a, b) => load[a.name] - load[b.name])[0]

  console.log(`\n${t.Ref} "${t.Subject}"`)
  console.log(`  Category: ${t.Category || '(none)'} → Team: ${team}`)
  console.log(`  Candidates: ${candidates.map((c) => `${c.name.split(' ')[0]}(${load[c.name]})`).join(', ')}`)
  console.log(`  → ASSIGN TO: ${pick.name} <${pick.email}>`)

  if (!DRY) {
    await entities.updateRecordById(entity.id, t.Id, {
      AssignedTo: pick.name,
      AssignmentStatus: 'Assigned',
      Team: team,
    })
    console.log('  ✔ written to Data Fabric')
  }
  load[pick.name]++   // keep balance within this run
  assigned++
}

console.log(`\n${DRY ? '[DRY RUN] would assign' : 'Assigned'} ${assigned} ticket(s).`)
console.log('Final load:', Object.entries(load).map(([n, c]) => `${n.split(' ')[0]}=${c}`).join(' '))
