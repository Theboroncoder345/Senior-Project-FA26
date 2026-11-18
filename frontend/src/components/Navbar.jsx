import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { useSignOut } from '../api/useApiResource'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [account, setAccount] = useState(null)
  const [accountError, setAccountError] = useState('')
  const signOut = useSignOut()

  useEffect(() => {
    const controller = new AbortController()

    async function loadAccount() {
      try {
        const user = await apiRequest('/auth/me', { signal: controller.signal })
        if (controller.signal.aborted) return
        if (typeof user?.name !== 'string' || typeof user?.email !== 'string') {
          throw new Error('The server returned an invalid account.')
        }
        setAccount(user)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) signOut(error.message)
        else setAccountError(error.message)
      }
    }

    loadAccount()
    return () => controller.abort()
  }, [signOut])

  const nameParts = account?.name.trim().split(/\s+/) ?? []
  const initials = nameParts.length > 1
    ? nameParts[0][0] + nameParts.at(-1)[0]
    : nameParts[0]?.[0] || 'U'

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link to="/home" className={styles.logo}>
          <span className={styles.logoIcon}>🅿</span>
          <span className={styles.logoText}>ParkShare</span>
        </Link>

        {/* Center links */}
        <div className={styles.links}>
          <Link to="/home" className={styles.link}>Find Parking</Link>
          <Link to="/listings/new" className={styles.link}>List Your Space</Link>
          <Link to="/bookings" className={styles.link}>My Bookings</Link>
        </div>

        {/* Right side — avatar + dropdown */}
        <div className={styles.userArea}>
          <button
            className={styles.avatar}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="User menu"
          >
            <span className={styles.avatarInitials}>
              {initials}
            </span>
          </button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <p className={styles.dropdownName}>{account?.name ?? 'User'}</p>
                {account
                  ? <p className={styles.dropdownEmail}>{account.email}</p>
                  : <p className={styles.dropdownEmail} role="status">{accountError || 'Checking your login…'}</p>}
              </div>
              <div className={styles.dropdownDivider} />
              <Link to="/bookings" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                📅 My Bookings
              </Link>
              <Link to="/host" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                🏠 Switch to hosting
              </Link>
              <div className={styles.dropdownDivider} />
              <button className={styles.dropdownLogout} onClick={() => signOut()}>
                🚪 Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
