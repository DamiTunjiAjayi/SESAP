# Data Fabric — `Ticket` entity schema

Exported live from tenant `stanbgdgzsbd / DefaultTenant` via [`scripts/describe-entity.mjs`](../scripts/describe-entity.mjs). Re-verified live on 2026-07-25 — all 24 fields unchanged (`Ref` required+unique, `Subject` required).

- **Entity name:** `Ticket`
- **Entity id:** `ca14332a-0081-f111-b338-000d3ab4d3b7`
- **Description:** "SESAP support tickets. New submissions land unassigned for triage."
- **Field count:** 24 (19 business fields + 5 system fields)

## Business fields

| Field | Type | Notes |
|---|---|---|
| `Ref` | STRING | **required, unique** — human ref e.g. `SESAP-1042`, `SESAP-E2E-602606` |
| `Subject` | STRING | **required** |
| `Description` | MULTILINE_TEXT | |
| `Requester` | STRING | |
| `RequesterEmail` | STRING | |
| `Category` | STRING | e.g. incident, request |
| `SubCategory` | STRING | |
| `Department` | STRING | |
| `Channel` | STRING | Portal / Email / … |
| `Team` | STRING | set during routing/assignment |
| `BusinessService` | STRING | |
| `RiskLevel` | STRING | drives the Maestro auto‑vs‑manual gateway |
| `Priority` | STRING | low / medium / high / urgent |
| `Status` | STRING | open / resolved / … |
| **`AssignedTo`** | STRING | **written by the RPA robot** (the engineer) |
| **`AssignmentStatus`** | STRING | **the write‑back proof field: `Unassigned` → `Assigned`** |
| `Tags` | STRING | comma‑separated |
| `Source` | STRING | `SESAP` |
| `CreatedAt` | DATETIME | app‑set ISO timestamp |

## System fields (managed by Data Service)

| Field | Type |
|---|---|
| `Id` | UUID (primary key) |
| `CreatedBy` | RELATIONSHIP (user) |
| `CreateTime` | DATETIME_WITH_TZ |
| `UpdateTime` | DATETIME_WITH_TZ |
| `UpdatedBy` | RELATIONSHIP (user) |

## Challenge mapping (baseline 4.2)

- Required minimum fields — **ID** (`Id`/`Ref`), **subject** (`Subject`), **description** (`Description`), **priority** (`Priority`), **status** (`Status` / `AssignmentStatus`), **assignee** (`AssignedTo`), **created date** (`CreatedAt`/`CreateTime`) — all present. ✅
- Status field updated by the automation to prove the write‑back loop — **`AssignmentStatus`** (and `AssignedTo`), set by the RPA robot during the orchestration. ✅

## Lifecycle of the two write‑back fields

| Stage | `AssignmentStatus` | `AssignedTo` |
|---|---|---|
| App creates the ticket | `Unassigned` | `""` |
| RPA robot runs (via Maestro) | `Assigned` | engineer name (e.g. `Tobi Martins`) |
