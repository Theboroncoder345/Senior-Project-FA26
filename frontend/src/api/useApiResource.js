import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest, clearAccessToken } from './client'

export function useSignOut() {
  const navigate = useNavigate()
  return useCallback((sessionMessage = '') => {
    clearAccessToken()
    navigate('/login', { replace: true, state: { sessionMessage } })
  }, [navigate])
}

export function useApiResource(path, { authenticated = true } = {}) {
  const [result, setResult] = useState(null)
  const [revision, setRevision] = useState(0)
  const signOut = useSignOut()

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    apiRequest(path, { authenticated, signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setResult({ path, revision, data })
      })
      .catch(error => {
        if (controller.signal.aborted) return
        if (authenticated && error.status === 401) signOut(error.message)
        else setResult({ path, revision, error })
      })
    return () => controller.abort()
  }, [authenticated, path, revision, signOut])

  const current = result?.path === path && result.revision === revision ? result : null
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(path && !current),
    reload: () => setRevision(value => value + 1),
  }
}
