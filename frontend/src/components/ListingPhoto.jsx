import { useState } from 'react'
import { photoSource } from '../api/client'
import styles from './ListingPhoto.module.css'

export default function ListingPhoto({ url, alt = 'Parking space' }) {
  return <Photo key={url} url={url} alt={alt} />
}

function Photo({ url, alt }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return <div className={styles.placeholder} role="img" aria-label={failed ? 'Parking photo unavailable' : 'No parking photo'}>P</div>
  }
  return <img className={styles.photo} src={photoSource(url)} alt={alt}
    loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}
