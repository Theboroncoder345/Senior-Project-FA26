import { useState } from 'react'
import { apiRequest } from '../api/client'
import { useSignOut } from '../api/useApiResource'
import ListingPhoto from './ListingPhoto'
import styles from './PhotoEditor.module.css'

const MAX_PHOTOS = 5
const MAX_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export default function PhotoEditor({ photos, onChange, uploading, onUploading, disabled }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const signOut = useSignOut()
  const locked = disabled || uploading

  async function addFiles(event) {
    const files = Array.from(event.target.files)
    event.target.value = ''
    if (!files.length) return
    setError('')
    if (photos.length + files.length > MAX_PHOTOS) {
      setError('Choose up to five photos total.')
      return
    }
    const additions = []
    onUploading(true)
    try {
      for (const file of files) {
        const extension = file.name.match(/\.(jpe?g|png|webp)$/i)?.[1].toLowerCase()
        const type = IMAGE_TYPES[extension]
        if (!type || (file.type && file.type !== type)) throw new Error('Choose a JPG, JPEG, PNG, or WebP photo.')
        if (file.size > MAX_BYTES) throw new Error('Each photo must be 5 MiB or smaller.')
        const result = await apiRequest(`/parking-photos?extension=${extension}`, {
          method: 'POST', rawBody: file, headers: { 'Content-Type': type },
        })
        additions.push(result.url)
      }
    } catch (uploadError) {
      if (uploadError.status === 401) signOut(uploadError.message)
      else setError(uploadError.message)
    } finally {
      if (additions.length) onChange([...photos, ...additions])
      onUploading(false)
    }
  }

  function addUrl() {
    try {
      const parsed = new URL(url.trim())
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.href.length > 2048) {
        throw new Error()
      }
      if (photos.length >= MAX_PHOTOS) {
        setError('Choose up to five photos total.')
        return
      }
      onChange([...photos, parsed.href])
      setUrl('')
      setError('')
    } catch {
      setError('Enter a valid HTTPS image URL without embedded credentials.')
    }
  }

  return (
    <fieldset className={styles.editor} disabled={locked}>
      <legend>Listing photos (optional)</legend>
      <p>{photos.length} of 5 photos. The first photo is your cover.</p>
      <label>Upload Photos
        <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" onChange={addFiles} disabled={photos.length >= MAX_PHOTOS} />
      </label>
      <small>JPG, JPEG, PNG, or WebP. Up to 5 MiB per photo.</small>
      <label>Image URL
        <input type="text" inputMode="url" placeholder="https://…" value={url}
          onChange={event => setUrl(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addUrl()
            }
          }} />
      </label>
      <button type="button" onClick={addUrl} disabled={!url.trim() || photos.length >= MAX_PHOTOS}>Add Image URL</button>
      {uploading && <p role="status">Uploading photos…</p>}
      {error && <p role="alert">{error}</p>}
      {photos.length > 0 && (
        <ul className={styles.previews}>
          {photos.map((photo, index) => (
            <li key={`${index}-${photo}`}>
              <div className={styles.preview}><ListingPhoto url={photo} alt={`Photo ${index + 1} preview`} /></div>
              <button type="button" aria-label={`Remove photo ${index + 1}`}
                onClick={() => onChange(photos.filter((_, position) => position !== index))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
