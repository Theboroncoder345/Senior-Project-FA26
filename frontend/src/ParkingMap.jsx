import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
mapboxgl.accessToken = TOKEN;

export default function ParkingMap({
  destination,
  parkingSpots,
}) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef([]);

  const [mapReady, setMapReady] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.0745, 40.8135],
      zoom: 14,
    });

    mapInstance.current = map;

    map.addControl(new mapboxgl.NavigationControl());

    map.on("load", () => {
      setMapReady(true);
    });

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];

      map.remove();
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []);

  // Move map when destination changes
  useEffect(() => {
    if (!mapReady || !destination) return;

    mapInstance.current.flyTo({
      center: [
        destination.longitude,
        destination.latitude,
      ],
      zoom: 14,
      duration: 1500,
    });
  }, [destination, mapReady]);

  // Update markers when filtered parking spots change
  useEffect(() => {
    if (!mapReady) return;

    const map = mapInstance.current;

    // Remove old markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Create markers for current results
    parkingSpots.forEach((spot) => {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div>
          <h3>${spot.title}</h3>
          <p><strong>$${spot.price}</strong> / hour</p>
          <p>Type: ${spot.parkingType}</p>
          <p>Covered: ${spot.covered ? "Yes" : "No"}</p>
          <p>EV Charging: ${spot.evCharging ? "Yes" : "No"}</p>
          ${
            spot.distance !== null
              ? `<p>${spot.distance.toFixed(2)} miles away</p>`
              : ""
          }
        </div>
      `);

      const marker = new mapboxgl.Marker()
        .setLngLat([spot.longitude, spot.latitude])
        .setPopup(popup)
        .addTo(map);

      markers.current.push(marker);
    });
  }, [parkingSpots, mapReady]);

  // Show placeholder if no Mapbox token is configured
  if (!TOKEN) {
    return (
      <div style={{
        width: "100%",
        minHeight: "450px",
        background: "linear-gradient(135deg, #eff8ff, #dbeffe)",
        border: "2px dashed #b0d9fd",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "2rem",
        textAlign: "center",
      }}>
        <span style={{ fontSize: "2.5rem" }}>🗺️</span>
        <p style={{ fontWeight: 700, color: "#1a7fd4", margin: 0 }}>Map coming soon</p>
        <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
          Add VITE_MAPBOX_ACCESS_TOKEN to .env to enable the map
        </p>
      </div>
    )
  }

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "450px",
        borderRadius: "8px",
      }}
    />
  );
}

