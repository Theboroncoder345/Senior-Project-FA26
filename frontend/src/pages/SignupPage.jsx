import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client'
import styles from './SignupPage.module.css'

export default function SignupPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    isOwner: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim()) errs.lastName = 'Last name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        authenticated: false,
        body: {
          name: [form.firstName.trim(), form.lastName.trim()].join(' '),
          email: form.email.trim(),
          password: form.password,
          is_owner: form.isOwner,
        },
      })
      navigate('/login', { replace: true, state: { registrationMessage: 'Account created. Sign in to continue.' } })
    } catch (error) {
      setErrors({ submit: error.message })
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
            Your driveway.<br />Your parking spot.<br />One account.
          </h1>
          <p className={styles.heroSub}>
            With one ParkShare account you can list your driveway,
            book spots near you, and manage everything in one place.
          </p>
          <div className={styles.featureList}>
            <Feature icon="🏠" text="List your driveway in minutes" />
            <Feature icon="🚗" text="Book parking near any destination" />
            <Feature icon="🔒" text="Sign in to manage your account" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Create your account</h2>
          <p className={styles.formSub}>Free to join — takes less than a minute</p>

          {errors.submit && <p className={styles.error} role="alert">{errors.submit}</p>}

          <form onSubmit={handleSubmit} className={styles.form} noValidate>

            {/* Name row */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input
                  type="text"
                  placeholder="Chris"
                  value={form.firstName}
                  onChange={update('firstName')}
                  className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
                />
                {errors.firstName && <span className={styles.error}>{errors.firstName}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Last name</label>
                <input
                  type="text"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={update('lastName')}
                  className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
                />
                {errors.lastName && <span className={styles.error}>{errors.lastName}</span>}
              </div>
            </div>

            {/* Email */}
            <div className={styles.field}>
              <label className={styles.label}>Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update('email')}
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              />
              {errors.email && <span className={styles.error}>{errors.email}</span>}
            </div>

            {/* Password */}
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={update('password')}
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <span className={styles.error}>{errors.password}</span>}
            </div>

            {/* Confirm password */}
            <div className={styles.field}>
              <label className={styles.label}>Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
              />
              {errors.confirmPassword && <span className={styles.error}>{errors.confirmPassword}</span>}
            </div>

            <label>
              <input type="checkbox" checked={form.isOwner}
                onChange={event => setForm({ ...form, isOwner: event.target.checked })} />
              {' '}I want to list parking
            </label>

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className={styles.loginPrompt}>
            Already have an account?{' '}
            <Link to="/login" className={styles.loginLink}>Sign in</Link>
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
