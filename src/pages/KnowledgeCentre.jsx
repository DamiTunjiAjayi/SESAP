// Knowledge Centre: FAQs, SOPs, runbooks, known errors.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { knowledgeArticles } from '../data.js'

const TYPES = ['All', 'FAQ', 'SOP', 'Runbook', 'Known Error']
const typeClass = (t) => `kb-type ${t === 'Known Error' ? 'kb-type-known' : t}`

export default function KnowledgeCentre() {
  const { addToast } = useApp()
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')

  const items = knowledgeArticles.filter((a) => {
    const matchType = type === 'All' || a.type === type
    const matchQ = !q.trim() || (a.title + a.summary + a.category).toLowerCase().includes(q.toLowerCase())
    return matchType && matchQ
  })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Knowledge Base</div>
          <h1>Knowledge Centre</h1>
          <p className="sub">FAQs, standard operating procedures, runbooks, and known-error records.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-mini"><span className="i">🔎</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles…" />
        </div>
        {TYPES.map((t) => <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t}</button>)}
      </div>

      <div className="kb-grid">
        {items.map((a) => (
          <div className="kb-card" key={a.id} onClick={() => addToast({ type: 'info', title: a.id, message: 'Full article opens with the content service.' })}>
            <span className={typeClass(a.type)}>{a.type}</span>
            <h3>{a.title}</h3>
            <p>{a.summary}</p>
            <div className="meta">{a.category} · updated {a.updatedAt} · {a.id}</div>
          </div>
        ))}
      </div>
      {items.length === 0 && <div className="empty-state"><div className="big-ico">📚</div>No articles match your search.</div>}
    </div>
  )
}
