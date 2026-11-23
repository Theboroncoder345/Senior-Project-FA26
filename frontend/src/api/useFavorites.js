import { useRef, useState } from 'react'
import { apiRequest, hasAccessToken } from './client'
import { useApiResource, useSignOut } from './useApiResource'

const FAVORITES_PATH = '/users/me/favorites'

function favoritesMessage(error, fallback) {
  if (error?.code === 'favorites_schema_missing') {
    return 'Saved parking database is not initialized. Apply database migration 002, then try again.'
  }
  if (error?.status === 0) return error.message
  return fallback
}

export function useFavorites({ requireAccount = false } = {}) {
  const signedIn = hasAccessToken()
  const resource = useApiResource(signedIn || requireAccount ? FAVORITES_PATH : null)
  const signOut = useSignOut()
  const inFlight = useRef(new Set())
  const [pending, setPending] = useState(new Set())
  const [updates, setUpdates] = useState(new Map())
  const [errors, setErrors] = useState(new Map())
  const listings = Array.isArray(resource.data) ? resource.data : null
  const saved = new Map((listings ?? []).map(spot => [spot.id, spot]))
  const loadError = resource.error || (resource.data !== undefined && !listings)
    ? favoritesMessage(resource.error, 'Failed to load saved parking. Please try again.')
    : ''
  for (const [id, spot] of updates) {
    if (spot) saved.set(id, spot)
    else saved.delete(id)
  }

  async function toggle(spot) {
    const id = spot.id
    if (!listings || inFlight.current.has(id)) return
    const save = !saved.has(id)
    inFlight.current.add(id)
    setPending(new Set(inFlight.current))
    setErrors(previous => new Map(previous).set(id, ''))
    try {
      await apiRequest(`${FAVORITES_PATH}/${id}`, { method: save ? 'PUT' : 'DELETE' })
      setUpdates(previous => new Map(previous).set(id, save ? spot : null))
    } catch (error) {
      if (error.status === 401) signOut(error.message)
      else setErrors(previous => new Map(previous).set(id, favoritesMessage(error, error.message)))
    } finally {
      inFlight.current.delete(id)
      setPending(new Set(inFlight.current))
    }
  }

  return { signedIn, saved, pending, errors, toggle, loading: resource.loading, error: loadError, reload: resource.reload }
}
