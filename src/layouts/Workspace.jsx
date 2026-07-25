// Authenticated workspace shell: sidebar + top nav + routed page + overlays.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import Sidebar from '../components/layout/Sidebar.jsx'
import TopNav from '../components/layout/TopNav.jsx'
import TicketWorkspace from '../components/TicketWorkspace.jsx'
import AICopilot from '../components/AICopilot.jsx'

import Dashboard from '../pages/Dashboard.jsx'
import TicketQueue from '../pages/TicketQueue.jsx'
import CreateTicket from '../pages/CreateTicket.jsx'
import Reports from '../pages/Reports.jsx'
import AutomationHealth from '../pages/AutomationHealth.jsx'
import KnowledgeCentre from '../pages/KnowledgeCentre.jsx'
import AuditTrail from '../pages/AuditTrail.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import CopilotPage from '../pages/CopilotPage.jsx'
import Settings from '../pages/Settings.jsx'
import HelpCentre from '../pages/HelpCentre.jsx'

const QUEUE_VIEWS = ['queue', 'my', 'assigned', 'high', 'overdue', 'escalations', 'approvals']

function Router({ view }) {
  if (QUEUE_VIEWS.includes(view)) return <TicketQueue key={view} preset={view} />
  switch (view) {
    case 'dashboard': return <Dashboard />
    case 'create': return <CreateTicket />
    case 'reports': return <Reports />
    case 'automation': return <AutomationHealth />
    case 'knowledge': return <KnowledgeCentre />
    case 'audit': return <AuditTrail />
    case 'notifications': return <NotificationsPage />
    case 'copilot': return <CopilotPage />
    case 'settings': return <Settings />
    case 'help': return <HelpCentre />
    default: return <Dashboard />
  }
}

export default function Workspace() {
  const { view, openTicket } = useApp()
  const [copilotOpen, setCopilotOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <TopNav onOpenCopilot={() => setCopilotOpen((o) => !o)} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <Router view={view} />
        </main>
      </div>

      {openTicket && <TicketWorkspace />}

      <button className="copilot-fab" title="AI Copilot" onClick={() => setCopilotOpen((o) => !o)}>
        {copilotOpen ? '✕' : '✨'}
      </button>
      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  )
}
