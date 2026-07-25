// Lightweight, dependency-free SVG charts: Donut, LineChart, Sparkline, Bars.
import { donutSegments, linePath } from '../../utils.js'

export function Donut({ data, size = 140, thickness = 22, centerLabel, centerSub }) {
  const radius = size / 2
  const segs = donutSegments(data, radius, thickness)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segs.map((s, i) => (
          <path key={i} d={s.d} fill={s.color}>
            <title>{`${s.label}: ${s.value}`}</title>
          </path>
        ))}
      </svg>
      {(centerLabel !== undefined) && (
        <div className="donut-center" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div>
            <div className="big">{centerLabel}</div>
            {centerSub && <div className="small">{centerSub}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export function ChartLegend({ data }) {
  return (
    <div className="legend-row">
      {data.map((d, i) => (
        <span className="li" key={i}>
          <span className="sw" style={{ background: d.color }} />
          {d.label} {d.value !== undefined && <b style={{ color: 'var(--text)' }}>&nbsp;{d.value}</b>}
        </span>
      ))}
    </div>
  )
}

// Two-series area/line chart (e.g. created vs resolved).
export function LineChart({ series, width = 560, height = 200, labels }) {
  const pad = 28
  const all = series.flatMap((s) => s.values)
  const max = Math.max(...all, 1)
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const stepX = innerW / (Math.max(1, (series[0]?.values.length || 1) - 1))
  const y = (v) => pad + innerH - (v / max) * innerH

  const gridLines = 4
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const gy = pad + (innerH / gridLines) * i
        return <line key={i} x1={pad} y1={gy} x2={width - pad} y2={gy} stroke="var(--border)" strokeWidth="1" />
      })}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => [pad + i * stepX, y(v)])
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
        const area = `${path} L${pad + innerW},${pad + innerH} L${pad},${pad + innerH} Z`
        return (
          <g key={si}>
            {s.fill && <path d={area} fill={s.color} opacity="0.1" />}
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={s.color} />
            ))}
          </g>
        )
      })}
      {labels &&
        labels.map((lb, i) => {
          if (i % 2 !== 0 && labels.length > 8) return null
          return (
            <text key={i} x={pad + i * stepX} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {lb}
            </text>
          )
        })}
    </svg>
  )
}

export function Sparkline({ values, width = 90, height = 34, color = 'var(--brand)' }) {
  const d = linePath(values, width, height, 3)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Horizontal proportional bars (e.g. workload by department).
export function BarList({ data, color = 'var(--brand)' }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div>
      {data.map((d, i) => (
        <div className="prog-block" key={i}>
          <div className="prog-label">
            <span>{d.label}</span>
            <b>{d.value}</b>
          </div>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
