/**
 * End-to-end verification of the SESAP → Data Fabric path.
 * Inserts one test ticket record (marked Unassigned) and reads it back.
 *
 * Usage:
 *   UIPATH_TOKEN=… UIPATH_ORG=… UIPATH_TENANT=… node scripts/verify-datafabric.mjs
 */
import { UiPath } from '@uipath/uipath-typescript/core'
import { Entities } from '@uipath/uipath-typescript/entities'

const { UIPATH_TOKEN, UIPATH_BASE_URL = 'https://cloud.uipath.com', UIPATH_ORG, UIPATH_TENANT } = process.env
if (!UIPATH_TOKEN || !UIPATH_ORG || !UIPATH_TENANT) { console.error('Missing env'); process.exit(1) }

const sdk = new UiPath({ baseUrl: UIPATH_BASE_URL, orgName: UIPATH_ORG, tenantName: UIPATH_TENANT, secret: UIPATH_TOKEN })
const entities = new Entities(sdk)

const all = await entities.getAll()
const entity = all.find((e) => e.name === 'Ticket')
if (!entity) { console.error('Ticket entity not found'); process.exit(2) }
console.log(`Entity: ${entity.name} id=${entity.id}`)

const ref = `SESAP-VERIFY-${Date.now().toString().slice(-6)}`
const record = {
  Ref: ref,
  Subject: 'Verification ticket — SESAP → Data Fabric',
  Description: 'Written by scripts/verify-datafabric.mjs to prove the integration works. Safe to delete.',
  Requester: 'Damilare Tunji-Ajayi',
  RequesterEmail: 'damilaretunjiajayi@gmail.com',
  Category: 'Digital Banking',
  SubCategory: 'Login Issue',
  Department: 'Digital Channels',
  Channel: 'Portal',
  Team: 'Tier 1 Support',
  BusinessService: 'Internet Banking',
  RiskLevel: 'Low',
  Priority: 'medium',
  Status: 'open',
  AssignedTo: '',
  AssignmentStatus: 'Unassigned',
  Tags: 'verification',
  Source: 'SESAP',
  CreatedAt: new Date().toISOString(),
}

console.log(`Inserting ${ref} …`)
const res = await entity.insertRecord(record)
console.log('INSERT_OK id=', res?.id ?? JSON.stringify(res).slice(0, 120))

const back = await entity.getAllRecords()
const items = back?.items ?? back ?? []
console.log(`Records now in entity: ${items.length}`)
const found = items.find((r) => r.Ref === ref)
console.log(found
  ? `READ_BACK_OK Ref=${found.Ref} Status=${found.Status} AssignmentStatus=${found.AssignmentStatus} AssignedTo="${found.AssignedTo ?? ''}"`
  : 'READ_BACK: inserted record not found in listing')
