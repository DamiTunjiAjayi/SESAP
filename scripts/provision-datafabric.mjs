/**
 * Provision the SESAP "Ticket" entity in UiPath Data Fabric (Data Service)
 * using the official UiPath TypeScript SDK.
 *
 * Docs: https://uipath.github.io/uipath-typescript/api/interfaces/entity/
 *
 * Auth: pass a bearer token (the `uip` CLI can mint one — see npm script below).
 * Never hard-code the token; it is read from the environment.
 *
 * Usage:
 *   UIPATH_TOKEN=<token> UIPATH_BASE_URL=https://cloud.uipath.com \
 *   UIPATH_ORG=<org> UIPATH_TENANT=<tenant> node scripts/provision-datafabric.mjs
 */
import { UiPath } from '@uipath/uipath-typescript/core'
import { Entities, EntityFieldDataType as T } from '@uipath/uipath-typescript/entities'

const {
  UIPATH_TOKEN,
  UIPATH_BASE_URL = 'https://cloud.uipath.com',
  UIPATH_ORG,
  UIPATH_TENANT,
} = process.env

if (!UIPATH_TOKEN || !UIPATH_ORG || !UIPATH_TENANT) {
  console.error('Missing UIPATH_TOKEN / UIPATH_ORG / UIPATH_TENANT env vars.')
  process.exit(1)
}

const ENTITY_NAME = 'Ticket'

// Field schema — mirrors the SESAP ticket model.
// AssignedTo is left empty and AssignmentStatus defaults to "Unassigned":
// that is how a newly submitted ticket is marked unassigned in Data Fabric.
const FIELDS = [
  { fieldName: 'Ref', displayName: 'Reference', type: T.STRING, lengthLimit: 50, isRequired: true, isUnique: true, description: 'SESAP ticket reference, e.g. SESAP-1053' },
  { fieldName: 'Subject', displayName: 'Subject', type: T.STRING, lengthLimit: 400, isRequired: true },
  { fieldName: 'Description', displayName: 'Description', type: T.MULTILINE_TEXT, lengthLimit: 4000 },
  { fieldName: 'Requester', displayName: 'Requester', type: T.STRING, lengthLimit: 200 },
  { fieldName: 'RequesterEmail', displayName: 'Requester Email', type: T.STRING, lengthLimit: 200 },
  { fieldName: 'Category', displayName: 'Category', type: T.STRING, lengthLimit: 100 },
  { fieldName: 'SubCategory', displayName: 'Sub-category', type: T.STRING, lengthLimit: 100 },
  { fieldName: 'Department', displayName: 'Department', type: T.STRING, lengthLimit: 100 },
  { fieldName: 'Channel', displayName: 'Source Channel', type: T.STRING, lengthLimit: 50 },
  { fieldName: 'Team', displayName: 'Assigned Team', type: T.STRING, lengthLimit: 100 },
  { fieldName: 'BusinessService', displayName: 'Business Service', type: T.STRING, lengthLimit: 100 },
  { fieldName: 'RiskLevel', displayName: 'Risk Level', type: T.STRING, lengthLimit: 20 },
  { fieldName: 'Priority', displayName: 'Priority', type: T.STRING, lengthLimit: 20, defaultValue: 'medium' },
  { fieldName: 'Status', displayName: 'Status', type: T.STRING, lengthLimit: 20, defaultValue: 'open' },
  { fieldName: 'AssignedTo', displayName: 'Assigned To', type: T.STRING, lengthLimit: 200, description: 'Empty until triaged' },
  { fieldName: 'AssignmentStatus', displayName: 'Assignment Status', type: T.STRING, lengthLimit: 20, defaultValue: 'Unassigned' },
  { fieldName: 'Tags', displayName: 'Tags', type: T.STRING, lengthLimit: 400 },
  { fieldName: 'Source', displayName: 'Source System', type: T.STRING, lengthLimit: 50, defaultValue: 'SESAP' },
  { fieldName: 'CreatedAt', displayName: 'Created At', type: T.DATETIME },
]

const sdk = new UiPath({
  baseUrl: UIPATH_BASE_URL,
  orgName: UIPATH_ORG,
  tenantName: UIPATH_TENANT,
  secret: UIPATH_TOKEN,
})

const entities = new Entities(sdk)

try {
  const all = await entities.getAll()
  console.log(`Existing entities: ${all.length}`)
  const existing = all.find((e) => e.name === ENTITY_NAME)

  if (existing) {
    console.log(`ENTITY_EXISTS name=${existing.name} id=${existing.id}`)
    process.exit(0)
  }

  const id = await entities.create(ENTITY_NAME, FIELDS, {
    displayName: 'Support Ticket',
    description: 'SESAP support tickets. New submissions land unassigned for triage.',
  })
  console.log(`ENTITY_CREATED name=${ENTITY_NAME} id=${id}`)
} catch (err) {
  console.error('FAILED:', err?.message || err)
  if (err?.response) console.error('detail:', JSON.stringify(err.response).slice(0, 600))
  process.exit(2)
}
