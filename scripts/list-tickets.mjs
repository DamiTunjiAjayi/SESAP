/**
 * List records currently in the Data Fabric "Ticket" entity.
 * Usage: UIPATH_TOKEN=… UIPATH_ORG=… UIPATH_TENANT=… node scripts/list-tickets.mjs
 */
import { UiPath } from '@uipath/uipath-typescript/core'
import { Entities } from '@uipath/uipath-typescript/entities'

const { UIPATH_TOKEN, UIPATH_BASE_URL = 'https://cloud.uipath.com', UIPATH_ORG, UIPATH_TENANT } = process.env
if (!UIPATH_TOKEN || !UIPATH_ORG || !UIPATH_TENANT) { console.error('Missing env'); process.exit(1) }

const sdk = new UiPath({ baseUrl: UIPATH_BASE_URL, orgName: UIPATH_ORG, tenantName: UIPATH_TENANT, secret: UIPATH_TOKEN })
const entities = new Entities(sdk)
const entity = (await entities.getAll()).find((e) => e.name === 'Ticket')
if (!entity) { console.error('Ticket entity not found'); process.exit(2) }

const res = await entity.getAllRecords()
const items = res?.items ?? res ?? []
console.log(`COUNT=${items.length}`)
for (const r of items) {
  console.log(`  ${r.Ref} | ${r.Status} | ${r.AssignmentStatus} | assignedTo="${r.AssignedTo ?? ''}" | src=${r.Source} | ${r.Subject}`)
}
