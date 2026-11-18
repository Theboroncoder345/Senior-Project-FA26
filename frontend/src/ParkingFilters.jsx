export default function ParkingFilters({ filters, setFilters, hasDestination, onReset, inputClassName }) {
  function update(name, value) {
    setFilters(previous => ({ ...previous, [name]: value }))
  }

  return (
    <>
      <input className={inputClassName} type="number" min="0" step="any"
        aria-label="Maximum price per hour" placeholder="Max price / hr"
        value={filters.maxPrice} onChange={e => update('maxPrice', e.target.value)} />
      <select className={inputClassName} aria-label="Listing availability"
        value={filters.available} onChange={e => update('available', e.target.value)}>
        <option value="true">Active spots</option>
        <option value="">All spots</option>
        <option value="false">Unavailable spots</option>
      </select>
      {hasDestination && (
        <input className={inputClassName} type="number" min="0" step="any"
          aria-label="Maximum distance in miles" placeholder="Max miles"
          value={filters.maxDistance} onChange={e => update('maxDistance', e.target.value)} />
      )}
      <select className={inputClassName} aria-label="Sort results"
        value={filters.sortBy} onChange={e => update('sortBy', e.target.value)}>
        <option value="">Default order</option>
        <option value="price">Lowest price first</option>
        {hasDestination && <option value="distance">Closest first</option>}
      </select>
      <button type="button" className={inputClassName} onClick={onReset}>
        Clear filters
      </button>
    </>
  )
}
