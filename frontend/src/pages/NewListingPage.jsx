import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiRequest } from '../api/client'
import { useSignOut } from '../api/useApiResource'
import styles from './NewListingPage.module.css'

const EMPTY_LISTING = { address: '', price: '', description: '', latitude: '', longitude: '' }

export default function NewListingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState(EMPTY_LISTING)
  const [errors, setErrors] = useState({})
  const signOut = useSignOut()

  const update = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const validateStep = () => {
    const errs = {}
    if (step === 1) {
      if (!form.address.trim()) errs.address = 'Address is required'
      if (form.latitude || form.longitude) {
        const latitude = Number(form.latitude)
        const longitude = Number(form.longitude)
        if (!form.latitude || !form.longitude || !Number.isFinite(latitude) || !Number.isFinite(longitude)
          || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          errs.location = 'Enter both latitude (−90 to 90) and longitude (−180 to 180).'
        }
      }
    }
    if (step === 2) {
      if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
        errs.price = 'Please enter a nonnegative price'
      }
      if (!form.description.trim()) errs.description = 'Please add a description'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const nextStep = () => {
    if (validateStep()) setStep((s) => s + 1)
  }

  const prevStep = () => {
    setErrors({})
    setStep((s) => s - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setErrors({})
    setIsSubmitting(true)
    try {
      await apiRequest('/parking-spots', {
        method: 'POST',
        body: {
          address: form.address.trim(),
          price: Number(form.price),
          description: form.description.trim(),
          available: true,
          ...(form.latitude && form.longitude ? {
            latitude: Number(form.latitude), longitude: Number(form.longitude),
          } : {}),
        },
      })
      setSubmitted(true)
    } catch (error) {
      if (error.status === 401) signOut(error.message)
      else setErrors({ submit: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.successPage}>
          <div className={styles.successCard}>
            <span className={styles.successIcon}>🎉</span>
            <h2 className={styles.successTitle}>Your listing is live!</h2>
            <p className={styles.successSub}>
              <strong>{form.address}</strong> has been submitted. Renters can now find and book your space.
            </p>
            <div className={styles.successActions}>
              <button className={styles.primaryBtn} onClick={() => navigate('/host')}>
                Go to host dashboard
              </button>
              <button className={styles.secondaryBtn} onClick={() => { setSubmitted(false); setStep(1); setForm(EMPTY_LISTING) }}>
                Add another listing
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/host')}>
            ← Back
          </button>
          <div>
            <h1 className={styles.title}>List your space</h1>
            <p className={styles.subtitle}>Fill in the details about your parking space</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressBar}>
          {[1, 2, 3].map((s) => (
            <div key={s} className={styles.progressStep}>
              <div className={`${styles.progressDot} ${step >= s ? styles.progressDotActive : ''} ${step > s ? styles.progressDotDone : ''}`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`${styles.progressLabel} ${step >= s ? styles.progressLabelActive : ''}`}>
                {s === 1 ? 'Basics' : s === 2 ? 'Details' : 'Review'}
              </span>
              {s < 3 && <div className={`${styles.progressLine} ${step > s ? styles.progressLineDone : ''}`} />}
            </div>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.formCard}>

            {/* ── Step 1: Basics ── */}
            {step === 1 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Tell us about your space</h2>
                <p className={styles.stepSub}>Start with the basics — what are you listing?</p>

                <div className={styles.field}>
                  <label htmlFor="listing-address" className={styles.label}>Address</label>
                  <input id="listing-address" className={styles.input} value={form.address}
                    placeholder="123 Main St, City, State" onChange={update('address')} />
                  {errors.address && <span className={styles.error}>{errors.address}</span>}
                </div>

                <details className={styles.field}>
                  <summary>Map coordinates (optional)</summary>
                  <p className={styles.stepSub}>Enter coordinates to show your spot on the map.</p>
                  <label htmlFor="listing-latitude" className={styles.label}>Latitude</label>
                  <input id="listing-latitude" className={styles.input} type="number" step="any"
                    min="-90" max="90" value={form.latitude} onChange={update('latitude')} />
                  <label htmlFor="listing-longitude" className={styles.label}>Longitude</label>
                  <input id="listing-longitude" className={styles.input} type="number" step="any"
                    min="-180" max="180" value={form.longitude} onChange={update('longitude')} />
                  {errors.location && <p className={styles.error} role="alert">{errors.location}</p>}
                </details>

                <button className={styles.nextBtn} onClick={nextStep}>
                  Continue →
                </button>
              </div>
            )}

            {/* ── Step 2: Details ── */}
            {step === 2 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Pricing & details</h2>
                <p className={styles.stepSub}>Help renters know what to expect</p>

                <div className={styles.field}>
                  <label className={styles.label}>Price per hour ($)</label>
                  <div className={styles.priceWrapper}>
                    <span className={styles.priceDollar}>$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.price}
                      onChange={update('price')}
                      className={`${styles.input} ${styles.priceInput} ${errors.price ? styles.inputError : ''}`}
                    />
                    <span className={styles.priceUnit}>/hr</span>
                  </div>
                  {errors.price && <span className={styles.error}>{errors.price}</span>}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Description</label>
                  <textarea
                    placeholder="Describe your space — size, access instructions, nearby landmarks, anything helpful for the renter…"
                    value={form.description}
                    onChange={update('description')}
                    className={`${styles.textarea} ${errors.description ? styles.inputError : ''}`}
                    rows={4}
                  />
                  {errors.description && <span className={styles.error}>{errors.description}</span>}
                </div>

                <div className={styles.navBtns}>
                  <button className={styles.backStepBtn} onClick={prevStep}>← Back</button>
                  <button className={styles.nextBtn} onClick={nextStep}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 3: Photos ── */}
            {step === 3 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Review and publish</h2>
                <p className={styles.stepSub}>Photo uploads are unavailable.</p>

                {/* Summary */}
                <div className={styles.summary}>
                  <h3 className={styles.summaryTitle}>Review your listing</h3>
                  <div className={styles.summaryGrid}>
                    <SummaryRow label="Address" value={form.address} />
                    <SummaryRow label="Price" value={`$${form.price}/hr`} />
                    <SummaryRow label="Description" value={form.description} />
                  </div>
                </div>

                {errors.submit && <p className={styles.error} role="alert">{errors.submit}</p>}
                <div className={styles.navBtns}>
                  <button className={styles.backStepBtn} onClick={prevStep}>← Back</button>
                  <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Publishing…' : '🚀 Publish listing'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right — tips panel */}
          <div className={styles.tips}>
            <h3 className={styles.tipsTitle}>💡 Tips</h3>
            {step === 1 && (
              <>
                <Tip text="Make sure your address is accurate so renters can find you easily." />
              </>
            )}
            {step === 2 && (
              <>
                <Tip text="Check what nearby lots charge — pricing competitively gets more bookings." />
                <Tip text="The more detail in your description, the more confident renters will feel." />
              </>
            )}
            {step === 3 && (
              <>
                <Tip text="Double check your address and hourly price before publishing." />
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  )
}

function Tip({ text }) {
  return (
    <div className={styles.tip}>
      <span className={styles.tipDot}>•</span>
      <p>{text}</p>
    </div>
  )
}
