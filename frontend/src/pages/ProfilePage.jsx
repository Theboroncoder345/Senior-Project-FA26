import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useApiResource } from '../api/useApiResource'
import styles from './HostDashboardPage.module.css'

export default function ProfilePage() {
  const account = useApiResource('/auth/me')
  const user = account.data

  return (
    <div className={styles.page}>
      <Navbar accountResource={account} />
      <main className={styles.main}>
        <h1 className={styles.title}>Profile</h1>
        {account.loading && <p role="status">Loading your profile…</p>}
        {account.error && <p role="alert">{account.error.message} <button onClick={account.reload}>Try again</button></p>}
        {user && (
          <>
            <dl>
              <dt>Name</dt><dd>{user.name}</dd>
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Account role</dt><dd>{user.is_owner ? 'Host and renter' : 'Renter'}</dd>
              {user.created_at && (
                <><dt>Member since</dt><dd>{new Date(user.created_at).toLocaleDateString()}</dd></>
              )}
            </dl>
            <Link to="/host" className={styles.addBtn}>{user.is_owner ? 'Host Dashboard' : 'Become a host'}</Link>
          </>
        )}
      </main>
    </div>
  )
}
