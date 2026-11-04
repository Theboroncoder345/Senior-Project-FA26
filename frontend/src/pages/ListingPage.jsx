import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import styles from './ListingPage.module.css'

// Same mock data as HomePage — swap with real API call later
const MOCK_LISTINGS = [
  {
    id: 1,
    title: 'Private Driveway — Downtown',
    address: '142 Main St, Springfield',
    lat: 39.7817,
    lng: -89.6501,
    price: 8,
    type: 'Driveway',
    available: true,
    description:
      'A spacious private driveway just one block from downtown. Easy access, no tight turns. Perfect for events, work, or day trips into the city.',
    amenities: ['Well lit', 'Easy access', 'Near transit', 'Paved surface'],
    host: { name: 'James R.', joined: 'Sept 2026' },
  },
  {
    id: 2,
    title: 'Covered Spot Near Stadium',
    address: '88 Park Ave, Springfield',
    lat: 39.785,
    lng: -89.644,
    price: 12,
    type: 'Covered',
    available: true,
    description:
      'Covered parking spot just two blocks from the stadium. Stay dry on game days or during bad weather. Very secure neighborhood.',
    amenities: ['Covered', 'Secure', 'Near stadium', 'Paved surface'],
    host: { name: 'Maria T.', joined: 'Oct 2026' },
  },
  {
    id: 3,
    title: 'Open Lot — City Center',
    address: '300 Elm Blvd, Springfield',
    lat: 39.779,
    lng: -89.652,
    price: 5,
    type: 'Lot',
    available: false,
    description:
      'Open surface lot in the heart of the city. Great for quick errands or shopping. Currently unavailable — check back soon.',
    amenities: ['High capacity', 'Central location', 'Flat surface'],
    host: { name: 'Derek S.', joined: 'Oct 2026' },
  },
  {
    id: 4,
    title: 'Quiet Residential Driveway',
    address: '17 Oak Lane, Springfield',
    lat: 39.775,
    lng: -89.661,
    price: 6,
    type: 'Driveway',
    available: true,
    description:
      'A calm, quiet driveway on a residential street. Perfect if you need to park for a few hours without the noise of downtown.',
    amenities: ['Quiet area', 'Easy access', 'Well lit'],
    host: { name: 'Sandra K.', joined: 'Nov 2026' },
  },
  {
    id: 5,
    title: 'Garage Spot — Midtown',
    address: '500 Commerce Dr, Springfield',
    lat: 39.783,
    lng: -89.647,
    price: 15,
    type: 'Garage',
    available: true,
    description:
      'Indoor garage spot in midtown. Best option for overnight or long-term parking. Your car stays safe and out of the elements.',
    amenities: ['Indoor', 'Overnight ok', 'Security camera', 'Paved surface'],
    host: { name: 'Tony M.', joined: 'Oct 2026' },
  },
  {
    id: 6,
    title: 'Driveway Near University',
    address: '23 College Rd, Springfield',
    lat: 39.787,
    lng: -89.655,
    price: 7,
    type: 'Driveway',
    available: true,
    description:
      'Convenient driveway just a short walk from campus. Great for students, visitors, and anyone attending university events.',
    amenities: ['Near campus', 'Well lit', 'Easy access'],
    host: { name: 'Priya N.', joined: 'Nov 2026' },
  },
]

const TYPE_COLORS = {
  Driveway: { bg: '#eff8ff', color: '#1a7fd4' },
  Covered:  { bg: '#f0fdf4', color: '#16a34a' },
  Lot:      { bg: '#fff7ed', color: '#ea580c' },
  Garage:   { bg: '#faf5ff', color: '#9333ea' },
}

const MOCK_USER = { firstName: 'Christopher', lastName: 'M', email: 'chris@example.com' }

export default function ListingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const listing = MOCK_LISTINGS.find((l) => l.id === Number(id))

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [hours, setHours] = useState(1)
  const [booked, setBooked] = useState(false)

  if (!listing) {
    return (
      <div className={styles.page}>
        <Navbar user={MOCK_USER} />
        <div className={styles.notFound}>
          <p className={styles.notFoundIcon}>🅿</p>
          <h2>Listing not found</h2>
          <button className={styles.backBtn} onClick={() => navigate('/home')}>← Back to listings</button>
        </div>
      </div>
    )
  }

  const typeStyle = TYPE_COLORS[listing.type] ?? { bg: '#f1f5f9', color: '#475569' }
  const total = listing.price * hours

  const handleBook = (e) => {
    e.preventDefault()
    // TODO: POST to backend booking endpoint
    setBooked(true)
  }

  return (
    <div className={styles.page}>
      <Navbar user={MOCK_USER} />

      <div className={styles.container}>

        {/* Back link */}
        <button className={styles.back} onClick={() => navigate('/home')}>
          ← Back to listings
        </button>

        {/* Title row */}
        <div className={styles.titleRow}>
          <div>
            <div className={styles.badgeRow}>
              <span
                className={styles.typeBadge}
                style={{ background: typeStyle.bg, color: typeStyle.color }}
              >
                {listing.type}
              </span>
              {!listing.available && (
                <span className={styles.unavailableBadge}>Unavailable</span>
              )}
            </div>
            <h1 className={styles.title}>{listing.title}</h1>
            <p className={styles.address}>📍 {listing.address}</p>
          </div>
          <div className={styles.priceTag}>
            <span className={styles.priceAmount}>${listing.price}</span>
            <span className={styles.priceUnit}>/hr</span>
          </div>
        </div>

        {/* ── Photo gallery ── */}
        <div className={styles.gallery}>
          <div className={styles.mainPhoto}>
            <div className={styles.photoPlaceholder}>
              <span className={styles.photoPlaceholderIcon}>📷</span>
              <p className={styles.photoPlaceholderText}>Photos here</p>
            </div>
            {!listing.available && (
              <div className={styles.photoOverlayBadge}>Unavailable</div>
            )}
          </div>
        </div>

        {/* Two column layout */}
        <div className={styles.layout}>

          {/* LEFT — map + details */}
          <div className={styles.left}>

            {/* ── MAP PLACEHOLDER ───────────────────────────────────
                Your teammate's map component goes here.
                Replace the entire .mapPlaceholder div with:
                <MapComponent lat={listing.lat} lng={listing.lng} />
            ──────────────────────────────────────────────────────── */}
            <div className={styles.mapPlaceholder}>
              <div className={styles.mapInner}>
                <span className={styles.mapIcon}>🗺️</span>
                <p className={styles.mapLabel}>Map coming soon</p>
                <p className={styles.mapCoords}>
                  {listing.lat}, {listing.lng}
                </p>
                <p className={styles.mapNote}>
                  Teammate's map component will render here
                </p>
              </div>
            </div>

            {/* About */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>About this spot</h2>
              <p className={styles.description}>{listing.description}</p>
            </div>

            {/* Amenities */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Amenities</h2>
              <div className={styles.amenities}>
                {listing.amenities.map((a) => (
                  <span key={a} className={styles.amenity}>✓ {a}</span>
                ))}
              </div>
            </div>

            {/* Host */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Hosted by</h2>
              <div className={styles.hostCard}>
                <div className={styles.hostAvatar}>{listing.host.name[0]}</div>
                <div>
                  <p className={styles.hostName}>{listing.host.name}</p>
                  <p className={styles.hostJoined}>Member since {listing.host.joined}</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — booking card */}
          <div className={styles.right}>
            <div className={styles.bookingCard}>
              {booked ? (
                <div className={styles.successState}>
                  <span className={styles.successIcon}>🎉</span>
                  <h3 className={styles.successTitle}>Booking requested!</h3>
                  <p className={styles.successSub}>
                    Your request has been sent. The host will confirm shortly.
                  </p>
                  <button className={styles.submitBtn} onClick={() => setBooked(false)}>
                    Book again
                  </button>
                </div>
              ) : (
                <>
                  <h3 className={styles.bookingTitle}>Reserve this spot</h3>
                  <p className={styles.bookingPrice}>
                    <strong>${listing.price}</strong> / hr
                  </p>

                  {listing.available ? (
                    <form onSubmit={handleBook} className={styles.bookingForm}>
                      <div className={styles.field}>
                        <label className={styles.label}>Date</label>
                        <input
                          type="date"
                          className={styles.input}
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Start time</label>
                        <input
                          type="time"
                          className={styles.input}
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Duration (hours)</label>
                        <select
                          className={styles.input}
                          value={hours}
                          onChange={(e) => setHours(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
                            <option key={h} value={h}>{h} hr{h > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.totalRow}>
                        <span>Total</span>
                        <span className={styles.totalAmount}>${total}</span>
                      </div>

                      <button type="submit" className={styles.submitBtn}>
                        Request to book
                      </button>
                      <p className={styles.bookingNote}>
                        You won't be charged until the host confirms.
                      </p>
                    </form>
                  ) : (
                    <div className={styles.unavailableMsg}>
                      <p>This spot is currently unavailable.</p>
                      <button
                        className={styles.submitBtn}
                        style={{ marginTop: '1rem', background: '#94a3b8', boxShadow: 'none' }}
                        onClick={() => navigate('/home')}
                      >
                        Find another spot
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
