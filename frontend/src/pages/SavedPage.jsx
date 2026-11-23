import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ListingCard from '../components/ListingCard'
import { useFavorites } from '../api/useFavorites'
import styles from './HomePage.module.css'

export default function SavedPage() {
  const favorites = useFavorites({ requireAccount: true })
  const spots = [...favorites.saved.values()]
  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.sectionHeader}><h1 className={styles.sectionTitle}>Saved parking</h1></div>
        {favorites.loading && <p role="status">Loading saved parking…</p>}
        {favorites.error && (
          <p role="alert">{favorites.error} <button onClick={favorites.reload}>Try again</button></p>
        )}
        {!favorites.loading && !favorites.error && (spots.length ? (
          <div className={styles.grid}>
            {spots.map(spot => <ListingCard key={spot.id} listing={spot}
              href={`/listing/${spot.id}`} favorites={favorites} />)}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No saved parking yet</p>
            <p>Use the heart on a listing to find it here later.</p>
            <Link to="/home">Find parking</Link>
          </div>
        ))}
      </main>
    </div>
  )
}
