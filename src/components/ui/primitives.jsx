// Small reusable UI primitives: badges, avatar, animated counter, skeletons.
import { useEffect, useRef, useState } from 'react'
import { STATUS_LABELS, titleCase, initials as toInitials } from '../../utils.js'

export function StatusBadge({ status }) {
  return (
    <span className={`badge st-${status}`}>
      <span className="dot" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return <span className={`badge pr-${priority}`}>{titleCase(priority)}</span>
}

export function RiskBadge({ risk }) {
  if (!risk) return null
  return <span className={`badge risk-${risk}`}>{risk} risk</span>
}

export function Avatar({ name, size, initials }) {
  const cls = size ? `avatar ${size}` : 'avatar'
  if (!name && !initials) return <span className={`${cls} ghost`}>?</span>
  return <span className={cls}>{initials || toInitials(name)}</span>
}

// Counts from 0 → value on mount for a lively KPI feel.
export function AnimatedNumber({ value, duration = 900, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef()
  useEffect(() => {
    let start
    const target = Number(value) || 0
    cancelAnimationFrame(ref.current)
    const tick = (ts) => {
      if (start === undefined) start = ts
      const p = Math.min(1, (ts - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(target * eased)
      if (p < 1) ref.current = requestAnimationFrame(tick)
      else setDisplay(target)
    }
    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [value, duration])
  return (
    <>
      {display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  )
}

export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} />
}

export function ProgressRing({ value, size = 84, stroke = 9, color = 'var(--brand)' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(100, value) / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight="800" fill="var(--text)">
        {Math.round(value)}%
      </text>
    </svg>
  )
}
