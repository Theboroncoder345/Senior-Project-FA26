import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import styles from './BookingsPage.module.css'

// Mock bookings — replace with real API call later
const MOCK_BOOKINGS = [
  {
    id: 1,
    listingId: 1,
    title: 'Private Driveway — Downtown',
    address: '142 Main St, Springfield',
    date: '2026-11-10',
    startTime: '09:00',
    endTime: '12:00',
    hours: 3,
    price: 8,
    status: 'confirmed',
    host: 'James R.',
  },
  {
    id: 2,
    listingId: 5,
    title: 'Garage Spot — Midtown',
    address: '500 Commerce Dr, Springfield',
    date: '2026-11-14',
    startTime: '14:00',
    endTime: '18:00',
    hours: 4,
    price: 15,
    status: 'pending',
    host: 'Tony M.',
  },
  {
    id: 3,
    listingId: 2,
    title: 'Covered Spot Near Stadium',
    address: '88 Park Ave, Springfield',
    date: '2026-10-28',
    startTime: '10:00',
    endTime: '14:00',
    hours: 4,
    price: 12,
    status: 'completed',
    host: 'Maria T.',
  },
  {
    id: 4,
    listingId: 4,
    title: 'Quiet Residential Driveway',
    address: '17 Oak Lane, Springfield',
    date: '2026-10-20',
    startTime: '08:00',
    endTime: '10:00',
    hours: 2,
    price: 6,
    status: 'cancelled',
    host: 'Sandra K.',
  },
]

const STATUS_CONFIG = {
  confirmed:  { label: 'Confirmed',  bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  pending:    { label: 'Pending',    bg: '#fffbeb', color: '#d97706', dot: '#f59e0b' },
  completed:  { label: 'Completed', bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
  cancelled:  { label: 'Cancelled', bg: '#fff5f5', color: '#ef4444', dot: '#ef4444' },
}

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled']

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(t) {
  const [h, m] = t.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState('All')
  const navigate = useNavigate()

  const filtered = MOCK_BOOKINGS.filter((b) => {
    if (activeTab === 'All') return true
    if (activeTab === 'Upcoming') return b.status === 'confirmed' || b.status === 'pending'
    if (activeTab === 'Completed') return b.status === 'completed'
    if (activeTab === 'Cancelled') return b.status === 'cancelled'
    return true
  })

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Bookings</h1>
            <p className={styles.subtitle}>Track and manage all your parking reservations</p>
          </div>
          <button className={styles.findBtn} onClick={() => navigate('/home')}>
            + Find parking
          </button>
        </div>

        {/* Summary cards */}
        <div className={styles.summaryRow}>
          <SummaryCard icon="📅" label="Upcoming" count={MOCK_BOOKINGS.filter(b => b.status === 'confirmed' || b.status === 'pending').length} color="#1a7fd4" />
          <SummaryCard icon="✅" label="Completed" count={MOCK_BOOKINGS.filter(b => b.status === 'completed').length} color="#16a34a" />
          <SummaryCard icon="❌" label="Cancelled" count={MOCK_BOOKINGS.filter(b => b.status === 'cancelled').length} color="#ef4444" />
          <SummaryCard icon="💰" label="Total spent" count={`$${MOCK_BOOKINGS.filter(b => b.status === 'completed').reduce((s, b) => s + b.price * b.hours, 0)}`} color="#9333ea" />
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        {filtered.length > 0 ? (
          <div className={styles.list}>
            {filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} navigate={navigate} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📭</span>
            <p className={styles.emptyTitle}>No bookings here</p>
            <p className={styles.emptySub}>
              {activeTab === 'All'
                ? "You haven't made any bookings yet."
                : `You have no ${activeTab.toLowerCase()} bookings.`}
            </p>
            <button className={styles.findBtn} onClick={() => navigate('/home')}>
              Find parking
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ icon, label, count, color }) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryIcon}>{icon}</span>
      <div>
        <p className={styles.summaryCount} style={{ color }}>{count}</p>
        <p className={styles.summaryLabel}>{label}</p>
      </div>
    </div>
  )
}

function BookingCard({ booking, navigate }) {
  const status = STATUS_CONFIG[booking.status]
  const total = booking.price * booking.hours

  return (
    <div className={styles.card}>
      {/* Left — icon */}
      <div className={styles.cardIcon}>🅿</div>

      {/* Middle — details */}
      <div className={styles.cardDetails}>
        <div className={styles.cardTop}>
          <h3 className={styles.cardTitle}>{booking.title}</h3>
          <span
            className={styles.statusBadge}
            style={{ background: status.bg, color: status.color }}
          >
            <span className={styles.statusDot} style={{ background: status.dot }} />
            {status.label}
          </span>
        </div>

        <p className={styles.cardAddress}>📍 {booking.address}</p>

        <div className={styles.cardMeta}>
          <span>📅 {formatDate(booking.date)}</span>
          <span>🕐 {formatTime(booking.startTime)} – {formatTime(booking.endTime)}</span>
          <span>👤 Hosted by {booking.host}</span>
        </div>
      </div>

      {/* Right — price + actions */}
      <div className={styles.cardRight}>
        <p className={styles.cardTotal}>${total}</p>
        <p className={styles.cardTotalLabel}>{booking.hours} hr{booking.hours > 1 ? 's' : ''} · ${booking.price}/hr</p>

        <div className={styles.cardActions}>
          <button
            className={styles.viewBtn}
            onClick={() => navigate(`/listing/${booking.listingId}`)}
          >
            View spot
          </button>
          {(booking.status === 'confirmed' || booking.status === 'pending') && (
            <button className={styles.cancelBtn}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
