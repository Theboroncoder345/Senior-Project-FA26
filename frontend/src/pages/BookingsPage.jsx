import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiRequest } from '../api/client'
import { useApiResource, useSignOut } from '../api/useApiResource'
import styles from './BookingsPage.module.css'

const TABS = ['All', 'Upcoming', 'Past']

function isPast(booking, now) {
  return Date.parse(booking.end_time) <= now
}

function formatTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState('All')
  const [pending, setPending] = useState(null)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [params, setParams] = useSearchParams()
  const selected = params.get('reservation')
  const signOut = useSignOut()
  const bookings = useApiResource('/users/me/reservations')
  const detail = useApiResource(selected ? `/reservations/${encodeURIComponent(selected)}` : null)
  const listings = useApiResource('/parking-spots', { authenticated: false })
  const spotById = new Map(listings.data?.map(spot => [spot.id, spot]))
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  const all = bookings.data ?? []
  const past = all.filter(booking => isPast(booking, now)).length
  const visible = all.filter(booking =>
    activeTab === 'All' || (activeTab === 'Past') === isPast(booking, now)
  )

  async function cancelBooking(id) {
    if (pending !== null || !window.confirm('Cancel this reservation?')) return
    setPending(id)
    setActionError('')
    setMessage('')
    try {
      await apiRequest(`/reservations/${id}`, { method: 'DELETE' })
      if (String(id) === selected) setParams({}, { replace: true })
      bookings.reload()
      setMessage('Reservation cancelled.')
    } catch (error) {
      if (error.status === 401) signOut(error.message)
      else setActionError(error.message)
    } finally {
      setPending(null)
    }
  }

  function renderBooking(booking) {
    return (
      <BookingCard key={booking.id} booking={booking} spot={spotById.get(booking.spot_id)}
        past={isPast(booking, now)} onCancel={cancelBooking} pending={pending} showDetailsLink={!selected} />
    )
  }

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Bookings</h1>
            <p className={styles.subtitle}>Track and manage your parking reservations</p>
          </div>
          <Link className={styles.findBtn} to="/home">+ Find parking</Link>
        </div>

        {actionError && <p role="alert">{actionError}</p>}
        {message && <p role="status">{message}</p>}
        {listings.error && <p role="status">Listing addresses are temporarily unavailable.</p>}

        {selected ? (
          <>
            <Link className={styles.viewBtn} to="/bookings">← All bookings</Link>
            {(detail.loading || (detail.data && bookings.loading)) && <p role="status">Loading reservation…</p>}
            {detail.error && <p role="alert">{detail.error.message}</p>}
            {detail.data && bookings.data && (
              all.some(booking => booking.id === detail.data.id)
                ? <div className={styles.list}>{renderBooking(detail.data)}</div>
                : <p role="alert">This reservation is outside your personal bookings.</p>
            )}
            {bookings.error && <p role="alert">{bookings.error.message}</p>}
          </>
        ) : (
          <>
            {bookings.data && (
              <div className={styles.summaryRow}>
                <SummaryCard icon="📅" label="Upcoming" count={all.length - past} />
                <SummaryCard icon="🕒" label="Past" count={past} />
              </div>
            )}
            <div className={styles.tabs}>
              {TABS.map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}>
                  {tab}
                </button>
              ))}
            </div>
            {bookings.loading && <p role="status">Loading bookings…</p>}
            {bookings.error && (
              <p role="alert">{bookings.error.message} <button type="button" onClick={bookings.reload}>Try again</button></p>
            )}
            {bookings.data && (visible.length > 0 ? (
              <div className={styles.list}>{visible.map(renderBooking)}</div>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📭</span>
                <p className={styles.emptyTitle}>No bookings here</p>
                <Link className={styles.findBtn} to="/home">Find parking</Link>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ icon, label, count }) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryIcon}>{icon}</span>
      <div>
        <p className={styles.summaryCount}>{count}</p>
        <p className={styles.summaryLabel}>{label}</p>
      </div>
    </div>
  )
}

function BookingCard({ booking, spot, past, onCancel, pending, showDetailsLink }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardIcon}>🅿</div>
      <div className={styles.cardDetails}>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{spot?.address ?? `Parking spot #${booking.spot_id}`}</h3>
          <span className={styles.statusBadge}>{past ? 'Past' : 'Upcoming'}</span>
        </div>
        <p className={styles.cardMeta}>{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</p>
      </div>
      <div className={styles.cardRight}>
        {booking.total_cost != null && (
          <>
            <p className={styles.cardTotal}>${Number(booking.total_cost).toFixed(2)}</p>
            <p className={styles.cardTotalLabel}>Reservation total</p>
          </>
        )}
        <div className={styles.cardActions}>
          <Link className={styles.viewBtn} to={`/listing/${booking.spot_id}`}>View spot</Link>
          {showDetailsLink && (
            <Link className={styles.viewBtn} to={`/bookings?reservation=${booking.id}`}>Details</Link>
          )}
          {!past && (
            <button type="button" className={styles.cancelBtn} disabled={pending !== null}
              onClick={() => onCancel(booking.id)}>
              {pending === booking.id ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
