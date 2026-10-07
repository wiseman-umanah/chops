import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import RemixIcon from '@/components/RemixIcon'
import Logo from '@/components/Logo'
import profileImg from '../../../asset/images/profile.png'

export default function Topbar() {
  return (
    <header className="shrink-0 sticky top-0 z-50 py-8">
      {/* Pill container — matches mockup: logo left, actions right, rounded full border */}
      <div className="flex max-w-[90%] mx-auto items-center justify-between border border-neutral-200 rounded-full bg-white px-5 py-3">

        {/* Left: logo */}
        <Link to="/dashboard" className="flex items-center gap-2">
          <Logo width={32} height={32} />
          <span style={{ fontSize: 20, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
            Chop
          </span>
        </Link>

        {/* Right: bell + account icon pill + avatar */}
        <div className="flex items-center gap-3">
          {/* Notification + account icon grouped pill */}
          <div className="flex items-center gap-1 border border-[#FF6900] rounded-full px-6 py-3">
            <button aria-label="Notifications" className="text-[#B2B2B2] hover:text-[#FF6900] transition-colors">
              <RemixIcon name="ri-notification-3-fill" />
            </button>
            <span className="w-px h-4 bg-neutral-200 mx-1" />
            <button aria-label="Account" className="text-[#B2B2B2] hover:text-[#FF6900] transition-colors">
              <RemixIcon name="ri-wallet-3-fill" />
            </button>
          </div>

          {/* Profile photo */}
          <ProfileAvatar />
        </div>
      </div>
    </header>
  )
}

function ProfileAvatar() {
  const { user } = useAuth()
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-neutral-100">
      {/* Always show profile.png for demo; swap for user.avatarUrl when API is ready */}
      <img
        src={profileImg}
        alt={user ? `${user.firstName} ${user.lastName}` : 'Profile'}
        className="w-full h-full object-cover"
      />
    </div>
  )
}
