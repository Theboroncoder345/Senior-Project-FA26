import DestinationSearch from '../DestinationSearch'
import { hasMapbox } from '../parkingApi'

export default function ListingAddressInput({ onChange, onSelect, className, ...inputProps }) {
  const props = { ...inputProps, name: 'address', maxLength: 250, required: true }
  return hasMapbox ? (
    <DestinationSearch {...props} listingAddress inputClassName={className}
      onQueryChange={onChange} onSelect={onSelect} />
  ) : (
    <input {...props} className={className} onChange={event => onChange(event.target.value)} />
  )
}
