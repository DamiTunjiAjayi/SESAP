# SESAP → UiPath Data Fabric Integration

**Goal:** when a new ticket is submitted in SESAP, store it in **UiPath Data Fabric
(Data Service)** marked **Unassigned**, ready for triage.

Built with the official **UiPath TypeScript SDK** —
<https://uipath.github.io/uipath-typescript/api/interfaces/entity/>

---

## Architecture — two paths, one goal

SESAP is deployed as a **UiPath Coded Web App**, which unlocks the simplest possible
integration: the SDK auto-authenticates from the platform context (**no client secret, no
CORS proxy, no robot**).

```
 PATH 1 — DIRECT (primary, active)
   SESAP createTicket()  ──▶  UiPath SDK  ──▶  Data Fabric entity "Ticket"
   (Coded App auto-auth)      insertRecord()    AssignedTo = ""  AssignmentStatus = "Unassigned"
                                   │
                                   └──▶ raises a Data Fabric TRIGGER EVENT
                                        (attach an RPA process here for downstream automation)

 PATH 2 — RPA QUEUE (fallback / classic RPA, provisioned)
   SESAP ──▶ proxy ──▶ Orchestrator queue "SESAP_NewTickets" ──▶ Queue Trigger ──▶ robot
                                                                  (Create Entity Record)
```

`src/integrations/sync.js` tries **Path 1**, falls back to **Path 2**, and finally to a
safe **simulation** (logs the payload) so local dev and demos never break.

> **Why `insertRecord` and not `insertRecords`:** per the SDK docs, single-record inserts
> raise Data Fabric trigger events; batch inserts do **not**. Single insert keeps the door
> open for event-driven RPA.

---

## Current status — ✅ LIVE & VERIFIED (personal org)

The solution runs end-to-end on the **personal / Community** org. (The corporate org
`stanbvosiacv` is still deployed but its Data Fabric is not enabled — no admin rights.)

| Item | Status |
|---|---|
| **Org / Tenant** | ✅ `stanbgdgzsbd` / **DefaultTenant** (CLI profile: `personal`) |
| **Folder** | ✅ **Shared** (`1c313714-4ed8-41a8-91f2-edfa178a3902`) |
| **App URL** | ✅ **https://stanbgdgzsbd.uipath.host/sesap-support-platform** |
| **Orchestrator queue** | ✅ `SESAP_NewTickets` (`fcfd918b-f310-4633-92a6-2394c0547540`) |
| **Data Fabric** | ✅ enabled, **1 DFU allocated** |
| **`Ticket` entity** | ✅ **created** — id `ca14332a-0081-f111-b338-000d3ab4d3b7` |
| **SDK** | ✅ `@uipath/uipath-typescript` v1.5.4 |
| **External Application** | ✅ `SESAP Coded App` — non-confidential (PKCE), App ID `c4260874-f31d-4859-bc69-3acb06123c68` |
| **OAuth scopes** | ✅ `DataFabric.Schema.Read DataFabric.Data.Read DataFabric.Data.Write` (**User scopes**) |
| **App wiring** | ✅ **v2.5.0** (`datafabric.js` → `uipath.js` → simulate) |
| **🎯 LIVE END-TO-END TEST** | ✅ **PASSED** — ticket `SESAP-1048` created in the live app landed in Data Fabric as `Status=open AssignmentStatus=Unassigned AssignedTo=""` |

### How the Coded App authenticates (the part that took 3 attempts)

`new UiPath()` with no arguments **loads its config from `uipath:*` meta tags** in the HTML
(see `UiPathMetaTags` in the SDK). Those tags are NOT injected by `vite build`, and
`uip codedapp pack` only injects them if `uipath.json` is filled in — ours was empty, so the
SDK silently failed and fell back. Fixes applied:

1. **`uipath.json`** filled with clientId / scope / org / tenant / baseUrl / redirectUri.
2. **`vite.config.js`** now has a `uipath-meta-tags` plugin that injects the six meta tags from
   `uipath.json` at build time — deterministic, single source of truth, independent of the packer.
3. **Scope names:** the docs say `DataService.*` (legacy); the product actually registers
   **`DataFabric.*`**. Requesting `DataService.*` → `invalid_scope`.
   **The External Application UI is authoritative over the docs.**

**Debug tip:** if writes stop working, view-source the live app and confirm the six
`<meta name="uipath:…">` tags are present and correct. Absent/incorrect tags = silent fallback.

> **Lesson learned:** *"Data Fabric setup is still in progress"* really meant **no DFU
> licence was allocated**. Adding the service alone does not create the storage partition —
> allocating at least 1 Data Fabric Unit does. Once allocated, the entity created within ~2 min.

### Corporate org (`stanbvosiacv`) — for reference
| Item | Status |
|---|---|
| App URL | ✅ https://stanbvosiacv.uipath.host/support-dashboard-damilare |
| Queue | ✅ `SESAP_NewTickets` (`a1119ae3-ed88-43a2-9490-ed8649caaf11`), folder UipathWorkshop (`d39f7113-…`) |
| Data Fabric | ❌ not enabled (needs a tenant admin to add the service + allocate DFU) |

## Rebuild on ANY org in one command

```bash
SESAP_ORG=<org> SESAP_PROFILE=<cli-profile> SESAP_FOLDER=Shared ./scripts/setup-uipath.sh
```
`scripts/setup-uipath.sh` does all 7 steps: verify login → resolve folder → create queue →
build → pack → publish → deploy (handles first-deploy vs upgrade) → provision the entity →
print the URL. It is idempotent and safe to re-run.

| Script | Purpose |
|---|---|
| `scripts/setup-uipath.sh` | Full end-to-end environment setup |
| `scripts/provision-datafabric.mjs` | Create the `Ticket` entity (`npm run provision:datafabric`) |
| `scripts/verify-datafabric.mjs` | Insert + read back a test record to prove the path works |

---

## 1. Create the `Ticket` entity (one command, re-runnable)

`scripts/provision-datafabric.mjs` uses the SDK's
`entities.create(name, fields, options)` to build the schema. It is **idempotent** — if the
entity exists it prints the id and exits.

```bash
# Mint a token from the CLI session and provision (single line):
PAYLOAD=$(uip login refresh --output json) && \
TOKEN=$(printf '%s' "$PAYLOAD" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).Data.AccessToken))") && \
UIPATH_TOKEN="$TOKEN" UIPATH_BASE_URL=https://cloud.uipath.com \
UIPATH_ORG=stanbvosiacv UIPATH_TENANT=DefaultTenant \
npm run provision:datafabric
```
Expected: `ENTITY_CREATED name=Ticket id=<uuid>` (or `ENTITY_EXISTS …`).

**If it still says *"Data Fabric setup is still in progress"*:** check
**Admin → Tenant (DefaultTenant) → Services → Data Service** is enabled/green, then retry.
First-time provisioning can take a while; there is nothing to fix in the code.

### Entity schema created by the script

| Field | Type | Notes |
|---|---|---|
| `Ref` | STRING(50) | **required, unique** — e.g. `SESAP-1053` |
| `Subject` | STRING(400) | required |
| `Description` | MULTILINE_TEXT(4000) | |
| `Requester` / `RequesterEmail` | STRING(200) | |
| `Category` / `SubCategory` | STRING(100) | |
| `Department` / `Team` / `BusinessService` | STRING(100) | |
| `Channel` | STRING(50) | Portal / Email / Phone / … |
| `RiskLevel` | STRING(20) | |
| `Priority` | STRING(20) | default `medium` |
| `Status` | STRING(20) | default `open` |
| **`AssignedTo`** | STRING(200) | **empty until triaged** |
| **`AssignmentStatus`** | STRING(20) | **default `Unassigned`** |
| `Tags` | STRING(400) | comma-separated |
| `Source` | STRING(50) | default `SESAP` |
| `CreatedAt` | DATETIME | |

> "Marked as unassigned" is enforced in three places: SESAP creates tickets with no
> assignee, `toEntityRecord()` sets `AssignedTo: ''` + `AssignmentStatus: 'Unassigned'`,
> and the field defaults do the same server-side.

---

## 2. How the app writes to Data Fabric

`src/integrations/datafabric.js`:
```js
const sdk = new UiPath()          // Coded App → platform injects baseUrl/org/tenant/token
await sdk.initialize()
const entities = new Entities(sdk)
const entity = (await entities.getAll()).find(e => e.name === 'Ticket')  // looked up BY NAME
await entity.insertRecord(toEntityRecord(ticket))                        // fires DF trigger
```
- The SDK is loaded via **dynamic `import()`**, so it is code-split out of the main bundle
  and any failure is caught (the app can never break because of it).
- The entity is resolved **by name**, so no id needs hard-coding.
- Outside a Coded App (local dev) `initialize()` fails harmlessly → falls back to Path 2/3.

**Verify after provisioning:** open the live app, create a ticket, then check
*Data Service → Ticket → Records*. You should also see the in-app notification
**"Stored in Data Fabric — Unassigned"**.

---

## 3. Path 2 — the RPA queue route (already provisioned)

Use this if you want a robot in the loop (classic RPA, retries, Orchestrator audit).

**Queue item contract** (built by `buildQueueItem()` in `src/integrations/uipath.js`):
```json
{ "itemData": {
    "Name": "SESAP_NewTickets", "Priority": "Normal", "Reference": "SESAP-1053",
    "SpecificContent": {
      "Ref": "SESAP-1053", "Subject": "…", "Requester": "…", "RequesterEmail": "…",
      "Category": "Payments", "Priority": "medium", "Status": "open",
      "Assignee": "", "AssignmentStatus": "Unassigned", "Source": "SESAP",
      "CreatedAt": "2026-07-16T09:00:00Z"
    } } }
```

**Workflow** — open `uipath/SESAP.NewTicketToDataFabric/` in Studio and assemble:
1. **Get Transaction Item** — `QueueName = "SESAP_NewTickets"` → `TransactionItem`.
2. **Assign** fields from `TransactionItem.SpecificContent("…")`.
3. **Create Entity Record** (Data Service) — Entity = **Ticket**; `AssignedTo` empty,
   `AssignmentStatus = "Unassigned"`.
4. **Set Transaction Status** = Successful.
5. Wrap 1–4 in **Try Catch** → on error Set Transaction Status = Failed (auto-retry).

**Publish + trigger:**
```bash
uip or packages upload --file ./SESAP.NewTicketToDataFabric.1.0.0.nupkg
uip or processes create --folder-key d39f7113-d924-4a14-8d0d-8d309dcf8957 \
    --package-id SESAP.NewTicketToDataFabric --package-version 1.0.0
# then: Orchestrator → UipathWorkshop → Triggers → Add → Queue trigger
#       Queue = SESAP_NewTickets, Process = SESAP.NewTicketToDataFabric, Unattended robot
```

**Proxy** (only needed for Path 2, because a browser can't hold a secret or call
Orchestrator cross-origin). Minimal Node/Express:
```js
app.post('/enqueue', async (req, res) => {
  const t = await getToken()   // client_credentials, scope OR.Queues
  const r = await fetch(`${UIPATH_BASE}/${ORG}/${TENANT}/orchestrator_/odata/Queues/UiPathODataSvc.AddQueueItem`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json',
               'X-UIPATH-OrganizationUnitId': FOLDER_ID },
    body: JSON.stringify(req.body),
  })
  res.status(r.ok ? 200 : 502).json(await r.json())
})
```
Create a **Confidential External App** (scope `OR.Queues`) in *Admin → External
Applications*, then point SESAP at the proxy:
```js
localStorage.setItem('sesap_queue_endpoint', 'https://your-proxy.example.com/enqueue')
// or build-time: VITE_SESAP_QUEUE_ENDPOINT=…
```

---

## 4. Event-driven RPA (recommended next step)

Because Path 1 uses `insertRecord()`, every new ticket raises a **Data Fabric trigger
event**. In Orchestrator you can add a **Data Fabric trigger** on the `Ticket` entity
(on *record created*) and point it at a process — e.g. auto-triage, auto-assign by
category/load, or notify a team. That gives you the RPA workflow **without** the queue,
proxy, or polling.

---

## 5. Security notes

- **No secrets in SESAP.** Path 1 relies on the Coded App's injected identity; Path 2's
  secret lives only in the proxy.
- The provisioning script reads the token from an **env var** — never hard-code it, and
  don't commit tokens. CLI tokens are short-lived (~1h); re-run `uip login refresh`.
- The queue enforces a **unique reference** (`Ref`), and `Ref` is **unique** on the entity,
  so double-submits can't duplicate records.
- Data Fabric entities can be **RBAC-enabled** (`isRbacEnabled`) per entity/field if you
  need to restrict ticket data by role.

---

## 6. File map

| File | Purpose |
|---|---|
| `scripts/provision-datafabric.mjs` | Creates the `Ticket` entity via `entities.create()` |
| `src/integrations/datafabric.js` | SDK init + `insertRecord` (Path 1) |
| `src/integrations/uipath.js` | Queue item builder + proxy enqueue (Path 2) |
| `src/integrations/sync.js` | Chooses Path 1 → 2 → simulate |
| `src/context/AppContext.jsx` | Calls `syncNewTicket()` inside `createTicket()` |
| `uipath/SESAP.NewTicketToDataFabric/` | Studio process (project.json + Main.xaml) |
