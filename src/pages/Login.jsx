// Premium split-screen sign-in page.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { validateLogin, isCustomer } from '../auth.js'
import { APP_NAME } from '../data.js'

const POINTS = [
  ['🔐', 'Bank-grade access controls'],
  ['⚡', 'Real-time SLA & automation monitoring'],
  ['✨', 'AI-assisted ticket resolution'],
]

export default function Login() {
  const { login, setEntered } = useApp()
  const [portal, setPortal] = useState('staff') // 'staff' | 'customer'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function submit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) return setError('Please enter both username and password.')
    setBusy(true)
    setTimeout(() => {
      const user = validateLogin(username, password)
      if (!user) { setError('Invalid username or password.'); setBusy(false); return }
      // Enforce the selected portal so "staff" and "customer" logins are distinct.
      const cust = isCustomer(user)
      if (portal === 'customer' && !cust) { setError('This is a staff account. Switch to the Staff Portal to sign in.'); setBusy(false); return }
      if (portal === 'staff' && cust) { setError('This is a customer account. Switch to the Customer Portal to sign in.'); setBusy(false); return }
      login(user)
    }, 700)
  }

  return (
    <div className="login-split">
      <div className="login-brand-side">
        <div className="login-logo">
          <div className="logo">S</div>
          <div>
            <strong style={{ color: '#fff', fontSize: 16 }}>SESAP</strong>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Stanbic IBTC</div>
          </div>
        </div>

        <div className="login-hero">
          <h2>Enterprise Support &amp; Automation Platform</h2>
          <p>Secure, unified operations for support, automation, and analytics across the bank.</p>
          <div className="login-points">
            {POINTS.map(([ico, text]) => (
              <div className="login-point" key={text}>
                <span className="p-ico">{ico}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-foot-note">© {new Date().getFullYear()} Stanbic IBTC · Authorised access only</div>
      </div>

      <div className="login-form-side">
        <form className="login-glass" onSubmit={submit}>
          <button type="button" className="btn ghost sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={() => setEntered(false)}>← Back</button>
          <h1>Welcome back</h1>
          <p className="sub">Sign in to {APP_NAME.split('(')[0].trim()}</p>

          <div className="login-toggle" role="tablist">
            <button type="button" className={portal === 'staff' ? 'active' : ''} onClick={() => { setPortal('staff'); setError('') }}>🏢 Staff Portal</button>
            <button type="button" className={portal === 'customer' ? 'active' : ''} onClick={() => { setPortal('customer'); setError('') }}>👤 Customer Portal</button>
          </div>

          <div className="login-field">
            <label>Username</label>
            <input value={username} autoFocus autoComplete="username" onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" />
          </div>

          <div className="login-field">
            <label>Password</label>
            <div className="pw-wrap">
              <input type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password">{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div className="login-row">
            <span className="muted" style={{ fontSize: 12 }}>🔒 You'll be signed out when you leave — sign in each visit.</span>
            <a href="#forgot" onClick={(e) => e.preventDefault()}>Forgot password?</a>
          </div>

          {error && <div className="login-err">{error}</div>}

          <button className="btn primary block lg" type="submit" disabled={busy}>
            {busy ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
          </button>

          <div className="login-security">
            <span>🛡️</span>
            <span>This is a secure environment for authorised Stanbic IBTC personnel. Activity may be monitored and audited.</span>
          </div>

          <p className="login-hint">
            {portal === 'staff'
              ? <>Supervisor — <code>admin</code> · Agents — <code>ngozi</code>, <code>tobi</code>, <code>chidi</code>, <code>fatima</code>, <code>emeka</code>, <code>kunle</code></>
              : <>Customer — <code>user</code></>}
          </p>
        </form>
      </div>
    </div>
  )
}
