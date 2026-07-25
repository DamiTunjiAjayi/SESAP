# SESAP — Demo / Video Presentation Guide (5–8 min)

Your on‑camera script. Each step has **SHOW** (what's on screen) and **SAY** (talk track). Target ~7 minutes. The single most important moment is **§4 — the live loop**; everything else supports it.

---

## 0. Before you hit record (2‑minute pre‑flight)

- [ ] **Open a fresh Incognito/Private window** (guarantees a clean token with all scopes).
- [ ] Tab 1 — the app: `https://stanbgdgzsbd.uipath.host/sesap-support-platform` (signed in, on the Dashboard).
- [ ] Tab 2 — **Data Fabric**: Automation Cloud → **Data Service → Entities → `Ticket` → Data** tab.
- [ ] Tab 3 — **Maestro**: Automation Cloud → **Orchestrator → folder `SESAP‑Live` → Processes** (the `TicketLifecycle` process, so you can open its **instances**).
- [ ] Tab 4 — **Orchestrator Jobs**: `SESAP‑Live → Automations → Jobs` (to show the RPA job that Maestro starts).
- [ ] Have the [architecture diagram](../README.md#2-architecture--the-end-to-end-loop) ready to show (README §2).
- [ ] Optional: seed **1 unassigned ticket** beforehand as a backup in case of live latency.
- [ ] Close noisy notifications; zoom browser to ~110–125% so text is legible on video.

> **Timing note:** the robot runs on Community Serverless, so the assignment can take ~30–90s. Keep talking during the wait (cover architecture) — don't stare at a spinner.

---

## 1. Opening — the pitch (0:00–0:45)

**SHOW:** the SESAP dashboard.

**SAY:**
> "This is SESAP — the Stanbic IBTC Enterprise Support & Automation Platform. It's a UiPath **Coded App** front end over **Data Fabric**, and — the point of the challenge — one action here sets a real **Maestro** process in motion that drives an **RPA robot**, which writes back to Data Fabric, and the app reflects it. Let me show the whole loop end to end."

---

## 2. The architecture (0:45–1:45)

**SHOW:** the architecture diagram (README §2).

**SAY:**
> "Four layers. The **Coded App** reads and writes the `Ticket` entity in **Data Fabric** and starts the orchestration. **Maestro** is the brain — it models the lifecycle: classify, route, a risk gateway, assign. Its final step invokes the **RPA robot**, which does the actual assignment and updates Data Fabric. The app then reads the updated record. So it's: **click → Data Fabric → Maestro → RPA → Data Fabric → app** — a closed loop."

Point at each box as you say it.

---

## 3. The front end — baseline features (1:45–3:00)

**SHOW & SAY**, briefly, in the app:
- **Ticket queue** — "All tickets, live from Data Fabric — search and sort by status, priority, assignee, date." *(Do one search + one sort.)*
- **Ticket detail** — click a ticket. "Full record — description, SLA countdown, activity, attachments."
- **Analytics** — open **Reports**. "In‑app KPIs — open by priority, status mix, SLA/aging — from the live ticket set." *(bonus: Analytics)*
- **Role‑based portals** — mention the **Staff vs Customer** login. "Customers get a self‑service portal; staff get this operational workspace." *(bonus: Role‑based views)*

Keep this tight — the judges want the loop, not a UI tour.

---

## 4. THE LOOP — live, trigger to result (3:00–5:30) ⭐

This is the money shot. Narrate every step.

1. **Create a ticket.** Click **Create Ticket**, fill Subject + Requester, submit.
   **SAY:** "I submit a ticket. Watch the notifications."
2. **Show the two toasts / notifications:**
   - 📢 *"Stored in Data Fabric — … saved (Unassigned)."*
   - ▶ *"Orchestration started — Maestro TicketLifecycle launched (job …)."*
   **SAY:** "The app wrote the ticket to Data Fabric as **Unassigned**, then called `processes.start()` to launch the **Maestro** process. That's the click‑trigger."
3. **Switch to Data Fabric tab**, refresh the `Ticket` data. **SAY:** "There it is in Data Fabric — `AssignmentStatus = Unassigned`, no assignee yet."
4. **Switch to the Maestro tab**, open the newest **TicketLifecycle instance**. **SAY:** "Here's the running Maestro instance — you can see it flow through **Classify → Route → the risk gateway → Assign → Run Auto‑Assign Robot**." Point at the `Task_RunRobot` step. "That service task starts — and waits for — the RPA robot."
5. **Switch to the Jobs tab.** **SAY:** "And here's the **RPA job** Maestro started, running on Serverless — it queries the unassigned tickets and assigns one."
6. **Back to Data Fabric**, refresh. **SAY:** "Now the same ticket is **`AssignmentStatus = Assigned`** with an engineer in `AssignedTo` — written by the robot."
7. **Back to the app**, refresh the queue / open the ticket. **SAY:** "And the app reflects it — the ticket is now Assigned. That's the full loop: one click in the UI drove Maestro, the robot, and Data Fabric, and came back to the screen."

> If the robot is still running when you reach step 6, keep narrating the Maestro instance graph until it completes, then refresh.

---

## 5. Under the hood — credibility (5:30–6:45)

**SHOW:** briefly, the code + BPMN (VS Code or repo).

**SAY:**
- "The app talks to Data Fabric with the official **UiPath TypeScript SDK** — read via `getAllRecords`, write via `insertRecord`." *(open `src/integrations/datafabric.js`)*
- "The click‑trigger is `processes.start()` against the Maestro release." *(open `src/integrations/runbot.js`)*
- "In the BPMN, the robot step is an `Orchestrator.StartJob` bound to the RPA release — that's what makes Maestro launch the robot." *(open `SESAP/TicketLifecycle/TicketLifecycle.bpmn` → `Task_RunRobot`)*
- "The robot uses real Data Service activities — `QueryEntityRecords` and `UpdateEntityRecord` — no placeholders." *(open `SESAP/TicketAutomation/Integration/SyncToDataFabric.xaml` or `Main.xaml`)*

---

## 6. Close (6:45–7:15)

**SAY:**
> "So SESAP meets the baseline end to end — Coded App, Data Fabric, a published RPA workflow, and a Maestro BPMN that orchestrates them — with a real closed loop that's demonstrable live. On top, it adds role‑based portals, in‑app analytics, and SLA tracking. Everything you saw is deployed and reproducible from the repo. Thank you."

---

## Quick reference (say these correctly)

| Thing | Value |
|---|---|
| App URL | `stanbgdgzsbd.uipath.host/sesap-support-platform` |
| Folder where Maestro + RPA run | **SESAP‑Live** |
| Maestro process | **TicketLifecycle** |
| RPA process | **TicketAutomation** |
| Write‑back proof field | **`AssignmentStatus`**: Unassigned → Assigned |

## If something misbehaves on camera

- **Orchestration toast says "not authorised":** you're not in a fresh Incognito window — the old cached token is being reused. Open a new Incognito window and sign in again.
- **Robot slow / job Pending:** Serverless cold start. Narrate the Maestro graph; it'll pick up. Worst case, cut to the pre‑seeded ticket you assigned before recording.
- **Ticket didn't assign:** confirm a robot/runtime is available in SESAP‑Live; re‑run via the **▶ Start Orchestration** button on the dashboard.
