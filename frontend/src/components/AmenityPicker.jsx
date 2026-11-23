const AMENITIES = [
  'Covered', 'EV Charging', 'Overnight Parking', 'Security Camera',
  'Accessible Parking', 'Large Vehicle Friendly', '24/7 Access',
]

export default function AmenityPicker({ selected = [], onChange }) {
  return (
    <fieldset>
      <legend>Amenities</legend>
      {AMENITIES.map(amenity => (
        <label key={amenity} style={{ display: 'block' }}>
          <input type="checkbox" name="amenities" value={amenity}
            defaultChecked={selected.includes(amenity)} onChange={onChange} /> {amenity}
        </label>
      ))}
    </fieldset>
  )
}
