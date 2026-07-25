// Full-page AI Support Copilot.
import { useRef, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { answerQuestion, getSuggestions, openingInsight } from '../copilot.js'

function TypingDots() {
  const [n, setN] = useState(1)
  useEffect(() => { const iv = setInterval(() => setN((x) => (x % 3) + 1), 350); return () => clearInterval(iv) }, [])
  return <span>{'.'.repeat(n)}</span>
}

const CAPS = [
  ['🔎', 'Natural-language search', 'Find tickets by describing them in plain English.'],
  ['📝', 'Summaries', 'Condense a ticket’s full history into a briefing.'],
  ['🎯', 'Assignee recommendations', 'Suggest the best engineer by team & load.'],
  ['⏰', 'SLA risk radar', 'Surface tickets close to breaching SLA.'],
  ['✍️', 'Response drafts', 'Generate a first-draft reply to the requester.'],
  ['📈', 'Executive summaries', 'One-paragraph status for leadership.'],
]

export default function CopilotPage() {
  const { tickets, user, assignTicket, setStatus, escalateTicket, requestApproval, navigate, setOpenTicketId } = useApp()
  const suggestions = getSuggestions(user)
  const [messages, setMessages] = useState([{ role: 'bot', text: `Hi ${user?.name?.split(' ')[0] || 'there'} 👋 ${openingInsight(tickets, user)} I can summarise, flag SLA risk, or act — "escalate #1042", "resolve #1039", "take #1037".` }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, thinking])

  const actions = {
    take: (id, eng) => assignTicket(id, eng),
    escalate: (id) => escalateTicket(id),
    resolve: (id) => setStatus(id, 'resolved'),
    close: (id) => setStatus(id, 'closed'),
    reopen: (id) => setStatus(id, 'open'),
    requestApproval: (id) => requestApproval(id),
    open: (id) => { setOpenTicketId(id); navigate?.('queue') },
  }

  function send(text) {
    const q = (text ?? input).trim(); if (!q || thinking) return
    setMessages((m) => [...m, { role: 'user', text: q }]); setInput(''); setThinking(true)
    setTimeout(() => {
      const reply = answerQuestion(q, { tickets, user, actions })
      setThinking(false)
      setMessages((m) => [...m, { role: 'bot', text: reply }])
    }, 500 + Math.min(700, q.length * 12))
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / AI Assistant</div>
          <h1>AI Support Copilot</h1>
          <p className="sub">An enterprise assistant that reasons over your live ticket data.</p>
        </div>
      </div>

      <div className="grid-12">
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: 560, padding: 0, overflow: 'hidden' }}>
          <div className="copilot-msgs" ref={scrollRef} style={{ flex: 1 }}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>{m.text.split('\n').map((l, j) => <div key={j}>{l || ' '}</div>)}</div>
            ))}
            {thinking && <div className="msg bot" style={{ opacity: 0.75 }}>Thinking<TypingDots /></div>}
          </div>
          <div className="copilot-suggest">
            {suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
          </div>
          <div className="copilot-input">
            <textarea rows={1} value={input} placeholder="Ask the copilot…" onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <button className="btn primary" onClick={() => send()} disabled={!input.trim()}>Send</button>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Capabilities</h3></div>
          {CAPS.map(([ico, title, desc]) => (
            <div className="feed-item" key={title}>
              <span className="feed-ico" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>{ico}</span>
              <div className="feed-body"><p><b>{title}</b></p><div className="t">{desc}</div></div>
            </div>
          ))}
          <div className="form-note" style={{ marginTop: 14 }}>
            <span>💡</span>
            <span>Runs fully offline on your data today. Connect the Claude API via the backend to unlock open-ended generative answers.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
