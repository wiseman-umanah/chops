import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Seo } from '@/hooks/useSeo'
import { useAuth } from '@/contexts/AuthContext'
import RemixIcon from '@/components/RemixIcon'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'

const BRAND = '#FF6900'

type StatusFilter = 'all' | 'active' | 'closed' | 'inactive'

const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank', 'EcoBank', 'Fidelity Bank', 'First Bank',
  'First City Monument Bank (FCMB)', 'Globus Bank', 'Guaranty Trust Bank (GTB)',
  'Heritage Bank', 'Keystone Bank', 'Kuda Bank', 'Moniepoint',
  'OPay', 'Palmpay', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC',
  'Standard Chartered', 'Sterling Bank', 'Titan Trust Bank', 'Union Bank',
  'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
]

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

const MODE_META: Record<string, { label: string; color: string; icon: string }> = {
  food:      { label: 'Chop Food', color: '#FF6900', icon: 'ri-restaurant-2-fill' },
  'chop-in': { label: 'Chop In',   color: '#00C950', icon: 'ri-hand-coin-fill' },
  bill:      { label: 'Chop Bill', color: '#FB2C36', icon: 'ri-coupon-5-line' },
}

const QUICK_ACTIONS = [
  {
    label: 'Chop Food',
    desc: 'Group meal order with dish itemization and per-person item assignment',
    iconBg: '#FF6900',
    icon: 'ri-restaurant-2-fill',
    path: '/dashboard/chop-food',
  },
  {
    label: 'Chop In',
    desc: 'Pool funds for gifts, trips, or events with a target progress bar.',
    iconBg: '#00C950',
    icon: 'ri-hand-coin-fill',
    path: '/dashboard/chop-in',
  },
  {
    label: 'Chop Bill',
    desc: 'Split expenses equally by custom amount, or by percentage.',
    iconBg: '#FB2C36',
    icon: 'ri-coupon-5-line',
    path: '/dashboard/chop-bill',
  },
]

// ── Finalize payout modal ──────────────────────────────────────────────────

interface FinalizeModalProps {
  session: { _id: Id<'sessions'>; name: string; paidAmount: number }
  onClose: () => void
}

function FinalizeModal({ session, onClose }: FinalizeModalProps) {
  const requestPayout = useMutation(api.payouts.requestPayout)

  const [recipientName,  setRecipientName]  = useState('')
  const [accountNumber,  setAccountNumber]  = useState('')
  const [bankName,       setBankName]       = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [done,           setDone]           = useState(false)

  async function handlePayout() {
    if (!recipientName.trim() || !accountNumber.trim() || !bankName) {
      setError('Please fill in all fields.')
      return
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError('Account number must be exactly 10 digits.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await requestPayout({
        sessionId: session._id,
        recipientName: recipientName.trim(),
        accountNumber: accountNumber.trim(),
        bankName,
      })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payout failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-3xl w-full max-w-[420px] p-7 shadow-2xl"
      >
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#dcfce7' }}>
              <RemixIcon name="ri-checkbox-circle-fill" size={28} color="#16a34a" />
            </div>
            <p className="text-[18px] font-extrabold text-neutral-900 mb-1">Payout submitted!</p>
            <p className="text-[13px] text-neutral-500 mb-6">
              Your payout of {formatNaira(session.paidAmount)} is being processed to {bankName}.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-full text-[14px] font-bold text-white"
              style={{ background: BRAND }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-extrabold text-neutral-900">Finalize payout</h3>
                <p className="text-[13px] text-neutral-400 mt-0.5">{session.name}</p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                <RemixIcon name="ri-close-line" size={18} color="#6b7280" />
              </button>
            </div>

            <div className="rounded-2xl px-5 py-3 mb-5 flex justify-between items-center"
              style={{ background: '#fff7ed' }}>
              <span className="text-[13px] text-neutral-500">Amount to receive</span>
              <span className="text-[18px] font-extrabold" style={{ color: BRAND }}>
                {formatNaira(session.paidAmount)}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="Full name on account"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">
                  Account Number
                </label>
                <input
                  type="text"
                  placeholder="10-digit account number"
                  value={accountNumber}
                  maxLength={10}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">
                  Bank
                </label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors bg-white appearance-none"
                >
                  <option value="">Select bank…</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-[12px] font-medium px-1" style={{ color: '#dc2626' }}>
                {error}
              </p>
            )}

            <button
              onClick={handlePayout}
              disabled={loading}
              className="mt-5 w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: BRAND }}
            >
              {loading ? 'Processing…' : 'Pay Out'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

type Session = NonNullable<ReturnType<typeof useQuery<typeof api.sessions.getOrganizerSessions>>> extends (infer T)[] ? T : never

export default function OverviewPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [filter, setFilter]           = useState<StatusFilter>('all')
  const [deletingId, setDeletingId]   = useState<Id<'sessions'> | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [finalizeSession, setFinalizeSession] = useState<Session | null>(null)

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

  function handleEdit(session: Session) {
    const path =
      session.mode === 'food'     ? '/dashboard/chop-food' :
      session.mode === 'chop-in'  ? '/dashboard/chop-in'   :
                                    '/dashboard/chop-bill'
    navigate(path, { state: { editSession: session } })
  }

  function handleShare(slug: string, name: string, totalAmount: number, mode: string) {
    navigate('/dashboard/share', { state: { slug, title: name, total: totalAmount, mode } })
  }

  const TAB_LABELS: Record<StatusFilter, string> = {
    all: 'All', active: 'Active', closed: 'Completed', inactive: 'Inactive',
  }

  const emptyMsg: Record<StatusFilter, string> = {
    all: 'No chops yet. Create one below!',
    active: 'No active chops.',
    closed: 'No completed chops yet.',
    inactive: 'No inactive chops yet.',
  }

  return (
    <div>
      <Seo title="Dashboard" path="/dashboard" noIndex />
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
            key={action.label}
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
            {(['all', 'active', 'closed', 'inactive'] as StatusFilter[]).map(f => (
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
                {TAB_LABELS[f]}
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
            <p className="text-[14px] text-neutral-400">{emptyMsg[filter]}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="flex flex-col gap-3">
              {sessions.map((session, i) => {
                const meta = MODE_META[session.mode] ?? MODE_META.food
                const isActive   = session.status === 'active'
                const isComplete = session.status === 'closed'
                const isInactive = session.status === 'inactive'
                const isDeleting = deletingId === session._id

                const statusBadge = isActive
                  ? { label: 'Active',    bg: '#dcfce7', color: '#166534' }
                  : isComplete
                  ? { label: 'Completed', bg: '#fef9c3', color: '#92400e' }
                  : { label: 'Inactive',  bg: '#f3f4f6', color: '#6b7280' }

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
                          style={{ background: statusBadge.bg, color: statusBadge.color }}
                        >
                          {statusBadge.label}
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
                      {/* Share always visible */}
                      <button
                        onClick={() => handleShare(session.slug, session.name, session.totalAmount, session.mode)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
                        title="Share link"
                      >
                        <RemixIcon name="ri-share-line" size={16} color="#6b7280" />
                      </button>

                      {/* Finalize — completed food/bill only (chop-in is via wallet) */}
                      {isComplete && session.mode !== 'chop-in' && (
                        <button
                          onClick={() => setFinalizeSession(session)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold text-white transition-opacity hover:opacity-85"
                          style={{ background: BRAND }}
                          title="Finalize payout"
                        >
                          <RemixIcon name="ri-bank-card-line" size={13} color="#fff" />
                          Finalize
                        </button>
                      )}

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

                      {isInactive && (
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <RemixIcon name="ri-checkbox-circle-fill" size={13} color="#16a34a" />
                          Paid out
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Finalize modal */}
      <AnimatePresence>
        {finalizeSession && (
          <FinalizeModal
            session={finalizeSession}
            onClose={() => setFinalizeSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
