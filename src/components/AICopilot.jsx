// Floating AI Support Copilot.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { answerQuestion, getSuggestions, openingInsight } from '../copilot.js'
import { extractDocument } from '../documentAI.js'

// Animated "…" so the copilot visibly thinks before answering.
function TypingDots() {
  const [n, setN] = useState(1)
  useEffect(() => { const iv = setInterval(() => setN((x) => (x % 3) + 1), 350); return () => clearInterval(iv) }, [])
  return <span>{'.'.repeat(n)}</span>
}

export default function AICopilot({ open, onClose, tickets: scoped, greeting }) {
  const { tickets: all, user, assignTicket, setStatus, escalateTicket, requestApproval, navigate, setOpenTicketId } = useApp()
  const tickets = scoped || all
  const suggestions = getSuggestions(user)
  const firstName = user?.name?.split(' ')[0] || 'there'
  const greetText = greeting || `Hi ${firstName} 👋 ${openingInsight(tickets, user)} Ask me to summarise, flag SLA risk, or act on a ticket ("escalate #1042", "resolve #1039", "take #1037").`
  const [messages, setMessages] = useState([{ role: 'bot', text: greetText }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)

  // Attach a document in the chat → the assistant reads out what's in it
  // (Document Understanding). Real extraction: text files read directly, scanned
  // images/ID cards via on-device OCR, and PDFs via pdf.js text extraction.
  async function onAttach(file) {
    if (!file || thinking) return
    const att = { name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file) }
    setMessages((m) => [...m, { role: 'user', text: `📎 ${file.name}` }])
    setThinking(true)
    let r
    try { r = await extractDocument(att) } catch (e) { r = { ok: false, name: file.name, docType: 'Unreadable', note: e?.message } }
    let text
    if (r.ok && r.extracted && r.fields) {
      const f = r.fields
      const parts = [`📄 I read **${r.name}** — looks like a ${r.docType}.`, r.summary]
      if (f.amounts?.length) parts.push(`• Amounts: ${f.amounts.join(', ')}`)
      if (f.dates?.length) parts.push(`• Dates: ${f.dates.join(', ')}`)
      if (f.accounts?.length) parts.push(`• Account numbers: ${f.accounts.join(', ')}`)
      if (f.references?.length) parts.push(`• References: ${f.references.join(', ')}`)
      if (f.emails?.length) parts.push(`• Emails: ${f.emails.join(', ')}`)
      if (f.phones?.length) parts.push(`• Phone numbers: ${f.phones.join(', ')}`)
      if (r.textPreview) parts.push(`\n📝 What it says:\n${r.textPreview.slice(0, 700)}${r.textPreview.length > 700 ? '…' : ''}`)
      text = parts.join('\n')
    } else {
      text = `📄 ${r.name} — ${r.docType || 'document'}.\n${r.summary || ''}\n${r.note || ''}`.trim()
    }
    setThinking(false)
    setMessages((m) => [...m, { role: 'bot', text }])
  }

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, open, thinking])

  // Action handlers the copilot may invoke on the user's behalf.
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
    const q = (text ?? input).trim()
    if (!q || thinking) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setThinking(true)
    // Brief "thinking" pause so the assistant reads as reasoning, not a lookup.
    setTimeout(() => {
      const reply = answerQuestion(q, { tickets, user, actions })
      setThinking(false)
      setMessages((m) => [...m, { role: 'bot', text: reply }])
    }, 500 + Math.min(700, q.length * 12))
  }

  if (!open) return null
  return (
    <div className="copilot-panel">
      <div className="copilot-header">
        <span className="ai-badge">✨</span>
        <div style={{ flex: 1 }}>
          <strong>SESAP Copilot</strong>
          <span>AI assistant · answers, acts &amp; reads documents you attach</span>
        </div>
        <button className="icon-btn" style={{ color: '#fff' }} onClick={onClose}>✕</button>
      </div>
      <div className="copilot-msgs" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text.split('\n').map((l, j) => <div key={j}>{l || ' '}</div>)}
          </div>
        ))}
        {thinking && <div className="msg bot" style={{ opacity: 0.75 }}>Thinking<TypingDots /></div>}
      </div>
      {messages.length <= 1 && (
        <div className="copilot-suggest">
          {suggestions.slice(0, 4).map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <div className="copilot-input">
        <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = '' }} />
        <button className="btn" title="Attach a document to read" onClick={() => fileRef.current?.click()} disabled={thinking}>📎</button>
        <textarea rows={1} value={input} placeholder="Ask, or attach a document…" onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn primary" onClick={() => send()} disabled={!input.trim()}>Send</button>
      </div>
    </div>
  )
}
