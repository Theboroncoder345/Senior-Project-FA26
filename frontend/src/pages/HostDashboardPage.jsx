import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import styles from './HostDashboardPage.module.css'

// Mock data — replace with real API calls later
const MOCK_LISTINGS = [
  {
    id: 1,
    title: 'Private Driveway — Downtown',
    address: '142 Main St, Springfield',
    price: 8,
    type: 'Driveway',
    active: true,
    bookings: 4,
    earned: 96,
  },
  {
    id: 2,
    title: 'Covered Garage Spot',
    address: '500 Commerce Dr, Springfield',
    price: 15,
    type: 'Garage',
    active: true,
    bookings: 2,
    earned: 120,
  },
  {
    id: 3,
    title: 'Open Driveway — Oak Lane',
    address: '17 Oak Lane, Springfield',
    price: 6,
    type: 'Driveway',
    active: false,
    bookings: 1,
    earned: 24,
  },
]

const MOCK_REQUESTS = [
  {
    id: 1,
    renter: 'Alex P.',
    listing: 'Private Driveway — Downtown',
    date: '2026-11-12',
    startTime: '09:00',
    endTime: '12:00',
    hours: 3,
    price: 8,
    status: 'pending',
  },
  {
    id: 2,
    renter: 'Jordan M.',
    listing: 'Covered Garage Spot',
    date: '2026-11-14',
    startTime: '14:00',
    endTime: '18:00',
    hours: 4,
    price: 15,
    status: 'pending',
  },
  {
    id: 3,
    renter: 'Sam T.',
    listing: 'Private Driveway — Downtown',
    date: '2026-11-08',
    startTime: '10:00',
    endTime: '13:00',
    hours: 3,
    price: 8,
    status: 'confirmed',
  },
  {
    id: 4,
    renter: 'Casey R.',
    listing: 'Open Driveway — Oak Lane',
    date: '2026-11-01',
    startTime: '08:00',
    endTime: '10:00',
    hours: 2,
    price: 6,
    status: 'completed',
  },
]

const TYPE_COLORS = {
  Driveway: { bg: '#eff8ff', color: '#1a7fd4' },
  Covered:  { bg: '#f0fdf4', color: '#16a34a' },
  Lot:      { bg: '#fff7ed', color: '#ea580c' },
  Garage:   { bg: '#faf5ff', color: '#9333ea' },
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#fffbeb', color: '#d97706', dot: '#f59e0b' },
  confirmed: { label: 'Confirmed', bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  completed: { label: 'Completed', bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(t) {
  const [h, m] = t.split(':')
  const hour = Number(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

export default function HostDashboardPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [activeTab, setActiveTab] = useState('Requests')

  const totalEarned = MOCK_LISTINGS.reduce((s, l) => s + l.earned, 0)
  const totalBookings = MOCK_LISTINGS.reduce((s, l) => s + l.bookings, 0)
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const activeListings = MOCK_LISTINGS.filter((l) => l.active).length

  const handleAccept = (id) => {
    // TODO: call backend PATCH /bookings/:id/confirm
    setRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: 'confirmed' } : r)
    )
  }

  const handleDecline = (id) => {
    // TODO: call backend PATCH /bookings/:id/decline
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'Requests') return r.status === 'pending'
    if (activeTab === 'Confirmed') return r.status === 'confirmed'
    if (activeTab === 'Completed') return r.status === 'completed'
    return true
  })

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.main}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Host Dashboard</h1>
            <p className={styles.subtitle}>Manage your listings and booking requests</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.switchBtn} onClick={() => navigate('/home')}>
              🚗 Switch to renting
            </button>
            <button className={styles.addBtn} onClick={() => navigate('/listings/new')}>
              + Add listing
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className={styles.summaryRow}>
          <SummaryCard icon="💰" label="Total earned" value={`$${totalEarned}`} color="#16a34a" />
          <SummaryCard icon="📅" label="Total bookings" value={totalBookings} color="#1a7fd4" />
          <SummaryCard icon="🏠" label="Active listings" value={activeListings} color="#9333ea" />
          <SummaryCard icon="🔔" label="Pending requests" value={pendingCount} color="#d97706" highlight={pendingCount > 0} />
        </div>

        <div className={styles.layout}>

          {/* LEFT — booking requests */}
          <div className={styles.left}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Booking requests</h2>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {['Requests', 'Confirmed', 'Completed'].map((tab) => (
                <button
                  key={tab}
                  className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                  {tab === 'Requests' && pendingCount > 0 && (
                    <span className={styles.tabBadge}>{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>

            {filteredRequests.length > 0 ? (
              <div className={styles.requestList}>
                {filteredRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📭</span>
                <p className={styles.emptyTitle}>No {activeTab.toLowerCase()} bookings</p>
              </div>
            )}
          </div>

          {/* RIGHT — my listings */}
          <div className={styles.right}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>My listings</h2>
              <button className={styles.addListingBtn} onClick={() => navigate('/listings/new')}>
                + Add
              </button>
            </div>

            <div className={styles.listingList}>
              {MOCK_LISTINGS.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

function SummaryCard({ icon, label, value, color, highlight }) {
  return (
    <div className={`${styles.summaryCard} ${highlight ? styles.summaryCardHighlight : ''}`}>
      <span className={styles.summaryIcon}>{icon}</span>
      <div>
        <p className={styles.summaryValue} style={{ color }}>{value}</p>
        <p className={styles.summaryLabel}>{label}</p>
      </div>
    </div>
  )
}

function RequestCard({ request, onAccept, onDecline }) {
  const status = STATUS_CONFIG[request.status]
  const total = request.price * request.hours

  return (
    <div className={styles.requestCard}>
      <div className={styles.requestTop}>
        <div>
          <div className={styles.requestNameRow}>
            <div className={styles.renterAvatar}>{request.renter[0]}</div>
            <span className={styles.renterName}>{request.renter}</span>
          </div>
          <p className={styles.requestListing}>📍 {request.listing}</p>
        </div>
        <span
          className={styles.statusBadge}
          style={{ background: status.bg, color: status.color }}
        >
          <span className={styles.statusDot} style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>

      <div className={styles.requestMeta}>
        <span>📅 {formatDate(request.date)}</span>
        <span>🕐 {formatTime(request.startTime)} – {formatTime(request.endTime)}</span>
        <span>💰 ${total} ({request.hours} hr{request.hours > 1 ? 's' : ''})</span>
      </div>

      {request.status === 'pending' && (
        <div className={styles.requestActions}>
          <button className={styles.acceptBtn} onClick={() => onAccept(request.id)}>
            ✓ Accept
          </button>
          <button className={styles.declineBtn} onClick={() => onDecline(request.id)}>
            ✕ Decline
          </button>
        </div>
      )}
    </div>
  )
}

function ListingRow({ listing }) {
  const typeStyle = TYPE_COLORS[listing.type] ?? { bg: '#f1f5f9', color: '#475569' }

  return (
    <div className={styles.listingRow}>
      {/* Top — badge + title */}
      <div className={styles.listingLeft}>
        <span
          className={styles.listingTypeBadge}
          style={{ background: typeStyle.bg, color: typeStyle.color }}
        >
          {listing.type}
        </span>
        <p className={styles.listingTitle}>{listing.title}</p>
      </div>

      {/* Address */}
      <p className={styles.listingAddress}>📍 {listing.address}</p>

      {/* Bottom — status, price, earnings */}
      <div className={styles.listingRight}>
        <span className={`${styles.activeStatus} ${listing.active ? styles.activeOn : styles.activeOff}`}>
          {listing.active ? '● Active' : '○ Paused'}
        </span>
        <p className={styles.listingPrice}>${listing.price}/hr</p>
        <p className={styles.listingEarned}>${listing.earned} earned</p>
      </div>
    </div>
  )
}
