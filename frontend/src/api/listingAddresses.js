export async function listingAddresses(query, accessToken, signal) {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')
  url.search = new URLSearchParams({
    q: query, access_token: accessToken, autocomplete: 'true',
    permanent: 'true', types: 'address', limit: '5', proximity: 'ip',
  })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Mapbox geocoding failed')
  const data = await response.json()
  return (data.features ?? []).flatMap(feature => {
    const { mapbox_id, name, full_address, place_formatted } = feature.properties ?? {}
    const [longitude, latitude] = feature.geometry?.coordinates ?? []
    const address = full_address || [name, place_formatted].filter(Boolean).join(', ')
    return mapbox_id && name && address.length <= 250
      && Number.isFinite(latitude) && Math.abs(latitude) <= 90
      && Number.isFinite(longitude) && Math.abs(longitude) <= 180
      ? [{ mapbox_id, name, place_formatted, address, latitude, longitude }]
      : []
  })
}
