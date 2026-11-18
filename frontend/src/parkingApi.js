export const hasMapbox = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim())

export function parkingLocation(spot) {
  return Number.isFinite(spot?.latitude) && Number.isFinite(spot?.longitude)
    ? { latitude: spot.latitude, longitude: spot.longitude }
    : null
}

export function parkingSpotsPath({ maxPrice = '', available = '' } = {}) {
  const query = new URLSearchParams()
  if (maxPrice !== '' && Number(maxPrice) >= 0) query.set('max_price', maxPrice)
  if (available !== '') query.set('available', available)
  const suffix = query.toString()
  return suffix ? `/parking-spots?${suffix}` : '/parking-spots'
}

export const DEFAULT_PARKING_FILTERS = {
  maxPrice: '',
  maxDistance: '',
  available: 'true',
  sortBy: '',
}
