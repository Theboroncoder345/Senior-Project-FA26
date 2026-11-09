import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ForgotPasswordPage.module.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError('')

    try {
      // TODO: wire up to backend
      // await fetch('http://127.0.0.1:8000/auth/forgot-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email }),
      // })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Left hero panel */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🅿</span>
            <span className={styles.logoText}>ParkShare</span>
          </div>
          <h1 className={styles.heroHeadline}>
            No worries,<br />we've got you.
          </h1>
          <p className={styles.heroSub}>
            Happens to the best of us. Enter your email and we'll
            send you a link to get back into your account in seconds.
          </p>
          <div className={styles.featureList}>
            <Feature icon="📧" text="Reset link sent to your email" />
            <Feature icon="🔒" text="Link expires after 15 minutes" />
            <Feature icon="✅" text="Back in your account in seconds" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>

          {submitted ? (
            /* ── Success state ── */
            <div className={styles.successState}>
              <div className={styles.successIconWrapper}>📬</div>
              <h2 className={styles.successTitle}>Check your email</h2>
              <p className={styles.successSub}>
                We sent a password reset link to <strong>{email}</strong>.
                Check your inbox — it should arrive within a minute.
              </p>
              <p className={styles.successNote}>
                Didn't get it? Check your spam folder or{' '}
                <button
                  className={styles.resendBtn}
                  onClick={() => setSubmitted(false)}
                >
                  try again
                </button>
                .
              </p>
              <Link to="/login" className={styles.backToLogin}>
                ← Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className={styles.iconWrapper}>🔑</div>
              <h2 className={styles.formTitle}>Forgot your password?</h2>
              <p className={styles.formSub}>
                Enter the email address on your account and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.input}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <p className={styles.errorMsg} role="alert">{error}</p>
                )}

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <Link to="/login" className={styles.backLink}>
                ← Back to sign in
              </Link>
            </>
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
