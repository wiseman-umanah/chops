import { Link, useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import RemixIcon from '@/components/RemixIcon'
import Logo from '@/components/Logo'

export default function Topbar() {
  const navigate = useNavigate()
  const unreadCount = useQuery(api.notifications.unreadCount, {})

  return (
    <header className="shrink-0 sticky top-0 z-50 py-8">
      {/* Pill container */}
      <div className="flex max-w-[90%] mx-auto items-center justify-between border border-neutral-200 rounded-full bg-white px-5 py-3">

        {/* Left: logo */}
        <Link to="/dashboard" className="flex items-center gap-2">
          <Logo width={32} height={32} />
          <span style={{ fontSize: 20, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
            Chop
          </span>
        </Link>

        {/* Right: icons + avatar */}
        <div className="flex items-center gap-3">
          {/* Notification + wallet pill */}
          <div className="flex items-center gap-1 border border-[#FF6900] rounded-full px-6 py-3">
            <button
              aria-label="Notifications"
              onClick={() => navigate('/dashboard/notifications')}
              className="relative text-[#B2B2B2] hover:text-[#FF6900] transition-colors"
            >
              <RemixIcon name="ri-notification-3-fill" />
              {!!unreadCount && unreadCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                  style={{ background: '#FF6900' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <span className="w-px h-4 bg-neutral-200 mx-1" />
            <button
              aria-label="Wallet"
              onClick={() => navigate('/dashboard/wallet')}
              className="text-[#B2B2B2] hover:text-[#FF6900] transition-colors"
            >
              <RemixIcon name="ri-wallet-3-fill" />
            </button>
          </div>

          {/* Profile dropdown */}
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}

function ProfileDropdown() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        id="profile-menu-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 transition-all duration-150"
        style={{ borderColor: open ? '#FF6900' : '#e5e7eb' }}
      >
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={`${user.firstName} ${user.lastName ?? ''}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[13px] font-bold text-white"
            style={{ background: '#FF6900' }}
          >
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          id="profile-dropdown"
          className="absolute right-0 mt-2 w-56 rounded-2xl border border-neutral-100 bg-white shadow-xl overflow-hidden z-50"
          style={{ top: '100%' }}
        >
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold text-white"
                style={{ background: '#FF6900' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-neutral-900 truncate leading-tight">
                  {user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'User'}
                </p>
                {user?.email && (
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">{user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate('/dashboard/settings') }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <RemixIcon name="ri-settings-3-line" size={16} color="#6b7280" />
              Settings
            </button>
            <button
              id="sign-out-btn"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <RemixIcon name="ri-logout-box-r-line" size={16} color="#ef4444" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
