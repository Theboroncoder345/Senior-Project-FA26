import { Link } from 'react-router-dom'
import ListingPhoto from './ListingPhoto'
import FavoriteButton from './FavoriteButton'
import styles from '../pages/HomePage.module.css'

export default function ListingCard({ listing, href, favorites, hasWindow }) {
  return (
    <article className={`${styles.card} ${!listing.available ? styles.cardUnavailable : ''}`}>
      <div className={styles.cardImage}>
        <ListingPhoto url={listing.photo_urls?.[0]} alt={`${listing.title || listing.address} parking`} />
        <div className={styles.availabilityBadge}>
          {listing.available ? (hasWindow ? 'Available for your dates' : 'Available to book') : 'Unavailable'}
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <h3 className={styles.cardTitle}>{listing.title || listing.address}</h3>
          <FavoriteButton listing={listing} favorites={favorites} />
        </div>
        {listing.title && <p className={`${styles.cardAddress} ${styles.cardLocation}`} title={listing.address}>{listing.address}</p>}
        <p className={styles.cardAddress}>
          {listing.parking_type || 'Parking space'}
          {Number.isFinite(listing.distance) && ` · ${listing.distance.toFixed(2)} mi away`}
        </p>
        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}><strong>${Number(listing.price).toFixed(2)}</strong>/hr</span>
          <Link to={href} className={styles.bookBtn}>{listing.available ? 'View and book' : 'View listing'}</Link>
        </div>
      </div>
    </article>
  )
}
