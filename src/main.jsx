import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import './index.css'

// Deep link from email: preserve ?ticket=<Ref> across the OAuth/login round-trip
// (the redirect returns to a URL without the query string, so stash it now).
try {
  const qp = new URLSearchParams(window.location.search)
  const tp = qp.get('ticket')
  if (tp) sessionStorage.setItem('sesap_deeplink_ticket', tp)
  // HITL: approve/reject action carried from the supervisor's email.
  if (qp.get('approve') != null) sessionStorage.setItem('sesap_deeplink_action', 'approve')
  else if (qp.get('reject') != null) sessionStorage.setItem('sesap_deeplink_action', 'reject')
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
)
