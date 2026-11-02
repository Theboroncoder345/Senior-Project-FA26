import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import Marketplace from './Marketplace'
import styles from './ProtectedPage.module.css'

export default function ProtectedPage({ onSignOut }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const handleSignOut = useCallback((message = '') => {
    try {
      localStorage.removeItem('access_token')
    } catch {
      // Return to login even when browser storage is unavailable.
    }
    onSignOut(message)
  }, [onSignOut])

  useEffect(() => {
    const controller = new AbortController()
    const loadUser = async () => {
      setError('')
      setUser(null)
      try {
        const data = await apiRequest('/auth/me', { signal: controller.signal })
        if (controller.signal.aborted) return
        if (typeof data.name !== 'string' || typeof data.email !== 'string') {
          throw new Error('The server returned an invalid account.')
        }
        setUser(data)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) handleSignOut(error.message)
        else setError(error.message)
      }
    }
    loadUser()
    return () => controller.abort()
  }, [handleSignOut, attempt])

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="account-title">
        <h1 id="account-title">Your ParkShare account</h1>
        {!user && !error && <p role="status">Checking your login…</p>}
        {error && (
          <>
            <p role="alert">{error}</p>
            <button type="button" onClick={() => setAttempt(value => value + 1)}>
              Try again
            </button>
          </>
        )}
        {user && (
          <>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
          </>
        )}
        <button type="button" onClick={() => handleSignOut()}>Sign out</button>
        {user && <Marketplace user={user} onSessionExpired={handleSignOut} />}
      </section>
    </main>
  )
}
