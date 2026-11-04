import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

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

