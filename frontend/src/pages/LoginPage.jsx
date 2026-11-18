import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { state } = useLocation()
  const [error, setError] = useState(state?.sessionMessage ?? '')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST', authenticated: false, body: { email, password },
      })
      if (typeof data.access_token !== 'string' || !data.access_token) {
        setError('Unable to sign in. Please try again.')
        return
      }

      try {
        localStorage.setItem('access_token', data.access_token)
      } catch {
        setError('Unable to save your login. Please allow browser storage and try again.')
        return
      }

      navigate('/home')
    } catch (error) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Left panel — branding */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🅿</span>
            <span className={styles.logoText}>ParkShare</span>
          </div>
          <h1 className={styles.heroHeadline}>
            Rent your driveway.<br />Find easy parking.
          </h1>
          <p className={styles.heroSub}>
            The peer-to-peer marketplace that turns unused driveways into
            income — and solves the parking headache for everyone else.
          </p>
          <div className={styles.featureList}>
            <Feature icon="💰" text="Earn money from your empty driveway" />
            <Feature icon="📍" text="Book spots near your destination" />
            <Feature icon="🔒" text="Manage your parking reservations" />
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Welcome back</h2>
          <p className={styles.formSub}>Sign in to your ParkShare account</p>

          {state?.registrationMessage && <p className={styles.formSub} role="status">{state.registrationMessage}</p>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <p className={styles.errorMsg} role="alert">{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className={styles.signupPrompt}>
            Don't have an account?{' '}
            <Link to="/signup" className={styles.signupLink}>Sign up free</Link>
          </p>

        </div>
      </div>
    </div>
  )
}

function Feature({ icon, text }) {
  return (
    <div className={styles.feature}>
      <span className={styles.featureIcon}>{icon}</span>
      <span>{text}</span>
    </div>
  )
}
