const API_URL = 'http://127.0.0.1:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function apiRequest(path, { body, authenticated = true, ...options } = {}) {
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
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
    const messages = {
      401: 'Your session has expired. Please sign in again.',
      403: 'You do not have permission to perform this action.',
      404: 'This parking spot or reservation no longer exists. Please refresh.',
      409: typeof data?.detail === 'string' ? data.detail : 'This action conflicts with an existing booking.',
      422: 'Please check the form fields and reservation times.',
    }
    if (response.status === 401) {
      try { localStorage.removeItem('access_token') } catch { /* Return to login even if storage is blocked. */ }
    }
    throw new ApiError(messages[response.status] || 'The server could not complete the request. Please try again.', response.status)
  }
  if (data === undefined) throw new ApiError('The server returned an unexpected response. Please try again.', 0)
  return data
}
