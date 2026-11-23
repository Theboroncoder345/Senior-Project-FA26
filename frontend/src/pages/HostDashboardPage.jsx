import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import ListingAddressInput from '../components/ListingAddressInput'
import Navbar from '../components/Navbar'
import PhotoEditor from '../components/PhotoEditor'
import ListingPhoto from '../components/ListingPhoto'
import AmenityPicker from '../components/AmenityPicker'
import { apiRequest } from '../api/client'
import { useApiResource, useSignOut } from '../api/useApiResource'
import styles from './HostDashboardPage.module.css'

function formatTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function HostDashboardPage() {
  const account = useApiResource('/auth/me')
  const owner = account.data?.is_owner ? account.data : null
  const listings = useApiResource(owner ? '/owners/me/parking-spots' : null)
  const reservations = useApiResource(owner ? `/owners/${owner.id}/reservations` : null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const signOut = useSignOut()

  const spots = listings.data ?? []
  const bookings = reservations.data ?? []
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  const upcoming = bookings.filter(booking => booking.status === 'active' && Date.parse(booking.start_time) > now)
  const bookingValue = bookings.reduce((total, booking) =>
    total + (booking.status === 'cancelled' ? 0 : Math.round(Number(booking.total_cost ?? 0) * 100)), 0) / 100
  const reservationCounts = new Map()
  for (const booking of bookings) {
    reservationCounts.set(booking.spot_id, (reservationCounts.get(booking.spot_id) ?? 0) + 1)
  }
  const addresses = new Map(spots.map(spot => [spot.id, spot.address]))

  async function becomeHost() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await apiRequest('/auth/become-host', { method: 'POST' })
      account.reload()
    } catch (requestError) {
      if (requestError.status === 401) signOut(requestError.message)
      else setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeListing(spot, method, body) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const suffix = method === 'PATCH' ? '/availability' : ''
      await apiRequest(`/parking-spots/${spot.id}${suffix}`, { method, body })
      setEditing(null)
      listings.reload()
      setMessage(method === 'DELETE' ? 'Listing deleted.' : 'Listing updated.')
    } catch (requestError) {
      if (requestError.status === 401) signOut(requestError.message)
      else setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <Navbar accountResource={account} />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Host Dashboard</h1>
            <p className={styles.subtitle}>Manage your listings and reservations</p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.switchBtn} to="/home">🚗 Switch to renting</Link>
            {owner && <Link className={styles.addBtn} to="/listings/new">+ Add listing</Link>}
          </div>
        </div>

        {account.loading && <p role="status">Loading your account…</p>}
        {account.error && <p role="alert">{account.error.message}</p>}
        {account.data && !owner && (
          <div>
            <p>Become a host to list and manage parking spaces with your account.</p>
            {error && <p role="alert">{error}</p>}
            <button type="button" className={styles.addBtn} disabled={busy} onClick={becomeHost}>Become a host</button>
          </div>
        )}

        {owner && (
          <>
            <div className={styles.summaryRow}>
              <SummaryCard icon="📅" label="Upcoming reservations" value={reservations.data ? upcoming.length : '—'} />
              <SummaryCard icon="🏠" label="Active listings" value={listings.data ? spots.filter(spot => spot.available).length : '—'} />
              <SummaryCard icon="🏠" label="Paused listings" value={listings.data ? spots.filter(spot => !spot.available).length : '—'} />
              <SummaryCard icon="$" label="Booking value" value={reservations.data ? `$${bookingValue.toFixed(2)}` : '—'} />
            </div>
            <div className={styles.layout}>
              <div className={styles.left}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Reservations</h2></div>
                {reservations.loading && <p role="status">Loading reservations…</p>}
                {reservations.error && <p role="alert">{reservations.error.message}</p>}
                {reservations.data && (
                  <div className={styles.requestList}>
                    {bookings.length === 0 && <p className={styles.empty}>No reservations yet.</p>}
                    {bookings.map(booking => (
                      <ReservationCard key={booking.id} booking={booking} address={addresses.get(booking.spot_id)} />
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.right}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>My listings</h2>
                  <Link className={styles.addListingBtn} to="/listings/new">+ Add</Link>
                </div>
                {listings.loading && <p role="status">Loading listings…</p>}
                {listings.error && <p role="alert">{listings.error.message}</p>}
                {error && <p role="alert">{error}</p>}
                {message && <p role="status">{message}</p>}
                {listings.data && (
                  <div className={styles.listingList}>
                    {spots.length === 0 && <p className={styles.empty}>You have no listings yet.</p>}
                    {spots.map(spot => (
                      <div key={spot.id} className={styles.listingRow}>
                        {editing === spot.id ? (
                          <ListingEditor spot={spot} busy={busy} onCancel={() => setEditing(null)}
                            onSave={body => changeListing(spot, 'PUT', body)} />
                        ) : (
                          <>
                            <div className={styles.listingCover}><ListingPhoto url={spot.photo_urls?.[0]} /></div>
                            <Link className={styles.listingTitle} to={`/listing/${spot.id}`}>{spot.title || spot.address}</Link>
                            <p className={styles.listingAddress}>{spot.address}</p>
                            <p>{reservations.data ? reservationCounts.get(spot.id) ?? 0 : '—'} {reservationCounts.get(spot.id) === 1 ? 'reservation' : 'reservations'}</p>
                            <div className={styles.listingRight}>
                              <span className={styles.activeStatus}>{spot.available ? '● Active' : '○ Paused'}</span>
                              <p className={styles.listingPrice}>${spot.price}/hr</p>
                            </div>
                            <div className={styles.requestActions}>
                              <Link className={styles.switchBtn} to={`/listing/${spot.id}`}>View</Link>
                              <button type="button" className={styles.switchBtn} disabled={busy}
                                onClick={() => { setError(''); setEditing(spot.id) }}>Edit</button>
                              <button type="button" className={styles.switchBtn} disabled={busy}
                                onClick={() => changeListing(spot, 'PATCH', { available: !spot.available })}>
                                {spot.available ? 'Pause' : 'Unpause'}
                              </button>
                              <button type="button" className={styles.declineBtn} disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`Delete the listing at ${spot.address}?`)) changeListing(spot, 'DELETE')
                                }}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryIcon}>{icon}</span>
      <div>
        <p className={styles.summaryValue}>{value}</p>
        <p className={styles.summaryLabel}>{label}</p>
      </div>
    </div>
  )
}

function ReservationCard({ booking, address }) {
  return (
    <div className={styles.requestCard}>
      <div className={styles.requestTop}>
        <div>
          {booking.renter_name && (
            <div className={styles.requestNameRow}>
              <div className={styles.renterAvatar}>{Array.from(booking.renter_name)[0]}</div>
              <span className={styles.renterName}>{booking.renter_name}</span>
            </div>
          )}
          <p className={styles.requestListing}>📍 {address ?? `Parking spot #${booking.spot_id}`}</p>
        </div>
      </div>
      <div className={styles.requestMeta}>
        <span>{({ active: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled' })[booking.status]}</span>
        <span>{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span>
        {booking.total_cost != null && <span>Reservation total: ${Number(booking.total_cost).toFixed(2)}</span>}
      </div>
    </div>
  )
}

function ListingEditor({ spot, busy, onSave, onCancel }) {
  const addressId = useId()
  const [location, setLocation] = useState(() => ({
    address: spot.address,
    latitude: String(spot.latitude ?? ''),
    longitude: String(spot.longitude ?? ''),
  }))
  const [formErrors, setFormErrors] = useState({})
  const [photos, setPhotos] = useState(spot.photo_urls ?? [])
  const [uploading, setUploading] = useState(false)

  function submit(event) {
    event.preventDefault()
    if (busy || uploading) return
    const fields = new FormData(event.currentTarget)
    const latitude = fields.get('latitude')
    const longitude = fields.get('longitude')
    const address = fields.get('address').trim()
    const description = fields.get('description').trim()
    const errors = {}
    if (!address) errors.address = 'Enter an address.'
    if (!description) errors.description = 'Enter a description.'
    if (Boolean(latitude) !== Boolean(longitude)) errors.location = 'Enter both coordinates, or clear both.'
    setFormErrors(errors)
    if (Object.keys(errors).length) return
    onSave({
      address,
      description,
      price: Number(fields.get('price')),
      available: fields.has('available'),
      owner_id: spot.owner_id,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      title: fields.get('title').trim() || null,
      parking_type: fields.get('parking-type').trim() || null,
      photo_urls: photos,
      amenities: fields.getAll('amenities'),
    })
  }

  return (
    <form className={styles.listingEditor} onSubmit={submit}>
      <div className={styles.addressField}>
        <label htmlFor={addressId}>Address</label>
        <ListingAddressInput id={addressId} value={location.address}
          onChange={address => setLocation({ address, latitude: '', longitude: '' })}
          onSelect={({ address, latitude, longitude }) => setLocation({
            address, latitude: String(latitude), longitude: String(longitude),
          })} />
      </div>
      {formErrors.address && <p role="alert">{formErrors.address}</p>}
      <label>Hourly price <input name="price" type="number" min="0" step="any" defaultValue={spot.price} required /></label>
      <label>Description <textarea name="description" defaultValue={spot.description} maxLength={2000} required /></label>
      {formErrors.description && <p role="alert">{formErrors.description}</p>}
      <label><input name="available" type="checkbox" defaultChecked={spot.available} /> Active</label>
      <label>Listing title <input name="title" maxLength={100} defaultValue={spot.title} /></label>
      <label>Parking type <input name="parking-type" maxLength={60} defaultValue={spot.parking_type} /></label>
      <AmenityPicker selected={spot.amenities} />
      <PhotoEditor photos={photos} onChange={setPhotos} uploading={uploading} onUploading={setUploading} disabled={busy} />
      <label>Latitude <input name="latitude" type="number" min="-90" max="90" step="any" value={location.latitude}
        onChange={event => setLocation({ ...location, latitude: event.target.value })} /></label>
      <label>Longitude <input name="longitude" type="number" min="-180" max="180" step="any" value={location.longitude}
        onChange={event => setLocation({ ...location, longitude: event.target.value })} /></label>
      {formErrors.location && <p role="alert">{formErrors.location}</p>}
      <div className={styles.requestActions}>
        <button type="submit" className={styles.addBtn} disabled={busy || uploading}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className={styles.switchBtn} onClick={onCancel} disabled={busy || uploading}>Cancel</button>
      </div>
    </form>
  )
}
