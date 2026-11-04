import "./App.css";

import { useState, useMemo } from "react";

import ParkingMap from "./ParkingMap";
import DestinationSearch from "./DestinationSearch";
import ParkingFilters from "./ParkingFilters";

import parkingData from "./parkingData";
import { calculateDistance } from "./distance";

function App() {
  const [destination, setDestination] = useState(null);

  const [filters, setFilters] = useState({
    maxPrice: "",
    maxDistance: "",
    covered: false,
    evCharging: false,
    sortBy: "distance",
  });

  // Calculate distances and apply filters
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

    // Price filter
    if (filters.maxPrice !== "") {
      results = results.filter(
        (spot) => spot.price <= Number(filters.maxPrice)
      );
    }

    // Distance filter
    if (filters.maxDistance !== "" && destination) {
      results = results.filter(
        (spot) => spot.distance <= Number(filters.maxDistance)
      );
    }

    // Covered parking filter
    if (filters.covered) {
      results = results.filter((spot) => spot.covered);
    }

    // EV charging filter
    if (filters.evCharging) {
      results = results.filter((spot) => spot.evCharging);
    }

    // Sorting
    if (filters.sortBy === "price") {
      results.sort((a, b) => a.price - b.price);
    } else if (destination) {
      results.sort((a, b) => a.distance - b.distance);
    }

    return results;
  }, [destination, filters]);

  return (
    <div className="app">
      <h1>ParkShare</h1>

      <DestinationSearch onSelect={setDestination} />

      {/* Filters directly below search */}
      <ParkingFilters
        filters={filters}
        setFilters={setFilters}
      />

      <div className="parking-layout">

        {/* left: parking listings */}
        <div className="parking-list">
          {filteredSpots.length > 0 ? (
            filteredSpots.map((spot) => (
              <div className="parking-card" key={spot.id}>
                <h3>{spot.title}</h3>

                <p>${spot.price} / hour</p>

                {spot.distance !== null && (
                  <p>{spot.distance.toFixed(2)} miles away</p>
                )}

                <p>Type: {spot.parkingType}</p>

                <p>Covered: {spot.covered ? "Yes" : "No"}</p>

                <p>EV Charging: {spot.evCharging ? "Yes" : "No"}</p>
              </div>
            ))
          ) : (
            <p>No parking spots match your filters.</p>
          )}
        </div>

        {/* right: map */}
        <div className="map-container">
          <ParkingMap
            destination={destination}
            parkingSpots={filteredSpots}
          />
        </div>

      </div>
    </div>
  );
}

export default App;
