import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

// Mock stats matching the mockup values
const STATS = [
  {
    label: 'Active Chops',
    value: '3',
    valueColor: BRAND,
    badge: null,
    bg: '#f5f5f5',
  },
  {
    label: 'Pending collections',
    value: '₦84,500',
    valueColor: BRAND,
    badge: { text: 'Pending', bg: '#fed7aa', color: '#9a3412' },
    bg: '#fff7ed',
  },
  {
    label: 'Total settled',
    value: '₦212,000',
    valueColor: '#16a34a',
    badge: { text: 'Settled', bg: '#dcfce7', color: '#166534' },
    bg: '#f0fdf4',
  },
]

const QUICK_ACTIONS = [
  {
    mode: 'food' as const,
    label: 'Chop Food',
    desc: 'Group meal order with dish itemization and per-person item assignment',
    iconBg: '#FF6900',
    icon: 'ri-restaurant-2-fill',
    path: '/dashboard/chop-food',
  },
  {
    mode: 'chop-in' as const,
    label: 'Chop In',
    desc: 'Pool funds for gifts, trips, or events with a target progress bar.',
    iconBg: '#00C950',
    icon: 'ri-hand-coin-fill',
    path: '/dashboard/chop-in',
  },
  {
    mode: 'bill' as const,
    label: 'Chop Bill',
    desc: 'Split expenses equally by custom amount, or by percentage.',
    iconBg: '#FB2C36',
    icon: 'ri-coupon-5-line',
    path: '/dashboard/chop-bill',
  },
]

export default function OverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div>
      {/* Greeting */}
      <div className="mb-12">
        <h1 className="text-[28px] sm:text-[40px] font-extrabold leading-tight">
          Welcome back, {user?.firstName ?? 'Alex'}!
        </h1>
        <p className="text-[15px] mt-1">Here's where your Chops stand today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07, ease: 'easeOut' }}
            className="rounded-2xl py-10 px-15"
            style={{ background: stat.bg }}
          >
            <div className="flex items-center gap-4 mb-3">
              <span className="text-[13px] text-neutral-600">{stat.label}</span>
              {stat.badge && (
                <span
                  className="text-[11px] px-5 py-1.5 rounded-full"
                  style={{ background: stat.badge.bg, color: stat.badge.color }}
                >
                  {stat.badge.text}
                </span>
              )}
            </div>
            <p className="text-[32px] leading-none" style={{ color: stat.valueColor }}>
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="text-[18px] font-bold text-neutral-900 mb-5">Chop Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.mode}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.07, ease: 'easeOut' }}
            onClick={() => navigate(action.path)}
            className="text-left border border-neutral-200 rounded-2xl p-6 hover:border-neutral-300 hover:shadow-sm transition-all group"
          >
            {/* Icon circle */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
              style={{ background: action.iconBg }}
            >
              <RemixIcon name={action.icon} size={20} color="#fff" />
            </div>
            <p className="text-[15px] font-bold text-neutral-900 mb-1.5">{action.label}</p>
            <p className="text-[13px] text-neutral-400 leading-relaxed">{action.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
