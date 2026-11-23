const API_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export function hasAccessToken() {
  try {
    return Boolean(localStorage.getItem('access_token'))
  } catch {
    return false
  }
}

export function clearAccessToken() {
  try {
    localStorage.removeItem('access_token')
  } catch {
    // Return to login even if storage is unavailable.
  }
}

export async function apiRequest(path, { body, rawBody, authenticated = true, ...options } = {}) {
  const headers = { ...options.headers }
  if (authenticated) {
    let token
    try {
      token = localStorage.getItem('access_token')
    } catch {
      throw new ApiError('Browser storage is unavailable. Please sign in again.', 401)
    }
    if (!token) throw new ApiError('Please sign in again.', 401)
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options, headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Unable to connect to the server. Please try again.', 0)
  }

  let data
  try {
    data = await response.json()
  } catch {
    // Error responses may not be JSON (for example, an unavailable server).
  }
  if (!response.ok) {
    const fieldError = Array.isArray(data?.detail) ? data.detail[0] : null
    const detail = typeof data?.detail === 'string' ? data.detail : null
    const messages = {
      401: authenticated ? 'Your session has expired. Please sign in again.' : 'Invalid email or password.',
      403: 'You do not have permission to perform this action.',
      404: 'This parking spot or reservation no longer exists. Please refresh.',
      409: detail || 'This action conflicts with an existing booking.',
      413: detail,
      415: detail,
      422: detail || (fieldError ? fieldError.msg.replace(/^Value error, /, '') : 'Please check your entries.'),
    }
    if (authenticated && response.status === 401 && !options.signal?.aborted) clearAccessToken()
    throw new ApiError(messages[response.status] || 'The server could not complete the request. Please try again.', response.status)
  }
  if (data === undefined) throw new ApiError('The server returned an unexpected response. Please try again.', 0)
  return data
}

export function photoSource(url) {
  return url?.startsWith('/uploads/') ? API_URL + url : url
}
