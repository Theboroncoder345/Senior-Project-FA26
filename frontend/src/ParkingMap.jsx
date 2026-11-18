import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export default function ParkingMap({ destination, parkingSpots }) {
  const container = useRef(null)
  const [map, setMap] = useState(null)
  const [error, setError] = useState(false)
  const initialLocation = useRef(destination ?? parkingSpots[0])

  useEffect(() => {
    const location = initialLocation.current
    if (!location) return
    let instance
    try {
      instance = new mapboxgl.Map({
        accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
        container: container.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [location.longitude, location.latitude],
        zoom: 14,
      })
    } catch {
      queueMicrotask(() => {
        if (container.current) setError(true)
      })
      return
    }
    instance.addControl(new mapboxgl.NavigationControl())
    instance.once('load', () => {
      setMap(instance)
      setError(false)
    })
    instance.on('error', () => {
      if (!instance.loaded()) setError(true)
    })
    return () => instance.remove()
  }, [])

  useEffect(() => {
    if (!map) return
    const bounds = new mapboxgl.LngLatBounds()
    const markers = parkingSpots.map(spot => {
      const coordinates = [spot.longitude, spot.latitude]
      bounds.extend(coordinates)
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setText(`${spot.address} · $${spot.price}/hr`)
      return new mapboxgl.Marker().setLngLat(coordinates).setPopup(popup).addTo(map)
    })
    if (destination) bounds.extend([destination.longitude, destination.latitude])
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 0 })
    return () => markers.forEach(marker => marker.remove())
  }, [destination, map, parkingSpots])

  return (
    <>
      {error && <p role="status">The map is temporarily unavailable.</p>}
      <div ref={container} aria-label="Parking map" style={{ width: '100%', height: 360, borderRadius: 8 }} />
    </>
  )
}
