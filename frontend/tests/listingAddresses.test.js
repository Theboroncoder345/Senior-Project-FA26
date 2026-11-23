import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listingAddresses } from '../src/api/listingAddresses.js'

test('requests permanent address autocomplete and returns usable coordinates', async t => {
  const feature = {
    properties: { mapbox_id: 'address-1', name: '12 Main Street', place_formatted: 'Holmdel, NJ' },
    geometry: { coordinates: [-74.18, 40.39] },
  }
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({
    features: [feature, { ...feature, geometry: { coordinates: [-181, 40] } }],
  }))
  const { signal } = new AbortController()
  assert.deepEqual(await listingAddresses('12 Main', 'test-token', signal), [{
    mapbox_id: 'address-1', name: '12 Main Street', place_formatted: 'Holmdel, NJ',
    address: '12 Main Street, Holmdel, NJ', latitude: 40.39, longitude: -74.18,
  }])
  const [[url, options]] = request.mock.calls.map(call => call.arguments)
  assert.equal(url.origin + url.pathname, 'https://api.mapbox.com/search/geocode/v6/forward')
  assert.equal(url.searchParams.get('q'), '12 Main')
  assert.equal(url.searchParams.get('access_token'), 'test-token')
  assert.equal(url.searchParams.get('permanent'), 'true')
  assert.equal(url.searchParams.get('autocomplete'), 'true')
  assert.equal(url.searchParams.get('types'), 'address')
  assert.equal(options.signal, signal)
})

test('handles empty search results and surfaces provider errors', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ features: [] }))
  assert.deepEqual(await listingAddresses('unknown address', 'test-token'), [])
  fetch.mock.mockImplementation(async () => new Response(null, { status: 403 }))
  await assert.rejects(listingAddresses('unknown address', 'test-token'), /geocoding failed/)
})
