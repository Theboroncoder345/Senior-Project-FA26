import { useCallback, useState } from 'react'
import LoginPage from './pages/LoginPage'
import ProtectedPage from './pages/ProtectedPage'

function App() {
  const [showProtectedPage, setShowProtectedPage] = useState(true)
  const [loginMessage, setLoginMessage] = useState('')
  const showLogin = useCallback((message = '') => {
    setLoginMessage(message)
    setShowProtectedPage(false)
  }, [])
  const showAccount = useCallback(() => setShowProtectedPage(true), [])

  return showProtectedPage
    ? <ProtectedPage onSignOut={showLogin} />
    : <LoginPage onLoginSuccess={showAccount} initialError={loginMessage} />
}

export default App
