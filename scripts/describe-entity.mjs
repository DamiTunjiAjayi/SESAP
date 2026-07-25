/**
 * Dump the Data Fabric "Ticket" entity schema (field names + types) for documentation.
 * Usage: UIPATH_TOKEN=… UIPATH_ORG=… UIPATH_TENANT=… node scripts/describe-entity.mjs
 */
import { UiPath } from '@uipath/uipath-typescript/core'
import { Entities } from '@uipath/uipath-typescript/entities'

const { UIPATH_TOKEN, UIPATH_BASE_URL = 'https://cloud.uipath.com', UIPATH_ORG, UIPATH_TENANT } = process.env
const sdk = new UiPath({ baseUrl: UIPATH_BASE_URL, orgName: UIPATH_ORG, tenantName: UIPATH_TENANT, secret: UIPATH_TOKEN })
await sdk.initialize() // required before constructing services, or "Invalid SDK instance"
const entities = new Entities(sdk)
const all = await entities.getAll()
const entity = all.find((e) => e.name === 'Ticket')
if (!entity) { console.error('Ticket entity not found. Entities:', all.map(e => e.name).join(', ')); process.exit(2) }
console.log('ENTITY:', entity.name, '| id:', entity.id || entity.key || '')
console.log('description:', entity.description || '(none)')
const fields = entity.fields || entity.properties || entity.columns || []
console.log('FIELD_COUNT:', Array.isArray(fields) ? fields.length : 'n/a')
if (Array.isArray(fields)) {
  for (const f of fields) {
    const type = f.type || f.dataType || f.fieldType || (f.definition && f.definition.type) || '?'
    const req = f.isRequired ?? f.required ?? ''
    const unique = f.isUnique ?? f.unique ?? ''
    console.log(`  - ${f.name || f.displayName} : ${JSON.stringify(type)}${req ? ' [required]' : ''}${unique ? ' [unique]' : ''}`)
  }
} else {
  // Fallback: print the raw entity keys so we can see the shape
  console.log('RAW ENTITY KEYS:', Object.keys(entity))
  console.log(JSON.stringify(entity, null, 1).slice(0, 1500))
}
