// Public landing page shown before sign-in.
import { useApp } from '../context/AppContext.jsx'
import { APP_NAME, APP_VERSION, automations, announcements } from '../data.js'

const MODULES = [
  { icon: '🎫', bg: 'var(--blue-bg)', color: 'var(--blue)', title: 'Ticket Management', desc: 'Log, triage, assign, and resolve support tickets across every banking channel with full SLA governance.' },
  { icon: '🤖', bg: 'var(--violet-bg)', color: 'var(--violet)', title: 'Automation Monitoring', desc: 'Live health of RPA robots — success rates, failures, and reconciliation runs at a glance.' },
  { icon: '📊', bg: 'var(--teal-bg)', color: 'var(--teal)', title: 'Analytics', desc: 'Executive dashboards, trends, agent performance, and SLA compliance with Power BI-style visuals.' },
  { icon: '📚', bg: 'var(--green-bg)', color: 'var(--green)', title: 'Knowledge Centre', desc: 'FAQs, SOPs, runbooks, and known-error records for faster, consistent resolutions.' },
  { icon: '✨', bg: 'var(--brand-tint)', color: 'var(--brand)', title: 'AI Assistant', desc: 'A support copilot that searches, summarises, recommends assignees, and drafts responses.' },
  { icon: '📖', bg: 'var(--amber-bg)', color: 'var(--amber)', title: 'User Guide', desc: 'Guided onboarding, help centre, and operational runbooks for every team member.' },
]

const HEALTH = [
  { label: 'Core Banking', color: 'var(--green)', status: 'Operational' },
  { label: 'Internet Banking', color: 'var(--green)', status: 'Operational' },
  { label: 'Reconciliation Robot', color: 'var(--amber)', status: 'Degraded' },
  { label: 'Card Services', color: 'var(--green)', status: 'Operational' },
]

const A_ICON = { info: ['ℹ', 'var(--blue-bg)', 'var(--blue)'], success: ['✓', 'var(--green-bg)', 'var(--green)'], warning: ['!', 'var(--amber-bg)', 'var(--amber)'] }

export default function Landing() {
  const { setEntered } = useApp()
  const healthy = automations.filter((a) => a.status === 'healthy').length
  const goSignIn = () => setEntered(true)

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-brand">
          <div className="logo">S</div>
          <div>
            <b>SESAP</b>
            <span>Stanbic IBTC</span>
          </div>
        </div>
        <button className="btn primary" onClick={goSignIn}>Sign In →</button>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div>
            <span className="hero-pill">🏦 Enterprise Support &amp; Automation</span>
            <h1>{APP_NAME}</h1>
            <p>
              One command centre for banking operations — unify support tickets, RPA automation health,
              analytics, and AI-assisted resolution in a secure, enterprise-grade platform.
            </p>
            <div className="hero-cta">
              <button className="btn primary lg" onClick={goSignIn}>Sign In to Platform</button>
              <button className="btn ghost lg" onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Modules
              </button>
            </div>
          </div>
          <div className="hero-card">
            <h4>System Health</h4>
            {HEALTH.map((h) => (
              <div className="health-row" key={h.label}>
                <span><span className="health-dot" style={{ background: h.color }} />{h.label}</span>
                <span style={{ opacity: .85 }}>{h.status}</span>
              </div>
            ))}
            <div className="health-row" style={{ borderTop: '1px solid rgba(255,255,255,.24)', marginTop: 8, paddingTop: 12 }}>
              <span>Automation fleet</span>
              <strong>{healthy}/{automations.length} healthy</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="modules">
        <h2>A complete operations platform</h2>
        <p className="lead">Six integrated modules that give support, operations, and executives a single source of truth.</p>
        <div className="feature-grid">
          {MODULES.map((m) => (
            <div className="feature-card" key={m.title}>
              <div className="feature-ico" style={{ background: m.bg, color: m.color }}>{m.icon}</div>
              <h3>{m.title}</h3>
              <p>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="announce-strip">
        <div className="announce-inner">
          {announcements.map((a) => {
            const [ico, bg, color] = A_ICON[a.level] || A_ICON.info
            return (
              <div className="announce" key={a.id}>
                <span className="a-ico" style={{ background: bg, color }}>{ico}</span>
                <div>
                  <strong style={{ fontSize: 14 }}>{a.title}</strong>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--muted)' }}>{a.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="landing-foot">
        {APP_NAME} · Version {APP_VERSION} · © {new Date().getFullYear()} Stanbic IBTC. For authorised personnel only.
      </div>
    </div>
  )
}
