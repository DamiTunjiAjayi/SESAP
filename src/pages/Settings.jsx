// Settings: profile, appearance, preferences, data, about.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { APP_NAME, APP_VERSION } from '../data.js'
import { Avatar } from '../components/ui/primitives.jsx'
import { automationEnabled, setAutomationEnabled } from '../integrations/runbot.js'

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? 'var(--brand)' : 'var(--border-strong)', position: 'relative', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
    </button>
  )
}

export default function Settings() {
  const { user, theme, toggleTheme, addToast } = useApp()
  const [prefs, setPrefs] = useState({ emailOnAssign: true, slaAlerts: true, robotAlerts: true, weeklyDigest: false })
  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }))
  const [automation, setAutomation] = useState(automationEnabled())
  function toggleAutomation(on) {
    setAutomationEnabled(on)
    setAutomation(on)
    addToast({ type: on ? 'warning' : 'success', title: on ? 'Live automation ON' : 'Live automation OFF', message: on ? 'Ticket actions will start Maestro/RPA jobs (consumes Robot Units).' : 'Cloud jobs paused — Robot Units are conserved.' })
  }

  function resetDemo() {
    if (!window.confirm('Reset all demo data? This clears locally-stored tickets and notifications and reloads.')) return
    localStorage.removeItem('sesap_tickets')
    localStorage.removeItem('sesap_notifications')
    window.location.reload()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="breadcrumb">Home / Settings</div>
          <h1>Settings</h1>
          <p className="sub">Manage your profile, appearance, and platform preferences.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <div className="card-head"><h3>Profile</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <Avatar name={user?.name} initials={user?.initials} size="lg" />
            <div>
              <strong style={{ fontSize: 16 }}>{user?.name}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{user?.role}</div>
              <div className="muted" style={{ fontSize: 13 }}>{user?.email}</div>
            </div>
          </div>
          <button className="btn" onClick={() => addToast({ type: 'info', title: 'Profile', message: 'Profile editing arrives with the directory integration.' })}>Edit profile</button>
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Appearance</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div><strong style={{ fontSize: 14 }}>Dark theme</strong><div className="muted" style={{ fontSize: 12.5 }}>Currently {theme}</div></div>
            <Toggle on={theme === 'dark'} onChange={toggleTheme} />
          </div>
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Automation &amp; Robot Units</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div style={{ paddingRight: 12 }}>
              <strong style={{ fontSize: 14 }}>Live automation</strong>
              <div className="muted" style={{ fontSize: 12.5 }}>When ON, ticket actions start Maestro/RPA jobs and send lifecycle emails — each run consumes Robot Units. Turn OFF to conserve units; the app still works fully (local + Data Fabric).</div>
            </div>
            <Toggle on={automation} onChange={toggleAutomation} />
          </div>
          <div className="form-note" style={{ marginTop: 10 }}>
            <span>{automation ? '⚡' : '🛡️'}</span>
            <span>{automation ? 'Live — background actions consume Robot Units.' : 'Conserving units — use the dashboard “Start Orchestration” button for a one-off live run.'}</span>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Notification Preferences</h3></div>
          {[
            ['emailOnAssign', 'Email me on assignment'],
            ['slaAlerts', 'SLA breach alerts'],
            ['robotAlerts', 'Automation / robot failures'],
            ['weeklyDigest', 'Weekly executive digest'],
          ].map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>{label}</span>
              <Toggle on={prefs[k]} onChange={(v) => setPref(k, v)} />
            </div>
          ))}
        </div>

        <div className="chart-card">
          <div className="card-head"><h3>Data &amp; About</h3></div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
            <div><b style={{ color: 'var(--text)' }}>Platform:</b> {APP_NAME}</div>
            <div><b style={{ color: 'var(--text)' }}>Version:</b> {APP_VERSION}</div>
            <div><b style={{ color: 'var(--text)' }}>Data source:</b> Local browser storage (backend integration pending)</div>
          </div>
          <div className="form-note" style={{ marginTop: 14 }}>
            <span>⚠️</span>
            <span>Tickets are stored in your browser today. Connect the SESAP backend to persist to the enterprise database and enable server-sent email.</span>
          </div>
          <button className="btn danger" style={{ marginTop: 14 }} onClick={resetDemo}>Reset demo data</button>
        </div>
      </div>
    </div>
  )
}
