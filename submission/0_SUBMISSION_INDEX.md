# SESAP — Submission Package

**UiPath End-to-End Orchestration Challenge · Coded App + RPA + Maestro + Data Fabric**
Live environment: org `stanbgdgzsbd` / tenant `DefaultTenant` · App **v2.9.19** · RPA **v2.0.13** · Maestro `TicketLifecycle`.

## The 7 required deliverables → where they are

| # | Required item | In this folder | Status |
|---|---|---|---|
| 1 | Coded App project (source + export) | `1_CodedApp_sesapsupportplatform.2.9.19.nupkg` · **source = the repository** · live at `https://stanbgdgzsbd.uipath.host/sesap-support-platform` | ✅ |
| 5 | README (architecture, wiring, setup, bonuses) | `1_README.html` | ✅ |
| 2 | Published RPA workflow | `2_RPA_TicketAutomation_v2.0.13.nupkg` · source in `SESAP/TicketAutomation/` · published in Orchestrator | ✅ |
| 3 | Maestro / BPMN process definition | `3_Maestro_TicketLifecycle.bpmn` | ✅ |
| 4 | Data Fabric entity schema | `4_DataFabric_schema.md` + `4_DataFabric_entity_visual.html` (24 fields, live-verified) | ✅ |
| 6 | Demo video (5–8 min) | **Record separately** using `6_Demo_walkthrough_guide.html` | ⬜ outstanding |
| 7 | Architecture diagram (App→Maestro→RPA→Data & back) | `7_architecture_diagram.svg` (also embedded in the README) | ✅ |

## How to open the files
- **HTML files** — double-click; they open in any browser **offline**, no login. To make a portable copy: open → **Print → Save as PDF**.
- **`.svg`** — opens in any browser or image viewer.
- **`.bpmn`** — the Maestro process definition (open in Studio/any BPMN viewer, or submit as-is).
- **`.nupkg`** — the built Coded App and RPA packages.

## The one remaining task
**Record the 5–8 minute demo video** following `6_Demo_walkthrough_guide.html`. Everything else is ready.
