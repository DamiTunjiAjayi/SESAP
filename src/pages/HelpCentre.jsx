// Help Centre: getting-started guide + FAQ.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

const STEPS = [
  ['1', 'Create a ticket', 'Go to Create Ticket, classify the request, assign an engineer, and optionally email them on submit.'],
  ['2', 'Work the queue', 'Use the Ticket Queue with filters, saved views, sorting, and bulk actions to triage efficiently.'],
  ['3', 'Open the workspace', 'Click any ticket to open the tabbed workspace — edit every property, add notes, upload files, and act.'],
  ['4', 'Monitor & report', 'Track SLA breaches on the dashboard, watch automation health, and export analytics for leadership.'],
]

const FAQS = [
  ['How does email notification work?', 'When you assign a ticket with an email on file, SESAP opens a pre-filled message in your mail client. Automated server-sent email is delivered once the backend is connected.'],
  ['Where is my data stored?', 'Currently in your browser (localStorage). Connecting the enterprise backend moves this to the central database and enables cross-device sync.'],
  ['What can the AI Copilot do?', 'It searches tickets in natural language, summarises history, recommends assignees, flags SLA risk, drafts responses, and produces executive summaries — all from your live data.'],
  ['How is SLA calculated?', 'Each priority has a target window (Urgent 24h, High 48h, Medium 96h, Low 168h) measured from ticket creation. Overdue tickets are flagged across the platform.'],
  ['Can I export tickets?', 'Yes — export the current queue or a selection to CSV or Excel, and print/PDF individual tickets from the workspace.'],
]

export default function HelpCentre() {
  const { navigate } = useApp()
  const [open, setOpen] = useState(0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Help Centre</div>
          <h1>Help Centre</h1>
          <p className="sub">Getting started, guides, and frequently asked questions.</p>
        </div>
      </div>

      <div className="grid-12">
        <div>
          <div className="chart-card" style={{ marginBottom: 20 }}>
            <div className="card-head"><h3>Getting started</h3></div>
            {STEPS.map(([n, title, desc]) => (
              <div className="feed-item" key={n}>
                <span className="feed-ico" style={{ background: 'var(--brand)', color: '#fff' }}>{n}</span>
                <div className="feed-body"><p><b>{title}</b></p><div className="t">{desc}</div></div>
              </div>
            ))}
          </div>

          <div className="chart-card">
            <div className="card-head"><h3>Frequently asked questions</h3></div>
            {FAQS.map(([q, a], i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <button className="btn ghost block" style={{ justifyContent: 'space-between', padding: '13px 0', fontWeight: 700 }} onClick={() => setOpen(open === i ? -1 : i)}>
                  {q}<span>{open === i ? '−' : '+'}</span>
                </button>
                {open === i && <p className="muted" style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.6 }}>{a}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h3>Quick links</h3></div>
          <button className="btn block" style={{ marginBottom: 8 }} onClick={() => navigate('create')}>＋ Create a ticket</button>
          <button className="btn block" style={{ marginBottom: 8 }} onClick={() => navigate('queue')}>☰ Open ticket queue</button>
          <button className="btn block" style={{ marginBottom: 8 }} onClick={() => navigate('knowledge')}>📚 Knowledge base</button>
          <button className="btn block" onClick={() => navigate('copilot')}>✨ Ask the AI Copilot</button>
        </div>
      </div>
    </div>
  )
}
