import { lazy, Suspense, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { hasMapbox, parkingLocation } from '../parkingApi'
import { apiRequest } from '../api/client'
import { useApiResource, useSignOut } from '../api/useApiResource'
import styles from './ListingPage.module.css'

const ParkingMap = lazy(() => import('../ParkingMap'))

export default function ListingPage() {
  const { id } = useParams()
  return <ListingDetail key={id} id={id} />
}

function ListingDetail({ id }) {
  const navigate = useNavigate()
  const resource = useApiResource(`/parking-spots/${encodeURIComponent(id)}`, { authenticated: false })
  const listing = resource.data
  const signOut = useSignOut()
  const [params] = useSearchParams()
  const [startTime, setStartTime] = useState(() => params.get('start') ?? '')
  const [endTime, setEndTime] = useState(() => params.get('end') ?? '')
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

  const start = new Date(startTime)
  const end = new Date(endTime)
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
            <h1 className={styles.title}>{listing.title || listing.address}</h1>
            {listing.title && <p>{listing.address}</p>}
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

            {listing.photo_urls?.length ? (
              <div className={styles.photos}>
                {listing.photo_urls.map((url, index) => <ListingPhoto key={`${index}-${url}`} url={url} index={index} />)}
              </div>
            ) : <p>Photos have not been added for this listing.</p>}

            {/* About */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>About this spot</h2>
              {listing.parking_type && <p>{listing.parking_type}</p>}
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
                        <label htmlFor="booking-start" className={styles.label}>Start date and time</label>
                        <input id="booking-start" type="datetime-local" className={styles.input}
                          value={startTime} onChange={event => setStartTime(event.target.value)} required />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="booking-end" className={styles.label}>End date and time</label>
                        <input id="booking-end" type="datetime-local" className={styles.input}
                          value={endTime} onChange={event => setEndTime(event.target.value)} required />
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


function ListingPhoto({ url, index }) {
  const [failed, setFailed] = useState(false)
  return failed ? <p>Photo {index + 1} is unavailable.</p> : (
    <img src={url} alt={`Parking spot photo ${index + 1}`} loading="lazy"
      referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  )
}
