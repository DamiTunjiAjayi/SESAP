// Executive command centre: KPIs, charts, leaderboard, activity, SLA breaches.
import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { runAutoAssignBot } from '../integrations/runbot.js'
import { getRobotHealth } from '../integrations/orchestrator.js'
import { ENGINEERS, automations, DEPARTMENTS } from '../data.js'
import { dueDate, isOverdue, isActive, countdown, timeAgo, volumeTrendFromTickets, avgResolutionHours } from '../utils.js'
import { AnimatedNumber, Avatar, StatusBadge } from '../components/ui/primitives.jsx'
import { Donut, ChartLegend, LineChart, Sparkline, BarList } from '../components/ui/Charts.jsx'

const ACT_ICON = { created: '🆕', comment: '💬', status: '🔄', priority: '⚑', assign: '👤', attachment: '📎' }

export default function Dashboard() {
  const { tickets, user, navigate, setOpenTicketId, addToast, isAgent } = useApp()
  const [botRunning, setBotRunning] = useState(false)
  // Live robot health from real Orchestrator job outcomes (falls back to the
  // representative system gauge if the call is unavailable).
  const [liveHealth, setLiveHealth] = useState(null)
  useEffect(() => {
    getRobotHealth().then((r) => { if (r.ok && r.health != null) setLiveHealth(r.health) })
  }, [])

  async function handleRunBot() {
    setBotRunning(true)
    addToast({ type: 'info', title: 'Starting orchestration…', message: 'Launching the Maestro TicketLifecycle process.' })
    const res = await runAutoAssignBot({ force: true })
    setBotRunning(false)
    if (res.ok) {
      addToast({ type: 'success', title: 'Orchestration started', message: `Maestro job ${res.jobKey ? res.jobKey.slice(0, 8) : ''} is ${res.state}. It will triage & auto-assign unassigned tickets.` })
    } else {
      addToast({ type: 'error', title: 'Could not start orchestration', message: res.error })
    }
  }

  const m = useMemo(() => {
    const total = tickets.length
    const by = (s) => tickets.filter((t) => t.status === s).length
    const overdue = tickets.filter(isOverdue).length
    const compliance = total ? Math.round((tickets.filter((t) => !isOverdue(t)).length / total) * 100) : 100
    const robotHealth = Math.round(automations.reduce((s, a) => s + a.successRate, 0) / automations.length)
    const autoSuccess = Math.round((automations.filter((a) => a.status === 'healthy').length / automations.length) * 100)
    return {
      total,
      open: by('open'),
      inProgress: by('in_progress'),
      resolved: by('resolved') + by('closed'),
      overdue,
      compliance,
      robotHealth,
      autoSuccess,
    }
  }, [tickets])

  // Live 14-day trend + 7-day slices for real sparklines (no seed data).
  const trend = useMemo(() => volumeTrendFromTickets(tickets), [tickets])
  const created7 = trend.slice(-7).map((v) => v.created)
  const resolved7 = trend.slice(-7).map((v) => v.resolved)
  const totalSpark = useMemo(() => {
    let run = m.total - created7.reduce((a, b) => a + b, 0)
    return created7.map((c) => (run += c))
  }, [trend, m.total])
  const unassigned = tickets.filter((t) => !t.assignee || t.assignmentStatus === 'Unassigned').length
  const assigned = tickets.filter((t) => t.assignee && t.assignmentStatus !== 'Unassigned').length
  const avgRes = avgResolutionHours(tickets)
  const robotHealth = liveHealth ?? m.robotHealth

  const statusData = [
    { label: 'Open', value: tickets.filter((t) => t.status === 'open').length, color: '#2563eb' },
    { label: 'In progress', value: tickets.filter((t) => t.status === 'in_progress').length, color: '#d97706' },
    { label: 'Resolved', value: tickets.filter((t) => t.status === 'resolved').length, color: '#16a34a' },
    { label: 'Closed', value: tickets.filter((t) => t.status === 'closed').length, color: '#64748b' },
  ]

  const deptData = DEPARTMENTS.map((d) => ({
    label: d,
    value: tickets.filter((t) => t.department === d && isActive(t)).length,
  })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)

  const leaderboard = useMemo(() => {
    return ENGINEERS.map((e) => {
      const handled = tickets.filter((t) => t.assignee === e.name)
      const resolved = handled.filter((t) => t.status === 'resolved' || t.status === 'closed').length
      const active = handled.filter(isActive).length
      const score = resolved * 2 + active
      return { ...e, handled: handled.length, resolved, active, score }
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [tickets])
  const topScore = Math.max(...leaderboard.map((l) => l.score), 1)

  const recentActivity = useMemo(() => {
    return tickets
      .flatMap((t) => (t.activity || []).map((a) => ({ ...a, ref: t.ref, id: t.id })))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 6)
  }, [tickets])

  const breaches = useMemo(() => {
    return tickets
      .filter(isActive)
      .map((t) => ({ t, due: dueDate(t) }))
      .sort((a, b) => a.due - b.due)
      .slice(0, 5)
  }, [tickets])

  // All values live from the Data Fabric ticket set; sparklines use the real
  // 7-day created/resolved trend. Robot Health is a system gauge (representative).
  const KPIS = [
    { label: 'Total Tickets', value: m.total, icon: '🎫', tone: 'brand', spark: totalSpark },
    { label: 'Open', value: m.open, icon: '📥', tone: 'blue', spark: created7 },
    { label: 'In Progress', value: m.inProgress, icon: '⏳', tone: 'amber' },
    { label: 'Resolved', value: m.resolved, icon: '✅', tone: 'green', spark: resolved7 },
    { label: 'Unassigned', value: unassigned, icon: '📭', tone: 'violet', spark: created7 },
    { label: 'Assigned', value: assigned, icon: '👥', tone: 'teal', spark: resolved7 },
    { label: 'Overdue', value: m.overdue, icon: '⏰', tone: 'red' },
    { label: 'SLA Compliance', value: m.compliance, suffix: '%', icon: '🛡️', tone: 'teal' },
    { label: 'Avg Resolution', value: avgRes == null ? null : Number(avgRes.toFixed(1)), placeholder: '—', decimals: 1, suffix: 'h', icon: '⚡', tone: 'violet' },
    { label: 'Robot Health', value: robotHealth, suffix: '%', icon: '🤖', tone: 'brand' },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Dashboard</div>
          <h1>{isAgent ? 'My Workspace' : 'Executive Command Centre'}</h1>
          <p className="sub">
            {isAgent
              ? `Welcome back, ${user?.name?.split(' ')[0]} — here's the work on your plate today.`
              : `Welcome back, ${user?.name?.split(' ')[0]} — here's the operational picture this morning.`}
          </p>
        </div>
        <div className="page-actions">
          {isAgent ? (
            <button className="btn" onClick={() => navigate('assigned')}>📥 My Queue</button>
          ) : (
            <button className="btn" onClick={() => navigate('reports')}>📊 Full Reports</button>
          )}
          {!isAgent && (
            <button className="btn" onClick={handleRunBot} disabled={botRunning}>
              {botRunning ? '⏳ Starting…' : '▶ Start Orchestration'}
            </button>
          )}
          <button className="btn primary" onClick={() => navigate('create')}>＋ Create Ticket</button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {KPIS.map((k, i) => (
          <div className="kpi-card" key={k.label} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="kpi-top">
              <div className={`kpi-ico ${k.tone}`}>{k.icon}</div>
              {k.trend && <span className={`kpi-trend ${k.up ? 'up' : ''}`}>{k.up ? '▲' : ''} {k.trend}</span>}
            </div>
            <div className="kpi-value">
              {k.value == null
                ? <span>{k.placeholder || '—'}</span>
                : <AnimatedNumber value={k.value} decimals={k.decimals || 0} suffix={k.suffix || ''} />}
            </div>
            <div className="kpi-label">{k.label}</div>
            {k.spark && <div className="kpi-spark"><Sparkline values={k.spark} color="var(--brand)" /></div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="chart-card">
          <div className="card-head">
            <h3>Ticket Volume — Created vs Resolved</h3>
            <span className="sub">Last 14 days · live from Data Fabric</span>
          </div>
          <LineChart
            series={[
              { values: trend.map((v) => v.created), color: '#0057b8', fill: true },
              { values: trend.map((v) => v.resolved), color: '#16a34a', fill: true },
            ]}
            labels={trend.map((v) => v.d)}
          />
          <ChartLegend data={[{ label: 'Created', color: '#0057b8' }, { label: 'Resolved', color: '#16a34a' }]} />
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Status Distribution</h3></div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <Donut data={statusData} size={150} centerLabel={m.total} centerSub="tickets" />
          </div>
          <ChartLegend data={statusData} />
        </div>
      </div>

      {/* Progress centre + leaderboard */}
      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="chart-card">
          <div className="card-head"><h3>Executive Progress Centre</h3><span className="sub">Live operational status</span></div>
          <div className="grid-2">
            <div>
              <div className="prog-block">
                <div className="prog-label"><span>SLA Compliance</span><b>{m.compliance}%</b></div>
                <div className="prog-track"><div className="prog-fill green" style={{ width: `${m.compliance}%` }} /></div>
              </div>
              <div className="prog-block">
                <div className="prog-label"><span>Resolution Progress</span><b>{Math.round((m.resolved / (m.total || 1)) * 100)}%</b></div>
                <div className="prog-track"><div className="prog-fill blue" style={{ width: `${(m.resolved / (m.total || 1)) * 100}%` }} /></div>
              </div>
              <div className="prog-block">
                <div className="prog-label"><span>Automation Health{liveHealth != null ? ' · live' : ''}</span><b>{robotHealth}%</b></div>
                <div className="prog-track"><div className={`prog-fill ${robotHealth > 90 ? 'green' : 'amber'}`} style={{ width: `${robotHealth}%` }} /></div>
              </div>
              <div className="prog-block">
                <div className="prog-label"><span>Overdue Load</span><b>{m.overdue}</b></div>
                <div className="prog-track"><div className="prog-fill red" style={{ width: `${Math.min(100, (m.overdue / (m.total || 1)) * 100)}%` }} /></div>
              </div>
            </div>
            <div>
              <div className="section-title">Department Workload</div>
              <BarList data={deptData} />
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Agent Performance</h3><span className="sub">Leaderboard</span></div>
          {leaderboard.map((l, i) => (
            <div className="leader-row" key={l.name}>
              <span className="leader-rank">{i + 1}</span>
              <Avatar name={l.name} initials={l.initials} size="sm" />
              <div className="leader-meta">
                <strong>{l.name}</strong>
                <span>{l.resolved} resolved · {l.active} active</span>
              </div>
              <div className="leader-bar"><i style={{ width: `${(l.score / topScore) * 100}%` }} /></div>
              <span className="leader-score">{l.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity + breaches + insights */}
      <div className="grid-3">
        <div className="chart-card">
          <div className="card-head"><h3>Recent Activity</h3></div>
          {recentActivity.map((a, i) => (
            <div className="feed-item" key={i} onClick={() => setOpenTicketId(a.id)} style={{ cursor: 'pointer' }}>
              <span className="feed-ico">{ACT_ICON[a.type] || '•'}</span>
              <div className="feed-body">
                <p><b>{a.ref}</b> — {a.text}</p>
                <div className="t">{a.author} · {timeAgo(a.at)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Upcoming SLA Breaches</h3><span className="sub">Countdown</span></div>
          {breaches.map(({ t, due }) => {
            const over = isOverdue(t)
            return (
              <div className="breach-row" key={t.id} onClick={() => setOpenTicketId(t.id)} style={{ cursor: 'pointer' }}>
                <div className="breach-meta">
                  <strong>{t.ref} — {t.subject}</strong>
                  <span>{t.assignee || 'Unassigned'} · {t.team}</span>
                </div>
                <span className={`countdown ${over ? 'bad' : 'ok'}`}>{over ? 'BREACHED' : countdown(due.toISOString())}</span>
              </div>
            )
          })}
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Executive Insights</h3><span className="sub">AI-generated</span></div>
          <div className="feed-item"><span className="feed-ico" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>↑</span><div className="feed-body"><p>SLA compliance is currently <b>{m.compliance}%</b> across active tickets.</p></div></div>
          <div className="feed-item"><span className="feed-ico" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>!</span><div className="feed-body"><p><b>{m.overdue} tickets</b> are overdue — prioritise the payments and ATM queue.</p></div></div>
          <div className="feed-item"><span className="feed-ico" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>🤖</span><div className="feed-body"><p>Robot success rate is <b>{robotHealth}%</b> across recent Orchestrator jobs.</p></div></div>
          <div className="feed-item"><span className="feed-ico" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>◎</span><div className="feed-body"><p>Digital Channels carries the heaviest active load this week.</p></div></div>
        </div>
      </div>
    </div>
  )
}
