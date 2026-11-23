import { useRef, useState } from 'react'
import { apiRequest, hasAccessToken } from './client'
import { useApiResource, useSignOut } from './useApiResource'

const FAVORITES_PATH = '/users/me/favorites'

export function useFavorites({ requireAccount = false } = {}) {
  const signedIn = hasAccessToken()
  const resource = useApiResource(signedIn || requireAccount ? FAVORITES_PATH : null)
  const signOut = useSignOut()
  const inFlight = useRef(new Set())
  const [pending, setPending] = useState(new Set())
  const [updates, setUpdates] = useState(new Map())
  const [errors, setErrors] = useState(new Map())
  const saved = new Map((resource.data ?? []).map(spot => [spot.id, spot]))
  for (const [id, spot] of updates) {
    if (spot) saved.set(id, spot)
    else saved.delete(id)
  }

  async function toggle(spot) {
    const id = spot.id
    if (!resource.data || inFlight.current.has(id)) return
    const save = !saved.has(id)
    inFlight.current.add(id)
    setPending(new Set(inFlight.current))
    setErrors(previous => new Map(previous).set(id, ''))
    try {
      await apiRequest(`${FAVORITES_PATH}/${id}`, { method: save ? 'PUT' : 'DELETE' })
      setUpdates(previous => new Map(previous).set(id, save ? spot : null))
    } catch (error) {
      if (error.status === 401) signOut(error.message)
      else setErrors(previous => new Map(previous).set(id, error.message))
    } finally {
      inFlight.current.delete(id)
      setPending(new Set(inFlight.current))
    }
  }

  return { signedIn, saved, pending, errors, toggle, loading: resource.loading, error: resource.error, reload: resource.reload }
}
