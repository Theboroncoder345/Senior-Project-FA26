import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('http://127.0.0.1:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.status === 401) {
        setError('Invalid email or password.')
        return
      }

      if (!response.ok) {
        setError('Unable to sign in. Please try again.')
        return
      }

      const data = await response.json()
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
    } catch {
      setError('Unable to connect to the server. Please try again.')
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
            <Feature icon="🔒" text="Secure, verified listings" />
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Welcome back</h2>
          <p className={styles.formSub}>Sign in to your ParkShare account</p>

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
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <a href="#" className={styles.forgotLink}>Forgot password?</a>
              </div>
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

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button className={styles.googleBtn}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className={styles.signupPrompt}>
            Don't have an account?{' '}
            <Link to="/signup" className={styles.signupLink}>Sign up free</Link>
          </p>

          {/* DEV ONLY — remove before final demo */}
          {import.meta.env.DEV && (
            <button
              type="button"
              className={styles.devBypass}
              onClick={() => navigate('/home')}
            >
              🛠 Skip Login (Dev Only)
            </button>
          )}
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
