import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import styles from './NewListingPage.module.css'

const PARKING_TYPES = ['Driveway', 'Garage', 'Covered', 'Lot']

const AMENITIES_OPTIONS = [
  { id: 'covered',     label: '🏠 Covered',        },
  { id: 'evCharging',  label: '⚡ EV Charging',     },
  { id: 'wellLit',     label: '💡 Well lit',         },
  { id: 'security',    label: '📷 Security camera',  },
  { id: 'easyAccess',  label: '🚗 Easy access',      },
  { id: 'nearTransit', label: '🚌 Near transit',     },
  { id: 'overnight',   label: '🌙 Overnight ok',     },
  { id: 'paved',       label: '🛣️ Paved surface',    },
]

export default function NewListingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    address: '',
    type: '',
    price: '',
    description: '',
    amenities: [],
    photos: [],
  })

  const [errors, setErrors] = useState({})

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const toggleAmenity = (id) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(id)
        ? prev.amenities.filter((a) => a !== id)
        : [...prev.amenities, id],
    }))
  }

  const validateStep = () => {
    const errs = {}
    if (step === 1) {
      if (!form.title.trim())   errs.title   = 'Title is required'
      if (!form.address.trim()) errs.address = 'Address is required'
      if (!form.type)           errs.type    = 'Please select a parking type'
    }
    if (step === 2) {
      if (!form.price || Number(form.price) <= 0) errs.price = 'Please enter a valid price'
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
    setIsSubmitting(true)
    // TODO: POST to backend /listings
    // await fetch('http://127.0.0.1:8000/listings', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    //   body: JSON.stringify(form),
    // })
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitted(true)
    }, 800)
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
              <strong>{form.title}</strong> has been submitted. Renters can now find and book your space.
            </p>
            <div className={styles.successActions}>
              <button className={styles.primaryBtn} onClick={() => navigate('/host')}>
                Go to host dashboard
              </button>
              <button className={styles.secondaryBtn} onClick={() => { setSubmitted(false); setStep(1); setForm({ title: '', address: '', type: '', price: '', description: '', amenities: [], photos: [] }) }}>
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
                {s === 1 ? 'Basics' : s === 2 ? 'Details' : 'Photos'}
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
                  <label className={styles.label}>Listing title</label>
                  <input
                    type="text"
                    placeholder="e.g. Private Driveway Near Downtown"
                    value={form.title}
                    onChange={update('title')}
                    className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                  />
                  {errors.title && <span className={styles.error}>{errors.title}</span>}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Address</label>
                  <input
                    type="text"
                    placeholder="123 Main St, City, State"
                    value={form.address}
                    onChange={update('address')}
                    className={`${styles.input} ${errors.address ? styles.inputError : ''}`}
                  />
                  {errors.address && <span className={styles.error}>{errors.address}</span>}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Parking type</label>
                  <div className={styles.typeGrid}>
                    {PARKING_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`${styles.typeCard} ${form.type === t ? styles.typeCardActive : ''}`}
                        onClick={() => { setForm((p) => ({ ...p, type: t })); setErrors((e) => ({ ...e, type: '' })) }}
                      >
                        <span className={styles.typeEmoji}>
                          {t === 'Driveway' ? '🏠' : t === 'Garage' ? '🔒' : t === 'Covered' ? '🏗️' : '🅿️'}
                        </span>
                        {t}
                      </button>
                    ))}
                  </div>
                  {errors.type && <span className={styles.error}>{errors.type}</span>}
                </div>

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
                      min="1"
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

                <div className={styles.field}>
                  <label className={styles.label}>Amenities <span className={styles.optional}>(optional)</span></label>
                  <div className={styles.amenitiesGrid}>
                    {AMENITIES_OPTIONS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`${styles.amenityChip} ${form.amenities.includes(a.id) ? styles.amenityChipActive : ''}`}
                        onClick={() => toggleAmenity(a.id)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
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
                <h2 className={styles.stepTitle}>Add photos</h2>
                <p className={styles.stepSub}>Listings with photos get more bookings</p>

                {/* Photo upload placeholder */}
                <div className={styles.photoUpload}>
                  <span className={styles.photoUploadIcon}>📷</span>
                  <p className={styles.photoUploadTitle}>Photos here</p>
                  <p className={styles.photoUploadSub}>
                    Photo upload will be available once connected to the backend
                  </p>
                </div>

                {/* Summary */}
                <div className={styles.summary}>
                  <h3 className={styles.summaryTitle}>Review your listing</h3>
                  <div className={styles.summaryGrid}>
                    <SummaryRow label="Title"   value={form.title} />
                    <SummaryRow label="Address" value={form.address} />
                    <SummaryRow label="Type"    value={form.type} />
                    <SummaryRow label="Price"   value={`$${form.price}/hr`} />
                    <SummaryRow
                      label="Amenities"
                      value={form.amenities.length > 0
                        ? AMENITIES_OPTIONS.filter((a) => form.amenities.includes(a.id)).map((a) => a.label).join(', ')
                        : 'None selected'}
                    />
                  </div>
                </div>

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
                <Tip text="Use a descriptive title that mentions the location or a nearby landmark." />
                <Tip text="Make sure your address is accurate so renters can find you easily." />
                <Tip text="Choose the type that best describes your space — it helps renters filter." />
              </>
            )}
            {step === 2 && (
              <>
                <Tip text="Check what nearby lots charge — pricing competitively gets more bookings." />
                <Tip text="The more detail in your description, the more confident renters will feel." />
                <Tip text="Amenities like EV charging or covered parking let you charge more." />
              </>
            )}
            {step === 3 && (
              <>
                <Tip text="Listings with at least 3 photos get significantly more views." />
                <Tip text="Take photos in daylight showing the full space and entry point." />
                <Tip text="Double check all details before publishing — you can edit later." />
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
