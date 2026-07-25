// SESAP — automated tests for the pure business logic (SLA math, live analytics,
// email/export builders). Uses Node's built-in test runner (no native deps).
// Run: npm test
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SLA_HOURS, dueDate, isActive, isOverdue, slaProgress,
  volumeTrendFromTickets, avgResolutionHours,
  buildMailto, assignmentEmail, ticketsToCSV,
} from './utils.js'

const HOUR = 3600 * 1000
const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString()

describe('SLA math', () => {
  it('dueDate = created + SLA window for the priority', () => {
    const created = new Date('2026-07-01T00:00:00Z')
    const due = dueDate({ createdAt: created.toISOString(), priority: 'urgent' })
    assert.equal(due.getTime() - created.getTime(), SLA_HOURS.urgent * HOUR)
  })
  it('unknown priority falls back to 96h', () => {
    const created = new Date('2026-07-01T00:00:00Z')
    const due = dueDate({ createdAt: created.toISOString(), priority: 'whatever' })
    assert.equal(due.getTime() - created.getTime(), 96 * HOUR)
  })
  it('isActive is true only for open / in_progress', () => {
    assert.equal(isActive({ status: 'open' }), true)
    assert.equal(isActive({ status: 'in_progress' }), true)
    assert.equal(isActive({ status: 'resolved' }), false)
    assert.equal(isActive({ status: 'closed' }), false)
  })
  it('isOverdue: active + past due = true; fresh = false; resolved-but-old = false', () => {
    assert.equal(isOverdue({ status: 'open', priority: 'urgent', createdAt: iso(-48 * HOUR) }), true)
    assert.equal(isOverdue({ status: 'open', priority: 'urgent', createdAt: iso(-1 * HOUR) }), false)
    assert.equal(isOverdue({ status: 'resolved', priority: 'urgent', createdAt: iso(-99 * HOUR) }), false)
  })
  it('slaProgress > 1 means breached, ~0 when fresh', () => {
    assert.ok(slaProgress({ createdAt: iso(-48 * HOUR), priority: 'urgent' }) > 1)
    assert.ok(slaProgress({ createdAt: iso(-1 * HOUR), priority: 'low' }) < 0.1)
  })
})

describe('live analytics (no seed data)', () => {
  it('volumeTrendFromTickets buckets created + resolved by day', () => {
    const today = new Date().toISOString().slice(0, 10)
    const tickets = [
      { createdAt: iso(0), status: 'open' },
      { createdAt: iso(0), status: 'open' },
      { createdAt: iso(0), status: 'resolved', updatedAt: iso(0) },
    ]
    const trend = volumeTrendFromTickets(tickets, 14)
    assert.equal(trend.length, 14)
    const last = trend[trend.length - 1]
    assert.equal(last.key, today)
    assert.equal(last.created, 3)
    assert.equal(last.resolved, 1)
  })
  it('volumeTrendFromTickets tolerates empty / missing dates', () => {
    assert.equal(volumeTrendFromTickets([], 7).length, 7)
    assert.doesNotThrow(() => volumeTrendFromTickets(null, 7))
  })
  it('avgResolutionHours averages resolved tickets, null when none', () => {
    const created = new Date('2026-07-01T00:00:00Z').toISOString()
    const two = new Date('2026-07-01T02:00:00Z').toISOString()
    const four = new Date('2026-07-01T04:00:00Z').toISOString()
    assert.ok(Math.abs(avgResolutionHours([
      { status: 'resolved', createdAt: created, updatedAt: two },
      { status: 'closed', createdAt: created, updatedAt: four },
    ]) - 3) < 1e-6)
    assert.equal(avgResolutionHours([{ status: 'open', createdAt: created, updatedAt: four }]), null)
    assert.equal(avgResolutionHours([]), null)
  })
})

describe('email + export builders', () => {
  it('buildMailto encodes recipients, subject and body', () => {
    const url = buildMailto({ to: 'a@b.com', subject: 'Hi there', body: 'line one & two' })
    assert.ok(url.startsWith('mailto:a%40b.com?')) // buildMailto URL-encodes the recipient
    assert.ok(url.includes('subject=Hi%20there'))
    assert.ok(url.includes(encodeURIComponent('&')))
  })
  it('assignmentEmail includes the ref and assignee', () => {
    const { subject, body } = assignmentEmail({ ref: 'SESAP-1', subject: 'Card issue', priority: 'high', status: 'open', createdAt: iso(0) }, 'Ngozi Eze')
    assert.ok(subject.includes('SESAP-1'))
    assert.ok(body.includes('Ngozi Eze'))
  })
  it('ticketsToCSV emits a header row + one row per ticket', () => {
    const csv = ticketsToCSV([
      { ref: 'SESAP-1', subject: 'A', status: 'open', priority: 'high', assignee: 'X', createdAt: iso(0) },
      { ref: 'SESAP-2', subject: 'B,with comma', status: 'closed', priority: 'low', assignee: 'Y', createdAt: iso(0) },
    ])
    const lines = csv.trim().split('\n')
    assert.equal(lines.length, 3) // header + 2
    assert.ok(lines[0].toLowerCase().includes('ref'))
  })
})
