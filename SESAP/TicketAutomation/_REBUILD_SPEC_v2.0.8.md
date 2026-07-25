# TicketAutomation — faithful rebuild spec (recovered from live v2.0.8 DLL)

This is the exact, verbatim logic of the running robot, recovered from the compiled
package `SESAP.process.TicketAutomation:2.0.8`. Raw strings: `_recovered-v2.0.8-logic.txt`.
Rebuild the editable source from this so the solution + Studio Web match what runs.

**Dependencies** (project.json): `UiPath.System.Activities` [26.6.1], `UiPath.DataService.Activities`
25.9.9, **`UiPath.GSuite.Activities` 3.10.10** (adds the Gmail Send Email activity).

**Entry (project.json arguments):** in_Stage, in_Ref, in_Subject, in_RequesterEmail,
in_Assignee, in_Priority (In, String); out_AssignedCount (Out, Int32); out_Sent (Out, Boolean).

## Main.xaml — two modes (top-level If on `in_Stage`)

### Mode A — lifecycle email  (If `Not String.IsNullOrEmpty(in_Stage)`)
Send ONE Gmail email to the requester (Gmail connection **90afc2de-c197-4306-92c1-1927a32cd42c**),
InputType HTML, then `out_Sent = True`. Compute 4 values from `in_Stage`, then drop into the shared template:

```
accent   = If(in_Stage="escalated","#b91c1c", If(in_Stage="resolved","#16a34a", If(in_Stage="closed","#64748b",
             If(in_Stage="approval","#b45309", If(in_Stage="rejected","#b91c1c", "#0057b8")))))
badge    = If(in_Stage="escalated","Escalated", If(in_Stage="resolved","Resolved", If(in_Stage="closed","Closed",
             If(in_Stage="approval","Approval needed", If(in_Stage="approved","Approved", If(in_Stage="rejected","Rejected","Received"))))))
headline = If(in_Stage="escalated","Your ticket has been escalated", If(in_Stage="resolved","Your ticket has been resolved",
             If(in_Stage="closed","Your ticket has been closed",
             If(in_Stage="approval","A ticket needs your approval",
             If(in_Stage="approved","Your request has been approved",
             If(in_Stage="rejected","Your request was returned","We have received your ticket"))))))
intro    = If(in_Stage="escalated","This ticket has been escalated for priority handling and is receiving urgent attention.",
             If(in_Stage="resolved","Good news - your ticket has been resolved. If the issue persists, reply to reopen it.",
             If(in_Stage="closed","Your ticket is now closed. Thank you for using Stanbic IBTC support.",
             If(in_Stage="approval","A ticket is awaiting your approval. Please review it and approve or reject in SESAP.",
             If(in_Stage="approved","Your request has been approved and is proceeding.",
             If(in_Stage="rejected","Your request was reviewed and returned for changes. Please review and resubmit.",
             "Thanks for contacting Stanbic IBTC support. Your ticket has been logged and will be triaged shortly."))))))
```
> ⚠️ THIS IS THE APPROVAL-EMAIL FIX: the live robot only branches escalated/resolved/closed, so
> approval/approved/rejected/assigned fell through to "We have received your ticket." The extra
> branches above give each stage its own wording.

To: `New String(){ If(String.IsNullOrEmpty(in_RequesterEmail), "damilaretunjiajayi+requester@gmail.com", in_RequesterEmail) }`
Subject: `"[SESAP] " + badge + ": " + in_Ref`
Body = shared HTML template (see `_recovered-v2.0.8-logic.txt`, uses accent/badge/headline/intro + in_Ref/in_Subject/in_Priority + deep link `.../sesap-support-platform?ticket=" + in_Ref`).

### Mode B — batch auto-assign (Else)
1. `GetRobotAsset("SESAP_Anthropic_Key")` → apiKey.
2. `QueryEntityRecords<Ticket>` (EntityId ca14332a-0081-f111-b338-000d3ab4d3b7, Top 1000) → allTickets. *(already in base Main)*
3. ForEach unassigned ticket `t`:
   a. **InvokeCode (AI triage)** — VB recovered verbatim in `_recovered-v2.0.8-logic.txt` (Anthropic `/v1/messages`, model `claude-haiku-4-5-20251001`, x-api-key=apiKey; parses category/priority/summary/recommendation; Catch → fallback category, "medium"). Needs refs: System.Net.Http, Newtonsoft.Json.
   b. category = If(empty(aiCategory), t.Category, aiCategory); priority likewise.
   c. team = map(category); assignee = map(team). *(maps already in base Main)*
   d. **InvokeWorkflowFile SyncToDataFabric** with in_Ref, in_Assignee, in_Team, in_AssignmentStatus="Assigned", **in_Category, in_Priority, in_Summary(=aiSummary), in_Recommendation(=aiRecommendation)**.
   e. Two Gmail emails: requester ("Your ticket has been assigned", accent #0057b8) + agent
      ("A new ticket has been assigned to you", accent #0f766e) — full HTML in the recovered file;
      agent To = `"damilaretunjiajayi+" + assignee.Split(" "c)(0).ToLower() + "@gmail.com"`.
   f. out_AssignedCount += 1.

## SyncToDataFabric.xaml — extend
Add args in_Category, in_Priority, in_Summary, in_Recommendation (In, String). Entity write becomes:
`New Ticket() With {.Id=matched.Id, .AssignedTo=in_Assignee, .Team=in_Team, .AssignmentStatus=in_AssignmentStatus, .Category=in_Category, .Priority=in_Priority, .SubCategory=in_Summary, .Tags=in_Recommendation}`

## Modular workflows — already correct in the solution
EscalateTicket (Priority→urgent), ResolveTicket (Status→resolved), AssignTicket (team/assignee maps,
manual for High risk), ValidateTicket (Ref+Subject required), WriteAuditLog, SendNotification — match v2.0.8.

## Finishing reliably
The DataService, InvokeCode and **Gmail Send Email** activities add cleanly in **Studio Web's visual
designer** (pick the Gmail connection, paste the expressions above). Then `Publish` → the running robot
matches this source, and `uip solution upload SESAP` makes Studio Web = solution = runtime.
