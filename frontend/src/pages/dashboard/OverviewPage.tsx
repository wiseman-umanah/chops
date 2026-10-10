import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Seo } from '@/hooks/useSeo'
import { useAuth } from '@/contexts/AuthContext'
import RemixIcon from '@/components/RemixIcon'
import { useQuery, useAction, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState, useEffect, useRef } from 'react'
import type { Id } from '../../../../convex/_generated/dataModel'
import JoinSessionModal from '@/components/JoinSessionModal'

const BRAND = '#FF6900'

type StatusFilter = 'all' | 'active' | 'closed' | 'inactive'

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
  const listBanks     = useAction(api.payouts.listBanks)
  const resolveAcct   = useAction(api.payouts.resolveAccount)
  const requestPayout = useAction(api.payouts.requestPayout)

  // Bank search
  const [banks,        setBanks]        = useState<{ name: string; code: string }[]>([])
  const [banksLoading, setBanksLoading] = useState(true)
  const [bankSearch,   setBankSearch]   = useState('')
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null)
  const [bankOpen,     setBankOpen]     = useState(false)
  const bankRef = useRef<HTMLDivElement>(null)

  // Account number + resolve
  const [accountNumber,  setAccountNumber]  = useState('')
  const [resolvedName,   setResolvedName]   = useState<string | null>(null)
  const [resolving,      setResolving]      = useState(false)
  const [resolveError,   setResolveError]   = useState<string | null>(null)

  // Submit
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [done,     setDone]     = useState(false)
  const [doneInfo, setDoneInfo] = useState<{ resolvedName: string } | null>(null)

  // Load bank list on mount
  useEffect(() => {
    listBanks().then(setBanks).catch(() => setBanks([])).finally(() => setBanksLoading(false))
  }, [])

  // Close bank dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (bankRef.current && !bankRef.current.contains(e.target as Node)) setBankOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Auto-resolve when 10 digits + bank selected
  useEffect(() => {
    if (accountNumber.length !== 10 || !selectedBank) {
      setResolvedName(null)
      setResolveError(null)
      return
    }
    setResolving(true)
    setResolvedName(null)
    setResolveError(null)
    resolveAcct({ accountNumber, bankCode: selectedBank.code })
      .then(({ accountName }) => setResolvedName(accountName))
      .catch(e => setResolveError(e instanceof Error ? e.message : 'Could not verify account'))
      .finally(() => setResolving(false))
  }, [accountNumber, selectedBank?.code])

  const filteredBanks = bankSearch
    ? banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : banks

  const canSubmit = !!selectedBank && accountNumber.length === 10 && !!resolvedName && !resolving

  async function handlePayout() {
    if (!canSubmit || !selectedBank) return
    setError(null)
    setLoading(true)
    try {
      const result = await requestPayout({
        sessionId: session._id,
        accountNumber,
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
      })
      setDoneInfo({ resolvedName: result.resolvedName })
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
            <p className="text-[18px] font-extrabold text-neutral-900 mb-1">Payout initiated!</p>
            <p className="text-[13px] text-neutral-500 mb-2">
              {formatNaira(session.paidAmount)} is on its way to:
            </p>
            <p className="text-[15px] font-bold text-neutral-900 mb-0.5">{doneInfo?.resolvedName}</p>
            <p className="text-[13px] text-neutral-400 mb-6">{selectedBank?.name} · ••••{accountNumber.slice(-4)}</p>
            <p className="text-[12px] text-neutral-400 mb-6">You'll get a notification when it lands in your account.</p>
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

            {/* Amount */}
            <div className="rounded-2xl px-5 py-3 mb-5 flex justify-between items-center"
              style={{ background: '#fff7ed' }}>
              <span className="text-[13px] text-neutral-500">Amount to receive</span>
              <span className="text-[18px] font-extrabold" style={{ color: BRAND }}>
                {formatNaira(session.paidAmount)}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {/* Bank searchable dropdown */}
              <div ref={bankRef}>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">Bank</label>
                <button
                  type="button"
                  onClick={() => setBankOpen(v => !v)}
                  className="w-full flex items-center justify-between border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] bg-white transition-colors hover:border-neutral-300"
                  style={{ borderColor: bankOpen ? '#FF6900' : '' }}
                >
                  <span className={selectedBank ? 'text-neutral-800' : 'text-neutral-400'}>
                    {selectedBank?.name ?? (banksLoading ? 'Loading banks…' : 'Select bank…')}
                  </span>
                  <RemixIcon name="ri-arrow-down-s-line" size={16} color="#9ca3af"
                    style={{ transform: bankOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
                </button>
                {bankOpen && (
                  <div className="mt-1 border border-neutral-100 rounded-2xl bg-white shadow-lg overflow-hidden z-50 relative">
                    <div className="p-2 border-b border-neutral-100">
                      <input
                        autoFocus
                        type="text"
                        value={bankSearch}
                        onChange={e => setBankSearch(e.target.value)}
                        placeholder="Search bank…"
                        className="w-full px-3 py-2 text-[13px] rounded-xl bg-neutral-50 outline-none focus:bg-white border border-transparent focus:border-neutral-200 transition-colors"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredBanks.length === 0 ? (
                        <p className="text-[12px] text-neutral-400 text-center py-4">No banks found</p>
                      ) : filteredBanks.map(b => (
                        <button
                          key={b.code}
                          type="button"
                          onClick={() => { setSelectedBank(b); setBankOpen(false); setBankSearch(''); setResolvedName(null) }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-neutral-50 transition-colors"
                          style={{ color: selectedBank?.code === b.code ? BRAND : '#374151', fontWeight: selectedBank?.code === b.code ? 600 : 400 }}
                        >
                          {b.name}
                          {selectedBank?.code === b.code && <RemixIcon name="ri-check-line" size={13} color={BRAND} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Account number */}
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="10-digit NUBAN"
                  value={accountNumber}
                  maxLength={10}
                  onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, '')); setResolvedName(null) }}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors font-mono"
                />
              </div>

              {/* Resolved account name */}
              {resolving && (
                <div className="flex items-center gap-2 px-1">
                  <span className="w-3 h-3 rounded-full border-2 border-neutral-300 border-t-[#FF6900] animate-spin" />
                  <span className="text-[12px] text-neutral-400">Verifying account…</span>
                </div>
              )}
              {resolvedName && !resolving && (
                <div className="flex items-center gap-2 px-1">
                  <RemixIcon name="ri-checkbox-circle-fill" size={14} color="#16a34a" />
                  <span className="text-[13px] font-bold text-neutral-800">{resolvedName}</span>
                </div>
              )}
              {resolveError && !resolving && (
                <p className="text-[12px] text-red-500 px-1">{resolveError}</p>
              )}
            </div>

            {error && (
              <p className="mt-3 text-[12px] font-medium px-1" style={{ color: '#dc2626' }}>{error}</p>
            )}

            <button
              onClick={handlePayout}
              disabled={loading || !canSubmit}
              className="mt-5 w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: BRAND }}
            >
              {loading ? 'Sending payout…' : 'Confirm payout'}
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

  const [filter, setFilter]              = useState<StatusFilter>('all')
  const [deletingId, setDeletingId]      = useState<Id<'sessions'> | null>(null)
  const [deleteError, setDeleteError]    = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<'sessions'> | null>(null)
  const confirmTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmCloseId, setConfirmCloseId]   = useState<Id<'sessions'> | null>(null)
  const confirmCloseTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [closingId, setClosingId]        = useState<Id<'sessions'> | null>(null)
  const [closeError, setCloseError]      = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug]      = useState<string | null>(null)
  const [finalizeSession, setFinalizeSession] = useState<Session | null>(null)
  const [joinOpen, setJoinOpen]               = useState(false)

  const stats    = useQuery(api.sessions.getSessionStats, {})
  const sessions = useQuery(
    api.sessions.getOrganizerSessions,
    filter === 'all' ? {} : { status: filter },
  )

  const deleteSession  = useMutation(api.sessions.deleteSession)
  const closeSessionFn = useMutation(api.sessions.closeSession)

  const activeChops = stats?.activeChops ?? 0
  const pendingKobo = stats?.pendingKobo ?? 0
  const settledKobo = stats?.settledKobo ?? 0

  function formatCount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatNairaCompact(kobo: number) {
  const naira = kobo / 100

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(naira)
}

const STATS = [
  {
    label: 'Active Chops',
    value: activeChops,
    format: 'count' as const,
    valueColor: BRAND,
    badge: null,
    bg: '#f5f5f5',
  },
  {
    label: 'Pending collections',
    value: pendingKobo,
    format: 'naira' as const,
    valueColor: BRAND,
    badge: {
      text: 'Pending',
      bg: '#fed7aa',
      color: '#9a3412',
    },
    bg: '#fff7ed',
  },
  {
    label: 'Total settled',
    value: settledKobo,
    format: 'naira' as const,
    valueColor: '#16a34a',
    badge: {
      text: 'Settled',
      bg: '#dcfce7',
      color: '#166534',
    },
    bg: '#f0fdf4',
  },
]

  function requestDelete(sessionId: Id<'sessions'>) {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmDeleteId(sessionId)
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 4000)
  }

  async function confirmDelete(sessionId: Id<'sessions'>) {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmDeleteId(null)
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

  function requestClose(sessionId: Id<'sessions'>) {
    if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
    setConfirmCloseId(sessionId)
    confirmCloseTimerRef.current = setTimeout(() => setConfirmCloseId(null), 4000)
  }

  async function confirmClose(sessionId: Id<'sessions'>) {
    if (confirmCloseTimerRef.current) clearTimeout(confirmCloseTimerRef.current)
    setConfirmCloseId(null)
    setClosingId(sessionId)
    setCloseError(null)
    try {
      await closeSessionFn({ sessionId })
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : 'Could not close session')
    } finally {
      setClosingId(null)
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
		{STATS.map((stat, i) => {
			const displayValue =
			stats === undefined
				? '…'
				: stat.format === 'naira'
				? formatNairaCompact(stat.value)
				: formatCount(stat.value)

			return (
			<motion.div
				key={stat.label}
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{
				duration: 0.2,
				delay: i * 0.04,
				ease: 'easeOut',
				}}
				className="min-w-0 rounded-2xl py-10 px-6 sm:px-8"
				style={{ background: stat.bg }}
			>
				<div className="flex min-w-0 items-center gap-3 mb-3">
				<span className="min-w-0 text-[13px] text-neutral-600">
					{stat.label}
				</span>

				{stat.badge && (
					<span
					className="shrink-0 text-[11px] px-3 py-1.5 rounded-full"
					style={{
						background: stat.badge.bg,
						color: stat.badge.color,
					}}
					>
					{stat.badge.text}
					</span>
				)}
				</div>

				<p
				className="text-[32px] leading-none tabular-nums whitespace-nowrap"
				style={{ color: stat.valueColor }}
				title={
					stats === undefined
					? undefined
					: stat.format === 'naira'
						? formatNaira(stat.value)
						: stat.value.toLocaleString('en-NG')
				}
				>
				{displayValue}
				</p>
			</motion.div>
			)
		})}
		</div>

      {/* Quick Actions header + Join button */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[18px] font-bold text-neutral-900">Chop Quick Actions</h2>
        <button
          onClick={() => setJoinOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
        >
          <RemixIcon name="ri-login-box-line" size={15} color="#6b7280" />
          Join Session
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 + i * 0.04, ease: 'easeOut' }}
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
        <div className="flex flex-col sm:flex-row items-left sm:items-center justify-between my-10">
          <h2 className="text-[18px] font-bold text-neutral-900 mb-4">Your Chops</h2>

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

        {closeError && (
          <div className="mb-4 rounded-2xl px-5 py-3 text-[13px] font-medium" style={{ background: '#fff1f2', color: '#be123c' }}>
            {closeError}
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

				const isActive = session.status === 'active'
				const isComplete = session.status === 'closed'
				const isInactive = session.status === 'inactive'
				const isDeleting = deletingId === session._id
				const isClosing  = closingId === session._id

				const statusBadge = isActive
					? {
						label: 'Active',
						bg: '#dcfce7',
						color: '#166534',
					}
					: isComplete
					? {
						label: 'Completed',
						bg: '#fef9c3',
						color: '#92400e',
						}
					: {
						label: 'Inactive',
						bg: '#f3f4f6',
						color: '#6b7280',
						}

				return (
					<motion.div
					key={session._id}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.97 }}
					transition={{
						duration: 0.15,
						delay: i * 0.025,
					}}
					className="
						border border-neutral-200
						rounded-2xl
						px-4 sm:px-5
						py-4
						flex flex-col sm:flex-row
						sm:items-center
						gap-4
					"
					>
					{/* Top / main content */}
					<div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
						{/* Mode icon */}
						<div
						className="
							w-10 h-10
							rounded-full
							flex items-center justify-center
							shrink-0
						"
						style={{ background: meta.color }}
						>
						<RemixIcon
							name={meta.icon}
							size={18}
							color="#fff"
						/>
						</div>

						{/* Details */}
						<div className="flex-1 min-w-0">
						{/* Name + status */}
						<div className="flex items-center gap-2 mb-1 min-w-0">
							<span
							className="
								text-[14px]
								font-bold
								text-neutral-900
								truncate
								min-w-0
							"
							>
							{session.name}
							</span>

							<span
							className="
								text-[10px]
								font-semibold
								px-2
								py-0.5
								rounded-full
								shrink-0
							"
							style={{
								background: statusBadge.bg,
								color: statusBadge.color,
							}}
							>
							{statusBadge.label}
							</span>
						</div>

						{/* Slug — tap to copy */}
						<button
							type="button"
							onClick={() => {
								navigator.clipboard.writeText(session.slug).catch(() => {})
								setCopiedSlug(session.slug)
								setTimeout(() => setCopiedSlug(null), 2000)
							}}
							className="
								flex items-center gap-1.5
								text-[12px] font-mono
								mb-1.5
								text-neutral-400 hover:text-neutral-600
								transition-colors
								group
							"
							title="Copy session code"
						>
							<span>{session.slug}</span>
							<RemixIcon
								name={copiedSlug === session.slug ? 'ri-check-line' : 'ri-file-copy-line'}
								size={12}
								color={copiedSlug === session.slug ? '#16a34a' : '#9ca3af'}
							/>
							{copiedSlug === session.slug && (
								<span className="text-[11px] text-green-600 font-sans font-medium">Copied!</span>
							)}
						</button>

						{/* Payment details */}
						<div
							className="
							flex
							flex-wrap
							items-center
							gap-x-2
							gap-y-1
							text-[12px]
							text-neutral-500
							"
						>
							{/* Chop-in: show collected amount + contributor count, no X/Y paid ratio */}
							{session.mode === 'chop-in' ? (
							<>
								<span className="text-[#16a34a] font-medium whitespace-nowrap">
								{formatNaira(session.paidAmount)} collected
								</span>
								{session.paidCount > 0 && (
								<>
									<span className="text-neutral-300 hidden xs:inline">·</span>
									<span className="whitespace-nowrap">
									{session.paidCount} contributor{session.paidCount !== 1 ? 's' : ''}
									</span>
								</>
								)}
							</>
							) : (
							<>
								<span className="whitespace-nowrap">
								{session.paidCount}/{session.participantCount} paid
								</span>
	
								<span className="text-neutral-300 hidden xs:inline">
								·
								</span>
	
								<span className="text-[#16a34a] font-medium whitespace-nowrap">
								{formatNaira(session.paidAmount)} settled
								</span>
	
								{session.pendingAmount > 0 && (
								<>
									<span className="text-neutral-300 hidden xs:inline">
									·
									</span>
	
									<span className="text-[#9a3412] font-medium whitespace-nowrap">
									{formatNaira(session.pendingAmount)} pending
									</span>
								</>
								)}
							</>
							)}
						</div>
						</div>
					</div>

					{/* Actions */}
					<div
						className="
						flex
						items-center
						sm:justify-end justify-between
						gap-1.5
						sm:shrink-0
						border-t
						border-neutral-100
						pt-3
						sm:border-0
						sm:pt-0
						"
					>
						{/* Share */}
						<button
						onClick={() =>
							handleShare(
							session.slug,
							session.name,
							session.totalAmount,
							session.mode,
							)
						}
						className="
							w-8 h-8
							flex items-center justify-center
							rounded-full
							hover:bg-neutral-100
							transition-colors
						"
						title="Share link"
						aria-label="Share link"
						>
						<RemixIcon
							name="ri-share-line"
							size={16}
							color="#6b7280"
						/>
						</button>

						{/* Finalize (food/bill only) */}
						{isComplete && session.mode !== 'chop-in' && (
						<button
							onClick={() => setFinalizeSession(session)}
							className="
							flex
							items-center
							gap-1.5
							px-3
							py-1.5
							rounded-full
							text-[12px]
							font-bold
							text-white
							transition-opacity
							hover:opacity-85
							whitespace-nowrap
							"
							style={{ background: BRAND }}
							title="Finalize payout"
						>
							<RemixIcon
							name="ri-bank-card-line"
							size={13}
							color="#fff"
							/>
							<span>Finalize</span>
						</button>
						)}
	
						{/* Withdraw (chop-in completed only) */}
						{isComplete && session.mode === 'chop-in' && (
						<button
							onClick={() => navigate('/dashboard/wallet')}
							className="
							flex
							items-center
							gap-1.5
							px-3
							py-1.5
							rounded-full
							text-[12px]
							font-bold
							text-white
							transition-opacity
							hover:opacity-85
							whitespace-nowrap
							"
							style={{ background: '#00C950' }}
							title="Withdraw funds"
						>
							<RemixIcon
							name="ri-bank-card-line"
							size={13}
							color="#fff"
							/>
							<span>Withdraw</span>
						</button>
						)}

						{/* Close — chop-in active sessions only (organizer can close at will) */}
						{isActive && session.mode === 'chop-in' && (
						<>
							{confirmCloseId === session._id ? (
							<button
								onClick={() => confirmClose(session._id)}
								disabled={isClosing}
								className="
									flex items-center gap-1 px-2 h-8
									rounded-full
									bg-orange-50 text-orange-700
									text-[11px] font-semibold
									hover:bg-orange-100
									transition-colors
									disabled:opacity-40
									whitespace-nowrap
								"
								title="Confirm close session"
							>
								<RemixIcon name="ri-stop-circle-line" size={13} color="#c2410c" />
								Close it?
							</button>
							) : (
							<button
								onClick={() => requestClose(session._id)}
								disabled={isClosing}
								className="
									flex items-center gap-1 px-2 h-8
									rounded-full
									border border-orange-200
									text-orange-600
									text-[11px] font-semibold
									hover:bg-orange-50
									transition-colors
									disabled:opacity-40
									whitespace-nowrap
								"
								title="Close chop-in session"
							>
								<RemixIcon name="ri-stop-circle-line" size={13} color="#ea580c" />
								Close
							</button>
							)}
						</>
						)}

						{/* Edit + Delete */}
						{session.canEdit && (
						<>
							<button
							onClick={() => handleEdit(session)}
							className="
								w-8 h-8
								flex items-center justify-center
								rounded-full
								hover:bg-orange-50
								transition-colors
							"
							title="Edit"
							aria-label="Edit session"
							>
							<RemixIcon
								name="ri-pencil-line"
								size={16}
								color={BRAND}
							/>
							</button>

							{confirmDeleteId === session._id ? (
							<button
								onClick={() => confirmDelete(session._id)}
								disabled={isDeleting}
								className="
									flex items-center gap-1 px-2 h-8
									rounded-full
									bg-red-50 text-red-600
									text-[11px] font-semibold
									hover:bg-red-100
									transition-colors
									disabled:opacity-40
								"
								title="Confirm delete"
								aria-label="Confirm delete session"
							>
								<RemixIcon name="ri-delete-bin-5-fill" size={13} color="#DC2626" />
								Sure?
							</button>
							) : (
							<button
								onClick={() => requestDelete(session._id)}
								disabled={isDeleting}
								className="
									w-8 h-8
									flex items-center justify-center
									rounded-full
									hover:bg-red-50
									transition-colors
									disabled:opacity-40
								"
								title="Delete"
								aria-label="Delete session"
							>
								<RemixIcon
									name="ri-delete-bin-5-fill"
									size={16}
									color="#FB2C36"
								/>
							</button>
							)}
						</>
						)}

						{/* Paid out */}
						{isInactive && (
						<span
							className="
							text-[11px]
							text-neutral-400
							flex
							items-center
							gap-1
							ml-1
							whitespace-nowrap
							"
						>
							<RemixIcon
							name="ri-checkbox-circle-fill"
							size={13}
							color="#16a34a"
							/>
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

      {/* Join session modal */}
      <AnimatePresence>
        {joinOpen && (
          <JoinSessionModal onClose={() => setJoinOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
