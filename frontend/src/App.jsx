import { useMemo, useState } from "react";

import DestinationSearch from "./DestinationSearch";
import ParkingFilters from "./ParkingFilters";
import ParkingMap from "./ParkingMap";
import parkingData from "./parkingData";
import { calculateDistance } from "./distance";

import "./App.css";

function App() {
  // Selected destination from Mapbox Search
  const [destination, setDestination] = useState(null);

  // Parking filter settings
  const [filters, setFilters] = useState({
    maxPrice: 100,
    maxDistance: 10,
    covered: false,
    evCharging: false,
    sortBy: "distance",
  });

  // Filter and sort parking spots
  const filteredSpots = useMemo(() => {
    let results = parkingData.map((spot) => {
      let distance = null;

      if (destination) {
        distance = calculateDistance(
          destination.latitude,
          destination.longitude,
          spot.latitude,
          spot.longitude
        );
      }

      return {
        ...spot,
        distance,
      };
    });

    // Only show available parking spots
    results = results.filter((spot) => spot.available !== false);

    // Maximum price filter
    results = results.filter(
      (spot) => Number(spot.price) <= Number(filters.maxPrice)
    );

    // Maximum distance filter (only when a destination is selected)
    if (destination) {
      results = results.filter(
        (spot) => spot.distance <= Number(filters.maxDistance)
      );
    }

    // Covered parking filter
    if (filters.covered) {
      results = results.filter((spot) => spot.covered === true);
    }

    // EV charging filter
    if (filters.evCharging) {
      results = results.filter((spot) => spot.evCharging === true);
    }

    // Sort results
    if (filters.sortBy === "distance" && destination) {
      results.sort((a, b) => a.distance - b.distance);
    } else if (filters.sortBy === "price") {
      results.sort((a, b) => a.price - b.price);
    }

    return results;
  }, [destination, filters]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>ParkShare</h1>
        <p>Find convenient parking near your destination.</p>
      </header>

      <main className="main-content">
        {/* Destination Search */}
        <section className="search-section">
          <DestinationSearch onSelect={setDestination} />
        </section>

        {/* Selected Destination */}
        {destination && (
          <div className="destination-info">
            <p>
              Searching near: <strong>{destination.name}</strong>
            </p>
          </div>
        )}

        {/* Filters */}
        <section className="filters-section">
          <ParkingFilters
            filters={filters}
            setFilters={setFilters}
          />
        </section>

        {/* Parking Listings and Map */}
        <section className="parking-layout">
          <div className="parking-list">
            <h2>Available Parking</h2>

            <p className="results-count">
              {filteredSpots.length} parking spot(s) found
            </p>

            {filteredSpots.length === 0 ? (
              <p className="no-results">
                No parking spots match your search.
                Try changing your filters or destination.
              </p>
            ) : (
              filteredSpots.map((spot) => (
                <div className="parking-card" key={spot.id}>
                  <h3>{spot.title}</h3>

                  <p className="parking-price">
                    ${spot.price}
                  </p>

                  <p>
                    <strong>Type:</strong> {spot.parkingType}
                  </p>

                  <p>
                    <strong>Covered:</strong>{" "}
                    {spot.covered ? "Yes" : "No"}
                  </p>

                  <p>
                    <strong>EV Charging:</strong>{" "}
                    {spot.evCharging ? "Available" : "Unavailable"}
                  </p>

                  {spot.distance !== null && (
                    <p>
                      <strong>Distance:</strong>{" "}
                      {spot.distance.toFixed(2)} miles
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="map-section">
            <ParkingMap
              destination={destination}
              parkingSpots={filteredSpots}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
