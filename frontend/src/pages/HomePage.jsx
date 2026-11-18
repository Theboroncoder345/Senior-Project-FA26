import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import DestinationSearch from '../DestinationSearch'
import ParkingFilters from '../ParkingFilters'
import { calculateDistance } from '../distance'
import { DEFAULT_PARKING_FILTERS, hasMapbox, parkingLocation, parkingSpotsPath } from '../parkingApi'
import { useApiResource } from '../api/useApiResource'
import styles from './HomePage.module.css'

const ParkingMap = lazy(() => import('../ParkingMap'))

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [destination, setDestination] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_PARKING_FILTERS)
  const listings = useApiResource(parkingSpotsPath(filters), { authenticated: false })
  const query = search.trim().toLowerCase()
  const maxDistance = filters.maxDistance === '' ? Infinity : Number(filters.maxDistance)

  const filtered = (listings.data ?? [])
    .map(spot => ({
      ...spot,
      distance: destination && parkingLocation(spot)
        ? calculateDistance(destination.latitude, destination.longitude, spot.latitude, spot.longitude)
        : null,
    }))
    .filter(spot => {
      if (destination && Number.isFinite(maxDistance)) return spot.distance !== null && spot.distance <= maxDistance
      return destination || !query || `${spot.address} ${spot.description}`.toLowerCase().includes(query)
    })
    .sort((a, b) => {
      if (filters.sortBy === 'price') return a.price - b.price
      if (destination && filters.sortBy === 'distance') return (a.distance ?? Infinity) - (b.distance ?? Infinity) || 0
      return 0
    })
  const mapped = filtered.filter(parkingLocation)

  function updateSearch(value) {
    setSearch(value)
    setDestination(null)
  }

  return (
    <div className={styles.page}>
      <Navbar />

      {/* ── Hero search banner ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Find parking near you</h1>
          <p className={styles.heroSub}>Explore active parking spots by location and price</p>

          <div className={styles.searchCard}>
            <div className={styles.searchRow}>
              <div className={styles.searchField}>
                <label htmlFor="parking-search" className={styles.searchLabel}>📍 Location</label>
                {hasMapbox ? (
                  <DestinationSearch id="parking-search" inputClassName={styles.searchInput}
                    placeholder="Address or neighborhood…" onQueryChange={updateSearch}
                    onSelect={place => {
                      setDestination(place)
                      setSearch(place.address)
                      setFilters(previous => ({ ...previous, sortBy: 'distance' }))
                    }} />
                ) : (
                  <input id="parking-search" type="search" placeholder="Address or neighborhood…"
                    value={search} onChange={e => updateSearch(e.target.value)} className={styles.searchInput} />
                )}
              </div>
            </div>
            <p role="note">Choose your booking date and time on the listing page. Availability is checked when you book.</p>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <main className={styles.main}>

        {/* List your space CTA */}
        <div className={styles.ctaBanner}>
          <div className={styles.ctaText}>
            <span className={styles.ctaEmoji}>🏠</span>
            <div>
              <p className={styles.ctaTitle}>Have a driveway or parking space?</p>
              <p className={styles.ctaSub}>List it for free and start earning money</p>
            </div>
          </div>
          <Link to="/listings/new" className={styles.ctaBtn}>List your space →</Link>
        </div>

        {/* Section header + filters */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Parking spots</h2>
          <div className={styles.filters}>
            <ParkingFilters filters={filters} setFilters={setFilters}
              hasDestination={Boolean(destination)} inputClassName={styles.filterBtn} />
          </div>
        </div>

        {hasMapbox && (mapped.length > 0 || destination) && (
          <Suspense fallback={<p role="status">Loading map…</p>}>
            <ParkingMap destination={destination} parkingSpots={mapped} />
          </Suspense>
        )}

        {listings.loading && <p role="status">Loading parking spots…</p>}
        {listings.error && (
          <p role="alert">{listings.error.message} <button type="button" onClick={listings.reload}>Try again</button></p>
        )}

        {/* Listings grid */}
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : !listings.loading && !listings.error && (
          <div className={styles.empty}>
            <p className={styles.emptyIcon}>🔍</p>
            <p className={styles.emptyTitle}>No spots found</p>
            <p className={styles.emptySub}>Try a different search or filter</p>
          </div>
        )}
      </main>
    </div>
  )
}

function ListingCard({ listing }) {
  const navigate = useNavigate()

  return (
    <div
      className={`${styles.card} ${!listing.available ? styles.cardUnavailable : ''}`}
      onClick={() => navigate(`/listing/${listing.id}`)}
    >
      <div className={styles.cardImage}>
        <span className={styles.cardImageIcon}>🅿</span>
        {!listing.available && (
          <div className={styles.unavailableBadge}>Unavailable</div>
        )}
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{listing.address}</h3>
        <p className={styles.cardAddress}>{listing.description}</p>
        {listing.distance !== null && <p className={styles.cardAddress}>{listing.distance.toFixed(2)} miles away</p>}

        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>
            <strong>${listing.price}</strong>/hr
          </span>
          {listing.available ? (
            <button className={styles.bookBtn}>Book now</button>
          ) : (
            <button className={styles.bookBtn} disabled>Unavailable</button>
          )}
        </div>
      </div>
    </div>
  )
}
