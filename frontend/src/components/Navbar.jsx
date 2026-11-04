import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar({ user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    // TODO: clear auth token/session with backend
    navigate('/login')
  }

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
              {user?.firstName?.[0] ?? 'U'}{user?.lastName?.[0] ?? ''}
            </span>
          </button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <p className={styles.dropdownName}>{user?.firstName ?? 'User'} {user?.lastName ?? ''}</p>
                <p className={styles.dropdownEmail}>{user?.email ?? ''}</p>
              </div>
              <div className={styles.dropdownDivider} />
              <Link to="/profile" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                👤 My Profile
              </Link>
              <Link to="/listings" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                🏠 My Listings
              </Link>
              <Link to="/bookings" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                📅 My Bookings
              </Link>
              <div className={styles.dropdownDivider} />
              <button className={styles.dropdownLogout} onClick={handleLogout}>
                🚪 Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
