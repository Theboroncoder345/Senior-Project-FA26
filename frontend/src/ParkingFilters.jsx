export default function ParkingFilters({
  filters,
  setFilters,
}) {
  function updateFilter(name, value) {
    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  return (
    <div className="parking-filters">
      <h3>Filter Parking</h3>

      <div>
        <label>Maximum Price ($/hour)</label>
        <input
          type="number"
          min="0"
          value={filters.maxPrice}
          onChange={(e) =>
            updateFilter("maxPrice", e.target.value)
          }
        />
      </div>

      <div>
        <label>Maximum Distance (miles)</label>
        <input
          type="number"
          min="0"
          value={filters.maxDistance}
          onChange={(e) =>
            updateFilter("maxDistance", e.target.value)
          }
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={filters.covered}
            onChange={(e) =>
              updateFilter("covered", e.target.checked)
            }
          />
          Covered Parking
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={filters.evCharging}
            onChange={(e) =>
              updateFilter("evCharging", e.target.checked)
            }
          />
          EV Charging
        </label>
      </div>

      <div>
        <label>Sort Results</label>
        <select
          value={filters.sortBy}
          onChange={(e) =>
            updateFilter("sortBy", e.target.value)
          }
        >
          <option value="distance">Closest First</option>
          <option value="price">Lowest Price First</option>
        </select>
      </div>

      <button
        onClick={() =>
          setFilters({
            maxPrice: "",
            maxDistance: "",
            covered: false,
            evCharging: false,
            sortBy: "distance",
          })
        }
      >
        Clear Filters
      </button>
    </div>
  );
}
