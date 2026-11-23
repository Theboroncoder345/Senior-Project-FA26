import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import { useFavorites } from '../api/useFavorites'
import Navbar from '../components/Navbar'
import DestinationSearch from '../DestinationSearch'
import ParkingFilters from '../ParkingFilters'
import { calculateDistance } from '../distance'
import { DEFAULT_PARKING_FILTERS, hasMapbox, parkingLocation, parkingSpotsPath } from '../parkingApi'
import { useApiResource } from '../api/useApiResource'
import styles from './HomePage.module.css'

const ParkingMap = lazy(() => import('../ParkingMap'))

export default function HomePage() {
  const favorites = useFavorites()
  const [search, setSearch] = useState('')
  const [destination, setDestination] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_PARKING_FILTERS)
  const [searchVersion, setSearchVersion] = useState(0)
  const hasWindow = Boolean(filters.start || filters.end)
  const validWindow = !hasWindow || (filters.start && filters.end
    && new Date(filters.start) < new Date(filters.end))
  const listings = useApiResource(validWindow ? parkingSpotsPath(filters) : null, { authenticated: false })
  const bookingQuery = hasWindow && validWindow
    ? '?' + new URLSearchParams({ start: filters.start, end: filters.end }).toString()
    : ''
  const listingHref = useCallback(id => `/listing/${id}${bookingQuery}`, [bookingQuery])

  function resetSearch() {
    setFilters(DEFAULT_PARKING_FILTERS)
    updateSearch('')
    setSearchVersion(version => version + 1)
  }
  const query = search.trim().toLowerCase()
  const maxDistance = Number(filters.maxDistance)

  const filtered = useMemo(() => (listings.data ?? [])
    .map(spot => ({
      ...spot,
      distance: destination && parkingLocation(spot)
        ? calculateDistance(destination.latitude, destination.longitude, spot.latitude, spot.longitude)
        : null,
    }))
    .filter(spot => {
      if (destination) return spot.distance !== null && spot.distance <= maxDistance
      return !query || `${spot.title ?? ''} ${spot.address} ${spot.description}`.toLowerCase().includes(query)
    })
    .sort((a, b) => {
      if (destination) return a.distance - b.distance
      return filters.sortBy === 'price' ? a.price - b.price : 0
    }), [listings.data, destination, maxDistance, query, filters.sortBy])
  const mapped = useMemo(() => filtered.filter(parkingLocation), [filtered])

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
                  <DestinationSearch key={searchVersion} id="parking-search" inputClassName={styles.searchInput}
                    placeholder="Address or neighborhood…" onQueryChange={updateSearch}
                    onSelect={place => {
                      setDestination(place)
                      setSearch(place.address)
                    }} />
                ) : (
                  <input id="parking-search" type="search" placeholder="Address or neighborhood…"
                    value={search} onChange={e => updateSearch(e.target.value)} className={styles.searchInput} />
                )}
              </div>
            </div>
            <div className={styles.searchRow}>
              {['start', 'end'].map(field => (
                <div key={field} className={styles.searchField}>
                  <label htmlFor={`search-${field}`} className={styles.searchLabel}>
                    {field === 'start' ? 'Start date and time' : 'End date and time'}
                  </label>
                  <input id={`search-${field}`} type="datetime-local" className={styles.searchInput}
                    value={filters[field]} onChange={event => {
                      const value = event.target.value
                      setFilters(previous => ({ ...previous, [field]: value }))
                    }} />
                </div>
              ))}
            </div>
            {!validWindow && <p role="status">Choose both times with the end after the start.</p>}
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
              <p className={styles.ctaSub}>Share it with drivers looking for parking</p>
            </div>
          </div>
          <Link to="/host" className={styles.ctaBtn}>List your space →</Link>
        </div>

        {/* Section header + filters */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Parking spots</h2>
          <div className={styles.filters}>
            <ParkingFilters filters={filters} setFilters={setFilters}
              onReset={resetSearch} hasDestination={Boolean(destination)} inputClassName={styles.filterBtn} />
          </div>
        </div>

        {hasMapbox && (mapped.length > 0 || destination) && (
          <Suspense fallback={<p role="status">Loading map…</p>}>
            <ParkingMap destination={destination} parkingSpots={mapped} listingHref={listingHref} />
          </Suspense>
        )}

        {listings.loading && <p role="status">Loading parking spots…</p>}
        {listings.error && (
          <p role="alert">{listings.error.message} <button type="button" onClick={listings.reload}>Try again</button></p>
        )}

        {favorites.error && <p role="alert">Saved parking is unavailable. <button onClick={favorites.reload}>Try again</button></p>}

        {/* Listings grid */}
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} href={listingHref(listing.id)}
                favorites={favorites} hasWindow={hasWindow} />
            ))}
          </div>
        ) : validWindow && !listings.loading && !listings.error && (
          <div className={styles.empty}>
            <p className={styles.emptyIcon}>🔍</p>
            <p className={styles.emptyTitle}>
              {destination
                ? `No parking spots found within ${maxDistance} ${maxDistance === 1 ? 'mile' : 'miles'}.`
                : hasWindow ? 'No parking spots match this time window and filters' : 'No spots match your search'}
            </p>
            <p className={styles.emptySub}>
              {destination ? 'Try increasing the search radius.' : 'Try a different search or filter'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
