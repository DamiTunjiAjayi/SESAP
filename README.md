# SESAP — Stanbic IBTC Enterprise Support & Automation Platform

**UiPath End-to-End Orchestration Challenge — Bank Developer Edition**

### ▶ [**Open the live app**](https://stanbgdgzsbd.uipath.host/sesap-support-platform) &nbsp;·&nbsp; 🎬 [**Watch the demo (6 min)**](https://go.screenpal.com/watch/cOitqLnvV8v) &nbsp;·&nbsp; 📦 [**Download project (ZIP)**](https://github.com/DamiTunjiAjayi/SESAP/releases/download/v1.0/SESAP_submission.zip)

<sub>Live app is a deployed UiPath Coded App — opens in the UiPath tenant (a UiPath sign‑in may be required). The demo video needs no sign‑in.</sub>

A UiPath **Coded App** backed by **Data Fabric**, orchestrated by a **Maestro (BPMN)** process, and executed by a published **RPA robot**. A support lead acts on a ticket → Maestro coordinates → the robot does the work and writes back to Data Fabric → the app reflects it.

```
Coded App  →  Maestro (BPMN)  →  RPA robot  →  Data Fabric  ↺  app reflects the change
```

> A polished, reading-friendly version of this document — with the architecture diagram — is at
> **`docs/SUBMISSION_README.html`** (open in any browser).

---

## The four layers

| Layer | Role |
|---|---|
| **Coded App** | React/TypeScript operational dashboard — view, search, sort, investigate, create, and act on tickets. Reads/writes Data Fabric via the UiPath TypeScript SDK; starts the orchestration. |
| **Data Fabric** | System of record — the `Ticket` entity (24 fields). `AssignmentStatus` is the field the automation flips (`Unassigned → Assigned`) to prove the write-back loop. |
| **Maestro (BPMN)** | Orchestration — `TicketLifecycle`: start event, an *Action* gateway (submit / resolve / close / escalate), triage & routing tasks, a risk gateway (high-risk → manual assignment), and end events. Invokes the robot. |
| **RPA robot** | The hands — `TicketAutomation`: AI triage (categorise / prioritise / summarise / recommend), auto-assignment, Data Fabric write-back, and lifecycle email notifications. |

## How the layers connect

1. **App → Data Fabric** — creating/editing a ticket writes to the `Ticket` entity (SDK `entities`).
2. **App → Maestro** — acting on a ticket starts the Maestro process for that action (`processes.start`, ticket context as input args). Gated by a *Live automation* toggle to conserve Robot Units.
3. **Maestro → RPA** — the BPMN triages/routes, then invokes the `TicketAutomation` job (high-risk branches to manual assignment).
4. **RPA → AI & email** — the robot calls Claude (keyed by the Orchestrator asset `SESAP_Anthropic_Key`, never in the repo) and emails via Integration Service (Gmail), CC the supervisor.
5. **RPA → Data Fabric** — writes `AssignmentStatus` `Unassigned → Assigned`; `UpdateTime` advances (powers the resolution-time KPI).
6. **Data Fabric → App** — the app re-reads the entity and reflects the new status/assignee. Loop closed.

## Setup & run

**Coded App** (all three steps required; bump the version each time):
```bash
npm run build
uip codedapp pack ./dist --name "SESAP Support Platform" --version <NEW> --content-type webapp --main-file index.html
uip codedapp publish --name "sesapsupportplatform" --version <NEW> --type Web
uip codedapp deploy --name "SESAP Support Platform" --folder-key <SHARED>
```

**RPA robot** (pack → upload → repoint the release):
```bash
uip rpa pack SESAP/TicketAutomation ./out --package-id SESAP.process.TicketAutomation --package-version <NEW>
uip or packages upload ./out/SESAP.process.TicketAutomation.<NEW>.nupkg
uip or processes update-version <RPA_KEY> --package-version <NEW>
```

Solution → Studio Web sync: `uip solution upload SESAP --force`.

## Deployed resources (live)

| Resource | Value |
|---|---|
| Live app | **[▶ Open the live app](https://stanbgdgzsbd.uipath.host/sesap-support-platform)** · v2.9.19 |
| Shared folder | `1c313714-4ed8-41a8-91f2-edfa178a3902` |
| SESAP-Live folder | `c034c633-bf82-47ba-9e35-8955ea38d2b0` |
| Ticket entity | `ca14332a-0081-f111-b338-000d3ab4d3b7` (24 fields) |
| RPA release | `SESAP.process.TicketAutomation` v2.0.16 · `38E6499B-5D0E-48BF-8456-65B37D6689B6` |
| Maestro process | `TicketLifecycle` · `fedfe5d6-49f8-4cab-9503-d11f2d8ddb81` |
| Storage bucket | `195596` (ticket attachments) |
| AI key (asset) | `SESAP_Anthropic_Key` — server-side only, never in repo |

## Baseline (Section 4) — all met

- **4.1 Coded App** — TypeScript app; lists active tickets live from Data Fabric; search & sort; ticket detail; create persists to Data Fabric; in-app actions start the orchestration.
- **4.2 Data Fabric** — `Ticket` entity with the required fields; `AssignmentStatus` updated by the automation (write-back).
- **4.3 RPA** — published robot doing real work (AI triage + auto-assign + notify); reads/writes the Ticket entity; invoked by the orchestration.
- **4.4 Maestro** — start, tasks, gateways, end; models the ticket lifecycle; invokes the RPA workflow; shares Data Fabric state.
- **4.5 End-to-end** — the full loop works from app action to a Data Fabric write-back the app reflects; demonstrable live/on video.

## Bonus items attempted (Section 5 — requested 30, capped +25)

| Bonus | Points | How |
|---|---|---|
| Agentic / AI triage | +6 | Claude categorises/prioritises/summarises/recommends inside the robot, within the flow |
| Document IDP | +4 | On-device OCR reads images/ID cards; pdf.js extracts PDF text — read out in the copilot |
| Human-in-the-loop | +4 | Procurement/internal tickets → supervisor approval, surfaced in the app and by email* |
| SLA & escalation | +3 | Per-priority SLA timers; overdue → auto-escalate to Urgent + supervisor alert |
| Role-based views | +3 | Distinct supervisor / agent / customer experiences |
| Analytics / KPIs | +3 | Open by priority, avg resolution time, SLA compliance, created-vs-resolved trend |
| Engineering quality | +3 | Automated tests, reusable components, graceful error handling |
| Notifications | +2 | Real Gmail emails on lifecycle events, CC supervisor |
| Polished UX | +2 | On-brand banking interface |

\* Human-in-the-loop is an app-and-email approval flow (matching "with the app or email surfacing it"), not a Maestro Action Center user task.

## Documentation

**Rendered visual docs** (open in a browser via htmlpreview):

- 📘 **[Complete System Guide](https://htmlpreview.github.io/?https://github.com/DamiTunjiAjayi/SESAP/blob/main/docs/SESAP_SYSTEM_GUIDE.html)** — every screen, every action and what it fires, the Maestro BPMN element‑by‑element, both RPA modes, the data model, and all integrations
- 🏦 **[Submission README](https://htmlpreview.github.io/?https://github.com/DamiTunjiAjayi/SESAP/blob/main/docs/SUBMISSION_README.html)** — architecture front door with the diagram
- 🗃️ **[Data Fabric entity schema (visual)](https://htmlpreview.github.io/?https://github.com/DamiTunjiAjayi/SESAP/blob/main/docs/DATA_FABRIC_ENTITY_SCHEMA.html)** · schema also in [`docs/DATA_FABRIC_SCHEMA.md`](docs/DATA_FABRIC_SCHEMA.md)

**Also in the repo:** [`docs/architecture-diagram.svg`](docs/architecture-diagram.svg) · [`SESAP/TicketLifecycle/TicketLifecycle.bpmn`](SESAP/TicketLifecycle/TicketLifecycle.bpmn) · PDFs of every doc in [`submission/`](submission/) (+ [`submission/0_SUBMISSION_INDEX.md`](submission/0_SUBMISSION_INDEX.md)).
