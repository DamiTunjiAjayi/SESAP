// Top-level router: Landing → Login → (Workspace | Customer Portal by role).
import { useApp } from './context/AppContext.jsx'
import { isCustomer } from './auth.js'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Workspace from './layouts/Workspace.jsx'
import CustomerPortal from './layouts/CustomerPortal.jsx'
import ToastStack from './components/ui/ToastStack.jsx'

export default function App() {
  const { user, entered } = useApp()

  let screen
  if (user) screen = isCustomer(user) ? <CustomerPortal /> : <Workspace />
  else if (entered) screen = <Login />
  else screen = <Landing />

  return (
    <>
      {screen}
      <ToastStack />
    </>
  )
}
