import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

interface Participant { name: string; amount: number; status: 'sent' | 'pending' }

interface SuccessState {
  slug: string
  title: string
  organizer: string
  paidBy: string
  amount: number
  method: string
  participants: Participant[]
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

// ── Mock receipt line items (would come from real session data) ───────────────
const MOCK_LINES = [
  { label: 'Jollof rice ×2 (shared)',    amount: 1400 },
  { label: 'Suya platter ×1 (shared)',   amount: 1600 },
  { label: 'Chapman jug ×2 (shared)',    amount: 1800 },
  { label: 'Tax & tip',                   amount:  840 },
]

function now() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', '')
}

function ref() {
  return 'CHP-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function PaymentSuccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state    = location.state as SuccessState | null

  const title        = state?.title        ?? 'Dinner party'
  const paidBy       = state?.paidBy       ?? 'Amaka'
  const amount       = state?.amount       ?? 5640
  const method       = state?.method       ?? 'Direct Transfer'
  const participants = state?.participants ?? [
    { name: 'Alex',        amount: 5640, status: 'sent'    as const },
    { name: 'Tunde',       amount: 5640, status: 'sent'    as const },
    { name: 'Amaka (you)', amount: 5640, status: 'sent'    as const },
    { name: 'Deji',        amount: 5640, status: 'sent'    as const },
    { name: 'Bisi',        amount: 5640, status: 'pending' as const },
  ]

  const paidCount  = participants.filter(p => p.status === 'sent').length
  const totalCount = participants.length
  const pct        = Math.round((paidCount / totalCount) * 100)
  const reference  = ref()
  const timestamp  = now()

  // Mock audit trail
  const AUDIT = [
    { time: timestamp.split(' ')[1], label: `${paidBy} paid ${formatNaira(amount)}`,             highlight: true  },
    { time: timestamp.split(' ')[1], label: `${paidBy} started a payment of ${formatNaira(amount)}`, highlight: true  },
    { time: '11:48',                  label: 'Tunde paid',                                        highlight: false },
    { time: '09:05',                  label: 'Alex paid',                                         highlight: false },
    { time: '09:02',                  label: 'Alex created the session',                          highlight: false },
  ]

  return (
    <div className="max-w-[900px] mx-auto">
      {/* ── Success banner ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-w-[70%] mx-auto items-center gap-4 rounded-2xl px-6 py-4 mb-8 border"
        style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: '#16a34a' }}>
          <RemixIcon name="ri-check-line" size={18} color="#fff" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-neutral-900">Payment successful</p>
          <p className="text-[13px] text-neutral-500">{formatNaira(amount)} sent to {state?.organizer ?? 'Alex'}. You're all set.</p>
        </div>
      </motion.div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* Left: Receipt */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
          className="w-full lg:w-[48%] border border-neutral-200 rounded-2xl p-7"
        >
          <p className="text-[12px] text-neutral-400 mb-1 uppercase tracking-wide">Receipt</p>
          <h2 className="text-[20px] font-bold text-neutral-900 mb-6">{title}</h2>

          {/* Meta rows */}
          {[
            { label: 'Reference', value: reference },
            { label: 'Paid by',   value: paidBy    },
            { label: 'Method',    value: method    },
            { label: 'Date',      value: timestamp },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-[13px] py-2">
              <span className="text-neutral-500">{row.label}</span>
              <span className="font-bold text-neutral-900">{row.value}</span>
            </div>
          ))}

          {/* Line items */}
          <div className="border-t border-dashed border-neutral-200 my-4" />
          {MOCK_LINES.map(line => (
            <div key={line.label} className="flex justify-between text-[13px] py-1.5">
              <span className="text-neutral-600">{line.label}</span>
              <span className="font-bold text-neutral-900">{formatNaira(line.amount)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-neutral-200 my-4" />
          <div className="flex justify-between text-[15px] font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatNaira(amount)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border border-neutral-200 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors">
              <RemixIcon name="ri-download-fill" size={15} /> Save Receipt
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border border-neutral-200 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors">
              <RemixIcon name="ri-share-line" size={15} /> Share
            </button>
          </div>
        </motion.div>

        {/* Right: Group progress + Audit trail */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
          className="w-full lg:w-[52%] border border-neutral-200 rounded-2xl p-7 flex flex-col gap-6"
        >
          {/* Group progress */}
          <div>
            <h3 className="text-[15px] font-bold text-neutral-900 mb-0.5">Group progress</h3>
            <p className="text-[13px] text-neutral-400 mb-3">
              {paidCount} of {totalCount} paid · {pct}% complete
            </p>
            {/* Progress bar */}
            <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden mb-5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ background: BRAND }}
              />
            </div>
            {/* Participant status */}
            <div className="flex flex-col gap-2">
              {participants.map(p => (
                <div key={p.name} className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-neutral-800">{p.name}</span>
                  {p.status === 'sent' ? (
                    <span className="flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full"
                      style={{ background: '#dcfce7', color: '#166534' }}>
                      <RemixIcon name="ri-checkbox-circle-fill" size={12} color="#16a34a" /> Paid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full"
                      style={{ background: '#fee2e2', color: '#991b1b' }}>
                      <RemixIcon name="ri-close-circle-fill" size={12} color="#dc2626" /> Unpaid
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live audit trail */}
          <div>
            <h3 className="text-[15px] font-bold text-neutral-900 mb-3">Live audit trail</h3>
            <div className="flex flex-col gap-2.5 pl-1">
              {AUDIT.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 text-[13px]">
                  <span className="shrink-0 text-[11px] text-neutral-400 w-10 mt-0.5">{entry.time}</span>
                  <span style={{ color: entry.highlight ? BRAND : '#9ca3af' }}>{entry.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Back to Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 mt-auto"
            style={{ background: BRAND }}
          >
            Back to Dashboard
          </button>
        </motion.div>

      </div>
    </div>
  )
}
