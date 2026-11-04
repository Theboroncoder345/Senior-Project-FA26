import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import ParkingMap from '../ParkingMap'
import DestinationSearch from '../DestinationSearch'
import ParkingFilters from '../ParkingFilters'
import parkingData from '../parkingData'
import { calculateDistance } from '../distance'
import styles from './HomePage.module.css'

const TYPE_COLORS = {
  Driveway: { bg: '#eff8ff', color: '#1a7fd4' },
  Covered:  { bg: '#f0fdf4', color: '#16a34a' },
  Lot:      { bg: '#fff7ed', color: '#ea580c' },
  Garage:   { bg: '#faf5ff', color: '#9333ea' },
}

const MOCK_USER = { firstName: 'Christopher', lastName: 'M', email: 'chris@example.com' }

export default function HomePage() {
  const [destination, setDestination] = useState(null)
  const [filters, setFilters] = useState({
    maxPrice: '',
    maxDistance: '',
    covered: false,
    evCharging: false,
    sortBy: 'distance',
  })

  // Use teammate's distance calculation + filtering logic
  const filteredSpots = useMemo(() => {
    let results = parkingData.map((spot) => {
      const distance = destination
        ? calculateDistance(destination.latitude, destination.longitude, spot.latitude, spot.longitude)
        : null
      return { ...spot, distance }
    })

    if (filters.maxPrice !== '')
      results = results.filter((s) => s.price <= Number(filters.maxPrice))

    if (filters.maxDistance !== '' && destination)
      results = results.filter((s) => s.distance <= Number(filters.maxDistance))

    if (filters.covered)
      results = results.filter((s) => s.covered)

    if (filters.evCharging)
      results = results.filter((s) => s.evCharging)

    if (filters.sortBy === 'price')
      results.sort((a, b) => a.price - b.price)
    else if (destination)
      results.sort((a, b) => a.distance - b.distance)

    return results
  }, [destination, filters])

  return (
    <div className={styles.page}>
      <Navbar user={MOCK_USER} />

      {/* ── Hero search banner ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Find parking near you</h1>
          <p className={styles.heroSub}>Search driveways, lots, and garages available to book right now</p>
          {/* Teammate's destination search */}
          <div className={styles.searchWrapper}>
            <DestinationSearch onSelect={setDestination} />
          </div>
        </div>
      </section>

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
          <a href="/listings/new" className={styles.ctaBtn}>List your space →</a>
        </div>

        {/* Filters */}
        <ParkingFilters filters={filters} setFilters={setFilters} />

        {/* Map + listings side by side */}
        <div className={styles.mapListLayout}>

          {/* Left — listings */}
          <div className={styles.listingsCol}>
            <h2 className={styles.sectionTitle}>
              {filteredSpots.length} spot{filteredSpots.length !== 1 ? 's' : ''} available
            </h2>

            {filteredSpots.length > 0 ? (
              <div className={styles.listingsList}>
                {filteredSpots.map((spot) => (
                  <ListingCard key={spot.id} spot={spot} />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p className={styles.emptyIcon}>🔍</p>
                <p className={styles.emptyTitle}>No spots found</p>
                <p className={styles.emptySub}>Try adjusting your filters</p>
              </div>
            )}
          </div>

          {/* Right — teammate's map */}
          <div className={styles.mapCol}>
            <ParkingMap destination={destination} parkingSpots={filteredSpots} />
          </div>

        </div>
      </main>
    </div>
  )
}

function ListingCard({ spot }) {
  const navigate = useNavigate()
  const typeStyle = TYPE_COLORS[spot.parkingType] ?? { bg: '#f1f5f9', color: '#475569' }

  return (
    <div className={styles.card} onClick={() => navigate(`/listing/${spot.id}`)}>
      <div className={styles.cardBody}>
        <span
          className={styles.typeBadge}
          style={{ background: typeStyle.bg, color: typeStyle.color }}
        >
          {spot.parkingType}
        </span>
        <h3 className={styles.cardTitle}>{spot.title}</h3>
        {spot.distance !== null && (
          <p className={styles.cardDistance}>📍 {spot.distance.toFixed(2)} miles away</p>
        )}
        <div className={styles.cardTags}>
          {spot.covered && <span className={styles.tag}>✓ Covered</span>}
          {spot.evCharging && <span className={styles.tag}>⚡ EV Charging</span>}
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>
            <strong>${spot.price}</strong>/hr
          </span>
          <button className={styles.bookBtn}>Book now</button>
        </div>
      </div>
    </div>
  )
}
