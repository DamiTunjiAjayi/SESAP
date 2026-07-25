// Automation / RPA health monitoring.
import { automations } from '../data.js'
import { timeAgo } from '../utils.js'
import { ProgressRing, AnimatedNumber } from '../components/ui/primitives.jsx'

export default function AutomationHealth() {
  const healthy = automations.filter((a) => a.status === 'healthy').length
  const avg = Math.round(automations.reduce((s, a) => s + a.successRate, 0) / automations.length)
  const runs = automations.reduce((s, a) => s + a.runsToday, 0)
  const ringColor = avg > 90 ? 'var(--green)' : avg > 75 ? 'var(--amber)' : 'var(--red)'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Automation Health</div>
          <h1>Automation Health</h1>
          <p className="sub">Live status of the RPA robot fleet.</p>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="grid-3">
          <div className="kpi-card"><div className="kpi-top"><div className="kpi-ico green">✅</div></div><div className="kpi-value"><AnimatedNumber value={healthy} />/{automations.length}</div><div className="kpi-label">Healthy robots</div></div>
          <div className="kpi-card"><div className="kpi-top"><div className="kpi-ico brand">🔁</div></div><div className="kpi-value"><AnimatedNumber value={runs} /></div><div className="kpi-label">Runs today</div></div>
          <div className="kpi-card"><div className="kpi-top"><div className="kpi-ico teal">📈</div></div><div className="kpi-value"><AnimatedNumber value={avg} suffix="%" /></div><div className="kpi-label">Avg success rate</div></div>
        </div>
        <div className="chart-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ProgressRing value={avg} size={110} color={ringColor} />
          <div>
            <h3 style={{ margin: '0 0 4px' }}>Fleet health</h3>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Overall automation success across all robots.</p>
          </div>
        </div>
      </div>

      <div className="bot-grid">
        {automations.map((b) => (
          <div className="bot-card" key={b.id}>
            <div className="bot-head">
              <div><strong style={{ fontSize: 15 }}>{b.name}</strong><div className="muted" style={{ fontSize: 12 }}>{b.id}</div></div>
              <span className={`status-tag ${b.status}`}><span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />{b.status}</span>
            </div>
            <div className="prog-block">
              <div className="prog-label"><span>Success rate</span><b>{b.successRate}%</b></div>
              <div className="prog-track"><div className={`prog-fill ${b.successRate > 90 ? 'green' : b.successRate > 75 ? 'amber' : 'red'}`} style={{ width: `${b.successRate}%` }} /></div>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{b.runsToday} runs today · last run {timeAgo(b.lastRun)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
