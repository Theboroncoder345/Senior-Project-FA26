import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiResource, useSignOut } from '../api/useApiResource'
import styles from './Navbar.module.css'

export default function Navbar({ accountResource }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const localAccount = useApiResource(accountResource ? null : '/auth/me')
  const { data: account, error: accountError } = accountResource ?? localAccount
  const signOut = useSignOut()

  const nameParts = account?.name?.trim().split(/\s+/) ?? []
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
          <Link to={account?.is_owner ? "/listings/new" : "/host"} className={styles.link}>List Your Space</Link>
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
                  : <p className={styles.dropdownEmail} role="status">{accountError?.message || 'Checking your login…'}</p>}
              </div>
              <div className={styles.dropdownDivider} />
              <Link to="/bookings" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                📅 My Bookings
              </Link>
              <Link to="/profile" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                Profile
              </Link>
              <Link to="/host" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                {account?.is_owner ? 'Host Dashboard' : 'Become a host'}
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
