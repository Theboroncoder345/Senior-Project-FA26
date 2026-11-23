


When a Mapbox token is configured, host listing forms offer address autocomplete
through Mapbox Geocoding v6. The app requests permanent geocoding because it
saves the selected address and coordinates. The Mapbox account must support
permanent geocoding. Hosts can also enter addresses and map coordinates manually.

Run the address-provider tests with `node --test tests/listingAddresses.test.js`
from `frontend/`.
