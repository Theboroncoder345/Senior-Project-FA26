import { Link } from 'react-router-dom'
import styles from './FavoriteButton.module.css'

export default function FavoriteButton({ listing, favorites }) {
  const saved = favorites.saved.has(listing.id)
  const error = favorites.errors.get(listing.id)
  if (!favorites.signedIn) {
    return <Link to="/login" className={styles.button} aria-label="Sign in to save parking">♡</Link>
  }
  return (
    <div className={styles.control}>
      <button type="button" className={styles.button}
        aria-label={`${saved ? 'Remove saved' : 'Save'} parking at ${listing.title || listing.address}`}
        aria-pressed={saved} disabled={favorites.loading || Boolean(favorites.error) || favorites.pending.has(listing.id)}
        onClick={() => favorites.toggle(listing)}>
        <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  )
}
