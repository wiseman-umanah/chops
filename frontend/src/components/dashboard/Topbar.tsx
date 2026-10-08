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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <>
      <header className="shrink-0 sticky top-0 z-50 py-3 sm:py-8 border-b sm:border-0 border-neutral-200 bg-white">
        {/* Pill container */}
        <div className="flex max-w-[90%] mx-auto items-center justify-between sm:border sm:border-neutral-200 sm:rounded-full bg-white px-2 sm:px-5 py-3">

          {/* Left: logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <Logo width={32} height={32} />
            <span style={{ fontSize: 20, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
              Chop
            </span>
          </Link>

          {/* Right: desktop controls */}
          <div className="flex items-center gap-3">
            {/* Notification + wallet pill — desktop only */}
            <div className="hidden sm:flex items-center gap-1 border border-[#FF6900] rounded-full px-6 py-3">
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

            {/* Profile dropdown — desktop only */}
            <div className="hidden sm:block">
              <ProfileDropdown />
            </div>

            {/* Mobile: avatar + hamburger */}
            <div className="flex sm:hidden items-center gap-2">
              <MobileAvatar />
              <button
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
              >
                <RemixIcon name="ri-menu-3-line" size={22} color="#374151" />
                {/* Red dot if unread notifications */}
                {!!unreadCount && unreadCount > 0 && (
                  <span
                    className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ background: '#ef4444' }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile sidebar */}
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadCount={unreadCount ?? 0}
      />
    </>
  )
}

// ── Mobile avatar (read-only, no dropdown) ────────────────────────────────────

function MobileAvatar() {
  const { user } = useAuth()
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  return (
    <div
      className="w-8 h-8 rounded-full overflow-hidden shrink-0 border-2 border-neutral-200 flex items-center justify-center"
    >
      {user?.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={`${user.firstName} ${user.lastName ?? ''}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-[11px] font-bold text-white"
          style={{ background: '#FF6900' }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}

// ── Mobile sidebar ─────────────────────────────────────────────────────────────

interface MobileSidebarProps {
  open: boolean
  onClose: () => void
  unreadCount: number
}

function MobileSidebar({ open, onClose, unreadCount }: MobileSidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  async function handleLogout() {
    onClose()
    await logout()
    navigate('/login', { replace: true })
  }

  function go(path: string) {
    onClose()
    navigate(path)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out sm:hidden
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header: user info + close */}
        <div className="px-5 pt-6 pb-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[14px] font-bold text-white"
                style={{ background: user?.imageUrl ? 'transparent' : '#FF6900' }}
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.firstName} className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-neutral-900 truncate leading-tight">
                  {user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'User'}
                </p>
                {user?.email && (
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">{user.email}</p>
                )}
              </div>
            </div>
            {/* Close button */}
            <button
              aria-label="Close menu"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors shrink-0"
            >
              <RemixIcon name="ri-close-line" size={20} color="#ef4444" />
            </button>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {/* Notifications */}
          <button
            onClick={() => go('/dashboard/notifications')}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <RemixIcon name="ri-notification-3-line" size={18} color="#6b7280" />
              <span className="text-[14px] font-medium text-neutral-700">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span
                className="min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1.5"
                style={{ background: '#ef4444' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Wallet */}
          <button
            onClick={() => go('/dashboard/wallet')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <RemixIcon name="ri-wallet-3-line" size={18} color="#6b7280" />
            <span className="text-[14px] font-medium text-neutral-700">Wallet</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => go('/dashboard/settings')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <RemixIcon name="ri-settings-3-line" size={18} color="#6b7280" />
            <span className="text-[14px] font-medium text-neutral-700">Settings</span>
          </button>
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-8 pt-2 border-t border-neutral-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors"
          >
            <RemixIcon name="ri-logout-box-r-line" size={18} color="#ef4444" />
            <span className="text-[14px] font-medium text-red-500">Sign out</span>
          </button>
        </div>
      </div>
    </>
  )
}

// ── Desktop profile dropdown ───────────────────────────────────────────────────

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
                className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
                style={{ background: user?.imageUrl ? 'transparent' : '#FF6900' }}
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.firstName} className="w-full h-full object-cover" />
                ) : initials}
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
