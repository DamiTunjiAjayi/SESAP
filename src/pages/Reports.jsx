// Analytics & reports.
import { useApp } from '../context/AppContext.jsx'
import { PRIORITIES, CHANNELS, DEPARTMENTS } from '../data.js'
import { isActive, exportCSV, volumeTrendFromTickets } from '../utils.js'
import { LineChart, Donut, ChartLegend, BarList } from '../components/ui/Charts.jsx'

const PRI_COLORS = { urgent: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#64748b' }

export default function Reports() {
  const { tickets } = useApp()

  const statusData = [
    { label: 'Open', value: tickets.filter((t) => t.status === 'open').length, color: '#2563eb' },
    { label: 'In progress', value: tickets.filter((t) => t.status === 'in_progress').length, color: '#d97706' },
    { label: 'Resolved', value: tickets.filter((t) => t.status === 'resolved').length, color: '#16a34a' },
    { label: 'Closed', value: tickets.filter((t) => t.status === 'closed').length, color: '#64748b' },
  ]
  const priData = PRIORITIES.map((p) => ({ label: p[0].toUpperCase() + p.slice(1), value: tickets.filter((t) => t.priority === p).length, color: PRI_COLORS[p] }))
  const channelData = CHANNELS.map((c) => ({ label: c, value: tickets.filter((t) => t.channel === c).length })).filter((d) => d.value)
  const deptData = DEPARTMENTS.map((d) => ({ label: d, value: tickets.filter((t) => t.department === d && isActive(t)).length })).filter((d) => d.value)
  const trend = volumeTrendFromTickets(tickets)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Reports</div>
          <h1>Analytics &amp; Reports</h1>
          <p className="sub">Operational trends and distributions across the support estate.</p>
        </div>
        <div className="page-actions"><button className="btn primary" onClick={() => exportCSV(tickets, 'sesap-report')}>⬇ Export dataset</button></div>
      </div>

      <div className="chart-card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>Ticket Volume — Created vs Resolved</h3><span className="sub">Last 14 days · live from Data Fabric</span></div>
        <LineChart series={[{ values: trend.map((v) => v.created), color: '#0057b8', fill: true }, { values: trend.map((v) => v.resolved), color: '#16a34a', fill: true }]} labels={trend.map((v) => v.d)} width={1100} height={240} />
        <ChartLegend data={[{ label: 'Created', color: '#0057b8' }, { label: 'Resolved', color: '#16a34a' }]} />
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="chart-card">
          <div className="card-head"><h3>By Status</h3></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Donut data={statusData} size={140} centerLabel={tickets.length} centerSub="total" /></div>
          <ChartLegend data={statusData} />
        </div>
        <div className="chart-card">
          <div className="card-head"><h3>By Priority</h3></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Donut data={priData} size={140} /></div>
          <ChartLegend data={priData} />
        </div>
        <div className="chart-card">
          <div className="card-head"><h3>By Source Channel</h3></div>
          <BarList data={channelData} color="var(--teal)" />
        </div>
      </div>

      <div className="chart-card">
        <div className="card-head"><h3>Active Workload by Department</h3></div>
        <BarList data={deptData} />
      </div>
    </div>
  )
}
