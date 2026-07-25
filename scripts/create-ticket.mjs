/**
 * Insert one UNASSIGNED ticket into the Data Fabric "Ticket" entity — mirrors the
 * Coded App's saveTicketToDataFabric() write path. Used to seed the end-to-end
 * orchestration demo (App write -> Maestro -> RPA -> Data Fabric write-back).
 * Usage: UIPATH_TOKEN=… UIPATH_ORG=… UIPATH_TENANT=… node scripts/create-ticket.mjs [subject]
 */
import { UiPath } from '@uipath/uipath-typescript/core'
import { Entities } from '@uipath/uipath-typescript/entities'

const { UIPATH_TOKEN, UIPATH_BASE_URL = 'https://cloud.uipath.com', UIPATH_ORG, UIPATH_TENANT } = process.env
if (!UIPATH_TOKEN || !UIPATH_ORG || !UIPATH_TENANT) { console.error('Missing env'); process.exit(1) }

const sdk = new UiPath({ baseUrl: UIPATH_BASE_URL, orgName: UIPATH_ORG, tenantName: UIPATH_TENANT, secret: UIPATH_TOKEN })
const entities = new Entities(sdk)
const entity = (await entities.getAll()).find((e) => e.name === 'Ticket')
if (!entity) { console.error('Ticket entity not found'); process.exit(2) }

const ref = 'SESAP-E2E-' + Date.now().toString().slice(-6)
const rec = {
  Ref: ref,
  Subject: process.argv[2] || 'E2E loop test — auto-assign via Maestro',
  Description: 'Created to prove App -> Maestro -> RPA -> Data Fabric loop',
  Requester: 'Damilare', RequesterEmail: 'damilare@example.com',
  Category: 'incident', Department: 'Retail', Channel: 'Portal',
  Priority: 'medium', Status: 'open',
  AssignedTo: '', AssignmentStatus: 'Unassigned',
  Source: 'SESAP', CreatedAt: new Date().toISOString(),
}
const res = await entity.insertRecord(rec)
console.log('CREATED ' + ref + ' | id=' + (res?.id ?? JSON.stringify(res).slice(0, 80)))
