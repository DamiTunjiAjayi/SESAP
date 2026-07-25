# Bonus items — implementation roadmap (goal: achieve ALL)

Baseline loop is done & verified. This is the plan to fully earn every bonus (cap +25; we implement all regardless). Status: ✅ done · ◑ partial (finish it) · ○ to build.

| Bonus (max) | Now | Target implementation | Prerequisites / who |
|---|---|---|---|
| **Agentic / AI** (+6) | ○ | A **real LLM call** (UiPath **LLM Gateway**) that auto‑categorises + prioritises + summarises + recommends a resolution, **invoked inside the flow** (Maestro agent step or RPA step; surfaced in the app Copilot). | Verify LLM Gateway API + scope. Possibly add an LLM scope to the External App (like we did for OR.*). |
| **Document IDP** (+4) | ○ | Ticket **attachment** → **Document Understanding** extraction → fields fed into the ticket/flow. | Verify DU availability in tenant; build a small DU extractor. |
| **Human‑in‑the‑loop** (+4) | ◑ | The high‑risk **Manual** branch becomes a real **Action Center** approval task in Maestro, surfaced in the app/email. | Verify Action Center; add a user task to the BPMN. |
| **SLA & escalation** (+3) | ◑ | Auto‑escalation that **fires on breach** (Maestro SLA timer boundary event, or a scheduled robot that escalates overdue tickets and re‑routes). | Uses existing `EscalateTicket.xaml` + SLA logic. |
| **Notifications** (+2) | ◑ | **Real email** on assignment via the existing **Gmail Integration Service connection** (robot/Maestro sends it) — not just a mailto draft. | Gmail IS connection already present on the tenant. |
| **Role‑based views** (+3) | ✅ | Staff vs Customer portals (done). | — |
| **Analytics / KPIs** (+3) | ✅ | Fully live — trend + KPI sparklines from the Data Fabric ticket set, plus **Robot Health from real Orchestrator job outcomes** ([`orchestrator.js`](../src/integrations/orchestrator.js)). No seed data in analytics. | — |
| **Polished UX** (+2) | ✅ | Enterprise UI (done). | — |
| **Engineering quality** (+3) | ◑ | Add **automated tests** (Vitest for app logic; RPA test cases) + keep the never‑throw integration pattern + error boundaries. | — |

## Execution order (highest value / feasibility first)
1. **Agentic / AI (+6)** — biggest prize; LLM Gateway looks available on this tenant. Verify first.
2. **Notifications → real email (+2)** — Gmail connection already exists; quick, high‑credibility.
3. **SLA & escalation (+3)** — reuse `EscalateTicket` + SLA logic.
4. **Human‑in‑the‑loop (+4)** — Action Center approval on the manual branch.
5. **Engineering quality (+3)** — tests.
6. **Document IDP (+4)** — DU extractor (largest lift; do last).

Each item is verified live before it's marked ✅ (same discipline as the baseline). Where a step needs a portal action (scope grant, connector, DU/Action Center enablement), it's called out so you can do it and I verify.
