export const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
  || import.meta.env.VITE_MAPBOX_TOKEN?.trim()
export const hasMapbox = Boolean(mapboxAccessToken)

export function parkingLocation(spot) {
  return Number.isFinite(spot?.latitude) && Number.isFinite(spot?.longitude)
    ? { latitude: spot.latitude, longitude: spot.longitude }
    : null
}

export function parkingSpotsPath({ maxPrice = '', available = '', start = '', end = '' } = {}) {
  const query = new URLSearchParams()
  if (maxPrice !== '' && Number(maxPrice) >= 0) query.set('max_price', maxPrice)
  if (available !== '') query.set('available', available)
  if (start && end) {
    query.set('start_time', new Date(start).toISOString())
    query.set('end_time', new Date(end).toISOString())
  }
  const suffix = query.toString()
  return suffix ? `/parking-spots?${suffix}` : '/parking-spots'
}

export const DEFAULT_PARKING_FILTERS = {
  start: '',
  end: '',
  maxPrice: '',
  maxDistance: '1.5',
  available: 'true',
  sortBy: '',
}


export function photoUrls(value) {
  return value.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
}
