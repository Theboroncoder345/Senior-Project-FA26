import { useEffect, useId, useRef, useState } from 'react'
import { mapboxAccessToken } from './parkingApi'
import styles from './DestinationSearch.module.css'

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300
const SEARCH_BOX_URL = 'https://api.mapbox.com/search/searchbox/v1'

async function searchBox(path, sessionToken, signal, params = {}) {
  const url = new URL(`${SEARCH_BOX_URL}/${path}`)
  url.search = new URLSearchParams({
    ...params, access_token: mapboxAccessToken, session_token: sessionToken,
  })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Mapbox search failed')
  return response.json()
}

export default function DestinationSearch({
  onSelect, onQueryChange, inputClassName, id, placeholder = 'Enter a destination...',
}) {
  const listId = useId()
  const root = useRef(null)
  const retrieval = useRef(null)
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID())
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [result, setResult] = useState(null)
  const [resolving, setResolving] = useState(false)
  const [selectionError, setSelectionError] = useState('')

  const searchQuery = selected ? '' : query.trim()
  const eligible = searchQuery.length >= MIN_QUERY_LENGTH
  const popupOpen = open && eligible && !resolving
  const current = result?.query === searchQuery ? result : null
  const suggestions = current?.suggestions ?? []
  const hasOptions = popupOpen && suggestions.length > 0

  useEffect(() => {
    if (!open || !eligible || resolving || current) return
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const data = await searchBox('suggest', sessionToken, controller.signal, {
          q: searchQuery, limit: '5',
        })
        if (!controller.signal.aborted) {
          setResult({ query: searchQuery, suggestions: data.suggestions ?? [] })
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ query: searchQuery, error: 'Location suggestions are unavailable.' })
        }
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [open, eligible, resolving, current, searchQuery, sessionToken])

  useEffect(() => {
    function handleOutside(event) {
      if (!root.current?.contains(event.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }

    document.addEventListener('pointerdown', handleOutside)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
      retrieval.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (hasOptions && activeIndex >= 0) {
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [hasOptions, activeIndex, listId])

  function close() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function changeQuery(value) {
    retrieval.current?.abort()
    setQuery(value)
    setSelected(false)
    setResolving(false)
    setResult(null)
    setSelectionError('')
    setActiveIndex(-1)
    setOpen(true)
    onQueryChange?.(value)
  }

  async function selectDestination(suggestion) {
    retrieval.current?.abort()
    const controller = new AbortController()
    retrieval.current = controller
    close()
    setResolving(true)
    setSelectionError('')

    try {
      const data = await searchBox(
        `retrieve/${encodeURIComponent(suggestion.mapbox_id)}`, sessionToken, controller.signal,
      )
      if (controller.signal.aborted) return
      const feature = data.features?.[0]
      const [longitude, latitude] = feature?.geometry?.coordinates ?? []
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error('Invalid coordinates')

      const address = feature.properties?.full_address || suggestion.full_address
        || [suggestion.name, suggestion.place_formatted].filter(Boolean).join(', ')
      setQuery(suggestion.feature_type === 'address' ? address : suggestion.name)
      setSelected(true)
      setResult(null)
      setSessionToken(crypto.randomUUID())
      onSelect({ name: suggestion.name, address, latitude, longitude })
    } catch {
      if (!controller.signal.aborted) setSelectionError('Could not select that location. Please try again.')
    } finally {
      if (!controller.signal.aborted) setResolving(false)
    }
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && popupOpen) {
      event.preventDefault()
      close()
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && eligible && !resolving) {
      event.preventDefault()
      setOpen(true)
      if (suggestions.length) {
        const direction = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex(index => index < 0
          ? (direction > 0 ? 0 : suggestions.length - 1)
          : (index + direction + suggestions.length) % suggestions.length)
      }
    }
    if (event.key === 'Enter' && hasOptions && suggestions[activeIndex]) {
      event.preventDefault()
      selectDestination(suggestions[activeIndex])
    }
  }

  return (
    <div ref={root} className={styles.root}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={popupOpen}
        aria-controls={hasOptions ? listId : undefined}
        aria-activedescendant={hasOptions && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        className={inputClassName}
        placeholder={placeholder}
        value={query}
        onChange={event => changeQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
      />

      {popupOpen && (
        <div className={styles.dropdown}>
          {hasOptions ? (
            <ul id={listId} role="listbox" aria-label="Destination suggestions" className={styles.options}>
              {suggestions.map((suggestion, index) => (
                <li
                  id={`${listId}-${index}`}
                  key={suggestion.mapbox_id}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={styles.option}
                  onPointerDown={event => event.preventDefault()}
                  onClick={() => selectDestination(suggestion)}
                >
                  <strong>{suggestion.name}</strong>
                  <span className={styles.location}>
                    {suggestion.place_formatted || suggestion.full_address || suggestion.address}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.status} role="status">
              {current ? current.error ?? 'No locations found' : 'Searching…'}
            </p>
          )}
        </div>
      )}
      {resolving && <p className={styles.status} role="status">Loading location…</p>}
      {selectionError && <p className={styles.status} role="status">{selectionError}</p>}
    </div>
  )
}
