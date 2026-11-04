import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import styles from './HomePage.module.css'

// Placeholder listings — swap with real API data later
const MOCK_LISTINGS = [
  {
    id: 1,
    title: 'Private Driveway — Downtown',
    address: '142 Main St, Springfield',
    price: 8,
    rating: null,
    reviews: 0,
    type: 'Driveway',
    available: true,
    image: null,
  },
  {
    id: 2,
    title: 'Covered Spot Near Stadium',
    address: '88 Park Ave, Springfield',
    price: 12,
    rating: null,
    reviews: 0,
    type: 'Covered',
    available: true,
    image: null,
  },
  {
    id: 3,
    title: 'Open Lot — City Center',
    address: '300 Elm Blvd, Springfield',
    price: 5,
    rating: null,
    reviews: 0,
    type: 'Lot',
    available: false,
    image: null,
  },
  {
    id: 4,
    title: 'Quiet Residential Driveway',
    address: '17 Oak Lane, Springfield',
    price: 6,
    rating: null,
    reviews: 0,
    type: 'Driveway',
    available: true,
    image: null,
  },
  {
    id: 5,
    title: 'Garage Spot — Midtown',
    address: '500 Commerce Dr, Springfield',
    price: 15,
    rating: null,
    reviews: 0,
    type: 'Garage',
    available: true,
    image: null,
  },
  {
    id: 6,
    title: 'Driveway Near University',
    address: '23 College Rd, Springfield',
    price: 7,
    rating: null,
    reviews: 0,
    type: 'Driveway',
    available: true,
    image: null,
  },
]

const TYPE_COLORS = {
  Driveway: { bg: '#eff8ff', color: '#1a7fd4' },
  Covered:  { bg: '#f0fdf4', color: '#16a34a' },
  Lot:      { bg: '#fff7ed', color: '#ea580c' },
  Garage:   { bg: '#faf5ff', color: '#9333ea' },
}

// Mock logged-in user — replace with real auth context later
const MOCK_USER = { firstName: 'Christopher', lastName: 'M', email: 'chris@example.com' }

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const types = ['All', 'Driveway', 'Covered', 'Lot', 'Garage']

  const filtered = MOCK_LISTINGS.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.address.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All' || l.type === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className={styles.page}>
      <Navbar user={MOCK_USER} />

      {/* ── Hero search banner ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Find parking near you</h1>
          <p className={styles.heroSub}>Search driveways, lots, and garages available to book right now</p>
          <div className={styles.searchBar}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by address or neighborhood…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            <button className={styles.searchBtn}>Search</button>
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
          <h2 className={styles.sectionTitle}>Available spots nearby</h2>
          <div className={styles.filters}>
            {types.map((t) => (
              <button
                key={t}
                className={`${styles.filterBtn} ${filter === t ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Listings grid */}
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
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
  const typeStyle = TYPE_COLORS[listing.type] ?? { bg: '#f1f5f9', color: '#475569' }

  return (
    <div
      className={`${styles.card} ${!listing.available ? styles.cardUnavailable : ''}`}
      onClick={() => navigate(`/listing/${listing.id}`)}
    >
      {/* Image placeholder */}
      <div className={styles.cardImage}>
        <span className={styles.cardImageIcon}>🅿</span>
        {!listing.available && (
          <div className={styles.unavailableBadge}>Unavailable</div>
        )}
      </div>

      <div className={styles.cardBody}>
        {/* Type badge */}
        <span
          className={styles.typeBadge}
          style={{ background: typeStyle.bg, color: typeStyle.color }}
        >
          {listing.type}
        </span>

        <h3 className={styles.cardTitle}>{listing.title}</h3>
        <p className={styles.cardAddress}>📍 {listing.address}</p>

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
