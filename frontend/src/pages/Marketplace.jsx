import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import styles from './Marketplace.module.css'

function useCollection(path, onSessionExpired) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    apiRequest(path, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return
        if (!Array.isArray(data)) throw new Error('The server returned an unexpected list.')
        setItems(data)
      })
      .catch(error => {
        if (controller.signal.aborted) return
        if (error.status === 401) onSessionExpired(error.message)
        else setError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, version, onSessionExpired])

  return { items, loading, error, reload: () => {
    setLoading(true)
    setError('')
    setVersion(value => value + 1)
  } }
}

function CollectionStatus({ collection, emptyMessage }) {
  return <>
    {collection.loading && <p role="status">Loading…</p>}
    {collection.error && <p role="alert">{collection.error}</p>}
    {!collection.loading && !collection.error && collection.items.length === 0 && <p>{emptyMessage}</p>}
  </>
}

function SpotList({ spots }) {
  return <ul className={styles.list}>
    {spots.map(spot => <li key={spot.id}>
      <strong>#{spot.id} — {spot.address}</strong>
      <p>{spot.description}</p>
      <p>Price: {spot.price} · {spot.available ? 'Available' : 'Unavailable'}</p>
    </li>)}
  </ul>
}

function formatTime(value) {
  // The backend treats legacy timestamps without an offset as UTC.
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`
  return new Date(normalized).toLocaleString()
}

export default function Marketplace({ user, onSessionExpired }) {
  const spots = useCollection('/parking-spots?available=true', onSessionExpired)
  const listings = useCollection(user.is_owner ? '/owners/me/parking-spots' : null, onSessionExpired)
  const reservations = useCollection('/users/me/reservations', onSessionExpired)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleError = error => {
    if (error.status === 401) onSessionExpired(error.message)
    else setError(error.message)
  }

  const createSpot = async event => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const address = fields.get('address').trim()
    const description = fields.get('description').trim()
    const price = Number(fields.get('price'))
    setError('')
    setMessage('')
    if (!address || !description || !Number.isFinite(price) || price < 0) {
      setError('Enter an address, description, and a price of 0 or more.')
      return
    }
    setPending('spot')
    try {
      await apiRequest('/parking-spots', { method: 'POST', body: {
        address, description, price, available: fields.get('available') === 'on',
      } })
      form.reset()
      setMessage('Parking spot created.')
      spots.reload()
      listings.reload()
    } catch (error) { handleError(error) }
    finally { setPending('') }
  }

  const createReservation = async event => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const start = new Date(fields.get('start_time'))
    const end = new Date(fields.get('end_time'))
    const spotId = Number(fields.get('spot_id'))
    setError('')
    setMessage('')
    if (!Number.isInteger(spotId) || spotId <= 0 || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError('Choose a parking spot and an end time after the start time.')
      return
    }
    setPending('reservation')
    try {
      await apiRequest('/reservations', { method: 'POST', body: {
        spot_id: spotId, start_time: start.toISOString(), end_time: end.toISOString(),
      } })
      form.reset()
      setMessage('Reservation created.')
      reservations.reload()
    } catch (error) { handleError(error) }
    finally { setPending('') }
  }

  const cancelReservation = async id => {
    if (pending) return
    setPending(`cancel-${id}`)
    setError('')
    setMessage('')
    try {
      await apiRequest(`/reservations/${id}`, { method: 'DELETE' })
      setMessage('Reservation cancelled.')
      reservations.reload()
    } catch (error) {
      handleError(error)
      if (error.status === 404) reservations.reload()
    } finally { setPending('') }
  }

  return <div className={styles.marketplace}>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}

    <section aria-labelledby="available-spots">
      <h2 id="available-spots">Available parking spots</h2>
      <button type="button" onClick={spots.reload} disabled={spots.loading}>Refresh spots</button>
      <CollectionStatus collection={spots} emptyMessage="No available parking spots." />
      <SpotList spots={spots.items} />
    </section>

    {user.is_owner && <>
      <section aria-labelledby="create-spot">
        <h2 id="create-spot">Create a parking spot</h2>
        <form onSubmit={createSpot} className={styles.form}>
          <label>Address<input name="address" required /></label>
          <label>Description<textarea name="description" required /></label>
          <label>Price<input name="price" type="number" min="0" step="any" required /></label>
          <label className={styles.checkbox}><input name="available" type="checkbox" defaultChecked />Available</label>
          <button type="submit" disabled={Boolean(pending)}>{pending === 'spot' ? 'Creating…' : 'Create spot'}</button>
        </form>
      </section>
      <section aria-labelledby="my-listings">
        <h2 id="my-listings">My listings</h2>
        <button type="button" onClick={listings.reload} disabled={listings.loading}>Refresh listings</button>
        <CollectionStatus collection={listings} emptyMessage="You have no listings yet." />
        <SpotList spots={listings.items} />
      </section>
    </>}

    <section aria-labelledby="create-reservation">
      <h2 id="create-reservation">Reserve a parking spot</h2>
      <p>Enter times in your local timezone.</p>
      <form onSubmit={createReservation} className={styles.form}>
        <label>Parking spot<select name="spot_id" defaultValue="" required>
          <option value="" disabled>Choose a spot</option>
          {spots.items.map(spot => <option key={spot.id} value={spot.id}>#{spot.id} — {spot.address} ({spot.price})</option>)}
        </select></label>
        <label>Start time<input name="start_time" type="datetime-local" required /></label>
        <label>End time<input name="end_time" type="datetime-local" required /></label>
        <button type="submit" disabled={Boolean(pending) || spots.loading || spots.items.length === 0}>
          {pending === 'reservation' ? 'Reserving…' : 'Create reservation'}
        </button>
      </form>
    </section>

    <section aria-labelledby="my-reservations">
      <h2 id="my-reservations">My reservations</h2>
      <button type="button" onClick={reservations.reload} disabled={reservations.loading}>Refresh reservations</button>
      <CollectionStatus collection={reservations} emptyMessage="You have no reservations." />
      <ul className={styles.list}>
        {reservations.items.map(reservation => <li key={reservation.id}>
          <strong>Reservation #{reservation.id} · Parking spot #{reservation.spot_id}</strong>
          <p>{formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}</p>
          <button type="button" disabled={Boolean(pending)} onClick={() => cancelReservation(reservation.id)}>
            {pending === `cancel-${reservation.id}` ? 'Cancelling…' : 'Cancel reservation'}
          </button>
        </li>)}
      </ul>
    </section>
  </div>
}
