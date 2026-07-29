# SESAP — Stanbic IBTC Enterprise Support & Automation Platform

**UiPath End-to-End Orchestration Challenge (Bank Developer Edition)**

### ▶ [**Open the live app**](https://stanbgdgzsbd.uipath.host/sesap-support-platform) &nbsp;·&nbsp; 🎬 [**Watch the demo (6 min)**](https://go.screenpal.com/watch/cOitqLnvV8v) &nbsp;·&nbsp; 📦 [**Download project (ZIP)**](https://github.com/DamiTunjiAjayi/SESAP/releases/download/v1.0/SESAP_submission.zip)

<sub>The live app is a deployed UiPath Coded App, so it opens inside the UiPath tenant and may ask you to sign in. The demo video needs no sign-in.</sub>

SESAP is a staff support desk I built end to end on UiPath. Someone on the support team opens a ticket in the app, a Maestro process picks it up and coordinates the lifecycle, an RPA robot does the real work (triage, assignment, notifications), and the result is written back into Data Fabric so the app shows the change almost straight away. What I was really after was getting all four UiPath pieces to genuinely work together as one loop, instead of just sitting next to each other.

```
Coded App  →  Maestro (BPMN)  →  RPA robot  →  Data Fabric  →  back to the app
```

If you'd rather read this in a browser with the architecture diagram, there's an illustrated version at `docs/SUBMISSION_README.html`.

## What each piece does

**The Coded App** is a React and TypeScript dashboard where you view, search, sort, open, create and act on tickets. It talks to Data Fabric through the UiPath TypeScript SDK, and it's the thing that kicks off the orchestration.

**Data Fabric** is the system of record. There's a `Ticket` entity with 24 fields. The one to watch is `AssignmentStatus`, because that's the field the automation changes from `Unassigned` to `Assigned`. It's the simplest way to see that the write-back actually happened.

**Maestro** is the coordinator, a BPMN process called `TicketLifecycle`. It has a start event, a gateway that branches on what you're doing (submit, resolve, close, escalate), triage and routing steps, a risk gateway that sends high-risk items to a person instead of the robot, and end events. It's what invokes the robot.

**The RPA robot** is the hands, a published process called `TicketAutomation`. It runs the AI triage (works out a category, a priority, a short summary and a recommended action), auto-assigns the ticket, writes the outcome back to Data Fabric, and sends the lifecycle emails.

## How it all connects

1. When you create or edit a ticket, the app writes it to the `Ticket` entity in Data Fabric.
2. When you act on a ticket, the app starts the matching Maestro process and passes the ticket details in. There's a "Live automation" toggle so I don't burn Robot Units while testing.
3. Maestro triages and routes, then starts the `TicketAutomation` job. High-risk tickets branch off to manual assignment instead.
4. The robot calls Claude for the triage (the key lives as an Orchestrator asset called `SESAP_Anthropic_Key`, not in the repo) and sends email through the Gmail integration, copying the supervisor.
5. The robot changes `AssignmentStatus` from `Unassigned` to `Assigned` and bumps `UpdateTime`, which is what feeds the resolution-time figure.
6. The app re-reads the entity and shows the new status and assignee, which closes the loop.

## Running it yourself

**Coded App** (all three steps, and bump the version each time):
```bash
npm run build
uip codedapp pack ./dist --name "SESAP Support Platform" --version <NEW> --content-type webapp --main-file index.html
uip codedapp publish --name "sesapsupportplatform" --version <NEW> --type Web
uip codedapp deploy --name "SESAP Support Platform" --folder-key <SHARED>
```

**RPA robot** (pack, upload, then repoint the release):
```bash
uip rpa pack SESAP/TicketAutomation ./out --package-id SESAP.process.TicketAutomation --package-version <NEW>
uip or packages upload ./out/SESAP.process.TicketAutomation.<NEW>.nupkg
uip or processes update-version <RPA_KEY> --package-version <NEW>
```

To sync the solution into Studio Web: `uip solution upload SESAP --force`.

## What's deployed

| Resource | Value |
|---|---|
| Live app | **[▶ Open the live app](https://stanbgdgzsbd.uipath.host/sesap-support-platform)** · v2.9.19 |
| Shared folder | `1c313714-4ed8-41a8-91f2-edfa178a3902` |
| SESAP-Live folder | `c034c633-bf82-47ba-9e35-8955ea38d2b0` |
| Ticket entity | `ca14332a-0081-f111-b338-000d3ab4d3b7` (24 fields) |
| RPA release | `SESAP.process.TicketAutomation` v2.0.16 · `38E6499B-5D0E-48BF-8456-65B37D6689B6` |
| Maestro process | `TicketLifecycle` · `fedfe5d6-49f8-4cab-9503-d11f2d8ddb81` |
| Storage bucket | `195596` (ticket attachments) |
| AI key (asset) | `SESAP_Anthropic_Key` (server-side only, never in the repo) |

## The core of it

The baseline I set out to hit was the full loop, and that part works. The app lists tickets live from Data Fabric with search, sort, detail views and ticket creation that persists, and acting on a ticket starts the orchestration. The `Ticket` entity holds the record, and the automation updates `AssignmentStatus` as the write-back. The published robot does real work (triage, assignment, notifications) and both reads and writes the entity, and Maestro is what invokes it. The Maestro process itself has a start, tasks, gateways and an end, models the ticket lifecycle, and shares Data Fabric state with the robot. Put together, it runs from an action in the app all the way to a Data Fabric write-back the app then reflects, and you can watch that happen in the video.

## What else I built

Once the loop worked I kept going, because I wanted it to feel like something a bank could actually use rather than a demo:

- **AI triage.** The robot asks Claude to categorise, prioritise, summarise and recommend an action on each ticket, and writes that back onto the record.
- **Reading documents.** The copilot can read an uploaded image or ID card with on-device OCR, and pull the text out of PDFs.
- **Approvals.** Procurement and internal tickets go to a supervisor to sign off, surfaced both in the app and by email.
- **SLA and escalation.** Each priority has its own SLA timer, and anything that runs over is bumped to Urgent with an alert to the supervisor.
- **Different views for different people.** Supervisors, agents and customers each get their own experience.
- **Analytics.** Open tickets by priority, average resolution time, SLA compliance, and a created-versus-resolved trend.
- **Notifications.** Real Gmail emails on the lifecycle events, with the supervisor copied.
- **The finish.** An on-brand banking interface, plus some tests and reusable components to keep the code honest.

One note on the approvals: I did it as an app-and-email flow rather than a Maestro Action Center user task, which matched how the brief described surfacing it in the app or by email.

## Documentation

If you want to go deeper, these open in a browser:

- 📘 **[Complete System Guide](https://htmlpreview.github.io/?https://github.com/DamiTunjiAjayi/SESAP/blob/main/docs/SESAP_SYSTEM_GUIDE.html)** walks every screen, what each action fires, the Maestro process piece by piece, both robot modes, the data model, and the integrations.
- 🏦 **[Submission README](https://htmlpreview.github.io/?https://github.com/DamiTunjiAjayi/SESAP/blob/main/docs/SUBMISSION_README.html)** is the illustrated front door with the architecture diagram.
- 🗃️ **[Data Fabric entity schema](https://htmlpreview.github.io/?https://github.com/DamiTunjiAjayi/SESAP/blob/main/docs/DATA_FABRIC_ENTITY_SCHEMA.html)**, also written up in [`docs/DATA_FABRIC_SCHEMA.md`](docs/DATA_FABRIC_SCHEMA.md).

You'll also find [`docs/architecture-diagram.svg`](docs/architecture-diagram.svg), the Maestro definition at [`SESAP/TicketLifecycle/TicketLifecycle.bpmn`](SESAP/TicketLifecycle/TicketLifecycle.bpmn), and PDF copies of every document in [`submission/`](submission/).
