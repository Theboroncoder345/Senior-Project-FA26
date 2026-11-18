import { Link } from 'react-router-dom'
import styles from './ForgotPasswordPage.module.css'

export default function ForgotPasswordPage() {
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
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>

          <div className={styles.iconWrapper}>🔑</div>
          <h2 className={styles.formTitle}>Password reset is unavailable</h2>
          <Link to="/login" className={styles.backLink}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
