import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import RemixIcon from '@/components/RemixIcon'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

const BRAND = '#FF6900'

type StatusFilter = 'all' | 'active' | 'closed'

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

const MODE_META: Record<string, { label: string; color: string; icon: string }> = {
  food:     { label: 'Chop Food', color: '#FF6900', icon: 'ri-restaurant-2-fill' },
  'chop-in': { label: 'Chop In',  color: '#00C950', icon: 'ri-hand-coin-fill' },
  bill:     { label: 'Chop Bill', color: '#FB2C36', icon: 'ri-coupon-5-line' },
}

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
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [filter, setFilter]           = useState<StatusFilter>('all')
  const [deletingId, setDeletingId]   = useState<Id<'sessions'> | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const stats    = useQuery(api.sessions.getSessionStats, {})
  const sessions = useQuery(
    api.sessions.getOrganizerSessions,
    filter === 'all' ? {} : { status: filter },
  )

  const deleteSession = useMutation(api.sessions.deleteSession)

  const activeChops = stats?.activeChops ?? 0
  const pendingKobo = stats?.pendingKobo ?? 0
  const settledKobo = stats?.settledKobo ?? 0

  const STATS = [
    {
      label: 'Active Chops',
      value: String(activeChops),
      valueColor: BRAND,
      badge: null,
      bg: '#f5f5f5',
    },
    {
      label: 'Pending collections',
      value: pendingKobo > 0 ? formatNaira(pendingKobo) : '₦0',
      valueColor: BRAND,
      badge: { text: 'Pending', bg: '#fed7aa', color: '#9a3412' },
      bg: '#fff7ed',
    },
    {
      label: 'Total settled',
      value: settledKobo > 0 ? formatNaira(settledKobo) : '₦0',
      valueColor: '#16a34a',
      badge: { text: 'Settled', bg: '#dcfce7', color: '#166534' },
      bg: '#f0fdf4',
    },
  ]

  async function handleDelete(sessionId: Id<'sessions'>) {
    setDeletingId(sessionId)
    setDeleteError(null)
    try {
      await deleteSession({ sessionId })
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete chop')
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(session: NonNullable<typeof sessions>[number]) {
    const path =
      session.mode === 'food'     ? '/dashboard/chop-food' :
      session.mode === 'chop-in'  ? '/dashboard/chop-in'   :
                                    '/dashboard/chop-bill'

    navigate(path, { state: { editSession: session } })
  }

  function handleShare(slug: string, name: string, totalAmount: number, mode: string) {
    navigate('/dashboard/share', { state: { slug, title: name, total: totalAmount, mode } })
  }

  return (
    <div>
      {/* Greeting */}
      <div className="mb-12">
        <h1 className="text-[28px] sm:text-[40px] font-extrabold leading-tight">
          Welcome back, {user?.firstName ?? 'there'}!
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
              {stats === undefined ? '…' : stat.value}
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

	  {/* ── Your Chops ─────────────────────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center justify-between my-10">
          <h2 className="text-[18px] font-bold text-neutral-900">Your Chops</h2>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-neutral-100 rounded-full p-1">
            {(['all', 'active', 'closed'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors"
                style={
                  filter === f
                    ? { background: '#fff', color: '#18181b', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { color: '#6b7280' }
                }
              >
                {f === 'closed' ? 'Inactive' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {deleteError && (
          <div className="mb-4 rounded-2xl px-5 py-3 text-[13px] font-medium" style={{ background: '#fff1f2', color: '#be123c' }}>
            {deleteError}
          </div>
        )}

        {sessions === undefined ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-neutral-100 bg-neutral-50 h-24 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-14 text-center">
            <p className="text-[14px] text-neutral-400">
              {filter === 'active' ? 'No active chops.' : filter === 'closed' ? 'No inactive chops yet.' : 'No chops yet. Create one below!'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="flex flex-col gap-3">
              {sessions.map((session, i) => {
                const meta = MODE_META[session.mode] ?? MODE_META.food
                const isActive = session.status === 'active'
                const isDeleting = deletingId === session._id

                return (
                  <motion.div
                    key={session._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className="border border-neutral-200 rounded-2xl px-5 py-4 flex items-center gap-4"
                  >
                    {/* Mode icon */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: meta.color }}
                    >
                      <RemixIcon name={meta.icon} size={18} color="#fff" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[14px] font-bold text-neutral-900 truncate">{session.name}</span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={
                            isActive
                              ? { background: '#dcfce7', color: '#166534' }
                              : { background: '#f3f4f6', color: '#6b7280' }
                          }
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-[12px] text-neutral-400 font-mono mb-1">{session.slug}</p>
                      <div className="flex items-center gap-3 text-[12px] text-neutral-500">
                        <span>{session.paidCount}/{session.participantCount} paid</span>
                        <span>·</span>
                        <span className="text-[#16a34a] font-medium">{formatNaira(session.paidAmount)} settled</span>
                        {session.pendingAmount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-[#9a3412] font-medium">{formatNaira(session.pendingAmount)} pending</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Share link button — always visible */}
                      <button
                        onClick={() => handleShare(session.slug, session.name, session.totalAmount, session.mode)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
                        title="Share link"
                      >
                        <RemixIcon name="ri-share-line" size={16} color="#6b7280" />
                      </button>

                      {session.canEdit && (
                        <>
                          <button
                            onClick={() => handleEdit(session)}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-orange-50 transition-colors"
                            title="Edit"
                          >
                            <RemixIcon name="ri-pencil-line" size={16} color={BRAND} />
                          </button>
                          <button
                            onClick={() => handleDelete(session._id)}
                            disabled={isDeleting}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Delete"
                          >
                            <RemixIcon name="ri-delete-bin-5-fill" size={16} color="#FB2C36" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
