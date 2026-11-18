import { lazy, Suspense, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { hasMapbox, parkingLocation } from '../parkingApi'
import { apiRequest } from '../api/client'
import { useApiResource, useSignOut } from '../api/useApiResource'
import styles from './ListingPage.module.css'

const ParkingMap = lazy(() => import('../ParkingMap'))

// Generate time options in 15-minute increments (12:00 AM → 11:45 PM)
function generateTimeSlots() {
  const slots = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour12 = h % 12 || 12
      const ampm   = h < 12 ? 'AM' : 'PM'
      const label  = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
      const value  = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      slots.push({ label, value })
    }
  }
  return slots
}
const TIME_SLOTS = generateTimeSlots()

export default function ListingPage() {
  const { id } = useParams()
  return <ListingDetail key={id} id={id} />
}

function ListingDetail({ id }) {
  const navigate = useNavigate()
  const resource = useApiResource(`/parking-spots/${encodeURIComponent(id)}`, { authenticated: false })
  const listing = resource.data
  const signOut = useSignOut()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [booked, setBooked] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')

  if (!listing) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.notFound}>
          {resource.loading
            ? <p role="status">Loading listing…</p>
            : <h2 role="alert">{resource.error?.status === 404 ? 'Listing not found' : resource.error?.message}</h2>}
          <button className={styles.backBtn} onClick={() => navigate('/home')}>← Back to listings</button>
        </div>
      </div>
    )
  }

  const start = new Date(`${date}T${startTime}`)
  const end = new Date(`${date}T${endTime}`)
  const hours = (end - start) / 3600000
  const total = hours > 0 ? (listing.price * hours).toFixed(2) : null

  async function handleBook(event) {
    event.preventDefault()
    if (submitting) return
    setBookingError('')
    if (!(hours > 0)) {
      setBookingError('Choose a date and an end time after the start time.')
      return
    }
    setSubmitting(true)
    try {
      const reservation = await apiRequest('/reservations', {
        method: 'POST',
        body: { spot_id: listing.id, start_time: start.toISOString(), end_time: end.toISOString() },
      })
      setBooked(reservation)
    } catch (error) {
      if (error.status === 401) signOut(error.message)
      else setBookingError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.container}>

        {/* Back link */}
        <button className={styles.back} onClick={() => navigate('/home')}>
          ← Back to listings
        </button>

        {/* Title row */}
        <div className={styles.titleRow}>
          <div>
            {!listing.available && <span className={styles.unavailableBadge}>Unavailable</span>}
            <h1 className={styles.title}>{listing.address}</h1>
          </div>
          <div className={styles.priceTag}>
            <span className={styles.priceAmount}>${listing.price}</span>
            <span className={styles.priceUnit}>/hr</span>
          </div>
        </div>

        {/* Two column layout */}
        <div className={styles.layout}>

          {/* LEFT — map + details */}
          <div className={styles.left}>

            {hasMapbox && parkingLocation(listing) && (
              <Suspense fallback={<p role="status">Loading map…</p>}>
                <ParkingMap parkingSpots={[listing]} />
              </Suspense>
            )}

            {/* About */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>About this spot</h2>
              <p className={styles.description}>{listing.description}</p>
            </div>

          </div>

          {/* RIGHT — booking card */}
          <div className={styles.right}>
            <div className={styles.bookingCard}>
              {booked ? (
                <div className={styles.successState}>
                  <span className={styles.successIcon}>🎉</span>
                  <h3 className={styles.successTitle}>Parking reserved!</h3>
                  <p className={styles.successSub}>
                    Your reservation is saved.
                  </p>
                  <button className={styles.submitBtn} onClick={() => navigate(`/bookings?reservation=${booked.id}`)}>
                    View reservation
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
                        <select
                          className={styles.input}
                          value={startTime}
                          onChange={(e) => { setStartTime(e.target.value); setEndTime('') }}
                          required
                        >
                          <option value="">Select a time…</option>
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot.value} value={slot.value}>
                              {slot.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>End time</label>
                        <select
                          className={styles.input}
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                          required
                          disabled={!startTime}
                        >
                          <option value="">Select end time…</option>
                          {TIME_SLOTS.filter((slot) => slot.value > startTime).map((slot) => {
                            const [sh, sm] = startTime.split(':').map(Number)
                            const [eh, em] = slot.value.split(':').map(Number)
                            const diff = (eh * 60 + em) - (sh * 60 + sm)
                            const hrs = diff / 60
                            return (
                              <option key={slot.value} value={slot.value}>
                                {slot.label} · {hrs} hr{hrs !== 1 ? 's' : ''}
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      {total !== null && (
                        <div className={styles.totalRow}>
                          <span>Estimated total</span>
                          <span className={styles.totalAmount}>${total}</span>
                        </div>
                      )}
                      {bookingError && <p role="alert">{bookingError}</p>}
                      <button type="submit" className={styles.submitBtn} disabled={submitting}>
                        {submitting ? 'Reserving…' : 'Reserve parking'}
                      </button>
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
