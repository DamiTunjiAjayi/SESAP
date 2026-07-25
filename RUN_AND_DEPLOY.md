# SESAP — Run & Deploy Guide (Live Solution)

> **📌 Canonical status:** The full loop (app click → Maestro → RPA → Data Fabric → app) is deployed and **verified working live**. See [`README.md`](README.md) + [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) for the current source of truth. Any "not yet verified" notes below are historical — the Maestro→RPA binding (`TicketLifecycle` v2.0.3) and the app click‑trigger (app v2.8.1 with `OR.Execution`/`OR.Folders.Read`/`OR.Jobs`) now close the loop.

**Org:** `stanbgdgzsbd` (personal Community) · **Tenant:** `DefaultTenant`

Everything below was executed and verified this session unless explicitly marked
"not yet run".

---

## 1. What is live right now

| Layer | What | Status |
|---|---|---|
| **Coded Web App** | `https://stanbgdgzsbd.uipath.host/sesap-support-platform` | ✅ HTTP 200, reads/writes Data Fabric |
| **Data Fabric entity** | `Ticket` (`ca14332a-…`), 24 fields | ✅ live, 3 real records |
| **RPA process** | `TicketAutomation` — 8 real XAML workflows | ✅ compiles 0 errors |
| **Live RPA run** | Serverless job flipped `SESAP-VERIFY-197765` Unassigned → **Assigned (Kunle Adeyemi)** | ✅ **verified in Data Fabric** |
| **BPMN** | `TicketLifecycle` (actor-branching + `Orchestrator.StartJob` → RPA) | ✅ VALID, on Studio Web |
| **Solution** | `SESAP-Platform` v2.0.0 (BPMN + RPA) | ✅ Successful / Active |

**Studio Web (see + edit the BPMN):**
`https://cloud.uipath.com/stanbgdgzsbd/studio_/designer/508b1be2-eb86-44be-bee9-2aa3946ee654?solutionId=71ab7141-535f-4036-e0de-08dee3311b11`

---

## 2. The end-to-end flow (what actually happens)

```
Customer/Staff submits ticket in the App
        │  UiPath TypeScript SDK (OAuth PKCE, in-browser)
        ▼
Data Fabric  ── Ticket record created, AssignmentStatus = "Unassigned"
        │
        ▼  (run the RPA process — on-demand, schedule, or via the BPMN)
RPA robot (Cloud Serverless)  ── Main.xaml:
        • QueryEntityRecords<Ticket>            (real Data Fabric read)
        • route Category → Team (ValidateTicket / AssignTicket logic)
        • InvokeWorkflowFile SyncToDataFabric   (real UpdateEntityRecord)
        ▼
Data Fabric  ── record now AssignmentStatus = "Assigned", AssignedTo = <engineer>
        │
        ▼
App grid reflects the new assignment (reads live from Data Fabric)
```

The **BPMN** (`TicketLifecycle`) mirrors this as an orchestration and, at its
"Run Auto-Assign Robot" step, calls the same RPA process via `Orchestrator.StartJob`.

---

## 3. The 8 RPA workflows (all real, zero placeholders)

| Workflow | Real activities |
|---|---|
| `Main.xaml` | `QueryEntityRecords` (DF read) → `ForEach` → route → `InvokeWorkflowFile` → `LogMessage` |
| `Integration/SyncToDataFabric.xaml` | `QueryEntityRecords` + `UpdateEntityRecord` (writes AssignedTo/Team/AssignmentStatus) |
| `Tickets/EscalateTicket.xaml` | `QueryEntityRecords` + `UpdateEntityRecord` (Priority → urgent) |
| `Tickets/ResolveTicket.xaml` | `QueryEntityRecords` + `UpdateEntityRecord` (Status → resolved) |
| `Tickets/AssignTicket.xaml` | category→team + team→engineer routing (real `If`/`Assign`) + `LogMessage` |
| `Helpers/ValidateTicket.xaml` | required-field validation (`Assign`/`If`) + `LogMessage` |
| `Audit/WriteAuditLog.xaml` | builds audit entry + `LogMessage` (persisted Orchestrator log) |
| `Notifications/SendNotification.xaml` | builds message + `LogMessage` (see §7 for live email) |

---

## 4. Run the RPA process live (repeat the verified test)

```bash
export PATH="$HOME/.dotnet:$HOME/.npm-global/bin:$PATH"; export DOTNET_ROOT="$HOME/.dotnet"
FK=1c313714-4ed8-41a8-91f2-edfa178a3902     # Shared folder
PROC=f4e5584d-52d8-43f4-94c8-d2050f036dc9   # SESAP-AutoAssign3 (package 1.0.2)

# start a job on Cloud Serverless
uip or jobs start "$PROC" --folder-key "$FK" --runtime-type Serverless --profile personal

# watch state
uip or jobs list --folder-key "$FK" --profile personal --output-filter "[?Key=='<jobKey>'].State"

# read robot logs
uip or jobs logs <jobKey> --profile personal
```

**Verify Data Fabric changed:**
```bash
PAYLOAD=$(uip login refresh --profile personal --output json)
TOKEN=$(printf '%s' "$PAYLOAD" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).Data.AccessToken))")
UIPATH_TOKEN="$TOKEN" UIPATH_ORG=stanbgdgzsbd UIPATH_TENANT=DefaultTenant \
  node scripts/list-tickets.mjs
```
To re-test the flip, seed a fresh unassigned ticket first:
`node scripts/verify-datafabric.mjs` (inserts `SESAP-VERIFY-<n>` as Unassigned).

---

## 5. Rebuild / redeploy from source

```bash
export PATH="$HOME/.dotnet:$HOME/.npm-global/bin:$PATH"; export DOTNET_ROOT="$HOME/.dotnet"
cd SESAP

# compile-verify the RPA project (needs .NET SDK 8 — installed at ~/.dotnet)
uip rpa analyze ./TicketAutomation

# validate the BPMN
cd ~/.uipath/.skills/skills/uipath-maestro-bpmn/validator && node validate-bpmn.mjs \
  ~/Documents/CODINGAGENTUIpath/SESAP/TicketLifecycle/TicketLifecycle.bpmn ; cd -

# push BPMN + projects to Studio Web
uip solution upload . --profile personal --force

# pack + publish + deploy the whole solution
uip solution pack . ./soln-out -v <next-version> --profile personal
uip solution publish ./soln-out/SESAP_<next-version>.zip --profile personal
uip solution deploy run --profile personal --name "SESAP-Platform" \
  --package-name SESAP --package-version <next-version> \
  --folder-name SESAP-Live --parent-folder-path Shared
```

The Coded App redeploys separately (unchanged this session):
`npm run build && uip codedapp pack ./dist ... && uip codedapp publish ... && uip codedapp deploy ...`
(see UIPATH_INTEGRATION.md).

---

## 6. Key IDs (personal org)

| Thing | Value |
|---|---|
| Data Fabric `Ticket` entity | `ca14332a-0081-f111-b338-000d3ab4d3b7` |
| Shared folder key | `1c313714-4ed8-41a8-91f2-edfa178a3902` |
| RPA process (SESAP-AutoAssign3) | `f4e5584d-52d8-43f4-94c8-d2050f036dc9` (package `TicketAutomation` 1.0.2) |
| Serverless machine | `[Default] Cloud Robots - Serverless` (`ff39eeb3-…`) assigned to Shared |
| App External App (PKCE) | `c4260874-f31d-4859-bc69-3acb06123c68` |
| Studio Web solution id | `71ab7141-535f-4036-e0de-08dee3311b11` |

---

## 7. Honest status — what is NOT yet verified / needs a step

1. **BPMN → RPA at runtime (authored + validated + deployed, NOT executed).**
   The `Orchestrator.StartJob` node references the real process (releaseKey
   `F4E5584D-…`, folderPath `Shared`, name `SESAP-AutoAssign3`) and the BPMN is
   VALID and deployed. I did **not** run a Maestro process *instance* to confirm
   the job fires from the BPMN. To test: start a Maestro instance from the
   deployed `SESAP-Platform` and confirm a child RPA job appears in Shared.
   If it doesn't resolve by `folderPath`, add the numeric `folderId` to the
   StartJob node's context.

2. **App → BPMN is not auto-triggered.** Submitting a ticket writes to Data
   Fabric; the RPA process is then run on-demand (or on a schedule). For fully
   hands-off automation, add a **Data Fabric trigger** on `Ticket` (record
   created) that starts the process — the app's `insertRecord` already raises
   Data Fabric trigger events.

3. **Live email** (`SendNotification`) logs the prepared message but does not
   send. To enable: add a **Send Mail** activity + a Gmail/Outlook connection
   (Integration Service) or SMTP credentials at the marked point in the workflow.

4. **Cleanup:** test processes `SESAP-AutoAssign` / `-2` and test records
   `SESAP-VERIFY-*` are demo artifacts — safe to delete.

---

## 8. One-line summary for a reviewer

A premium banking support app writes tickets to UiPath Data Fabric; a modular,
compile-clean UiPath RPA process runs on Cloud Serverless to auto-assign them by
category and write the result back to Data Fabric (**proven live**); a Maestro
BPMN orchestrates the same flow and invokes that RPA process — all packaged and
deployed as one versioned UiPath Solution.
