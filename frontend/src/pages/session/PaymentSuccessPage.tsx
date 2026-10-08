import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

interface ParticipantState {
  name: string
  amountOwed: number
  status: 'sent' | 'pending'
  items?: { name: string; price: number }[]
}

interface SuccessState {
  slug: string
  title: string
  mode: string
  paidBy: string
  amount: number
  method: string
  paymentRef?: string
  participants: ParticipantState[]
  totalAmount: number
  goalAmount: number
  items: { name: string; price: number }[]
}

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

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
  const [copied, setCopied] = useState(false)

  const title        = state?.title        ?? 'Session'
  const paidBy       = state?.paidBy       ?? 'You'
  const amount       = state?.amount       ?? 0
  const method       = state?.method       ?? 'Direct Transfer'
  const mode         = state?.mode         ?? 'food'
  const participants = state?.participants ?? []
  const items        = state?.items        ?? []
  const goalAmount   = state?.goalAmount   ?? 0
  const paymentRef   = state?.paymentRef

  function copyReceiptLink() {
    if (!paymentRef) return
    const url = `${window.location.origin}/r/${paymentRef}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const paidCount    = participants.filter(p => p.status === 'sent').length
  const totalCount   = participants.length

  // Progress — food/bill: paidCount ratio; chop-in: collected vs goal
  const collected    = participants.reduce((s, p) => s + (p.status === 'sent' ? p.amountOwed : 0), 0)
  const pct          = mode === 'chop-in'
    ? (goalAmount > 0 ? Math.min(100, Math.round((collected / goalAmount) * 100)) : 0)
    : (totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0)

  const reference  = ref()
  const timestamp  = now()

  // Line items for the receipt — use real food items when available, else show the total
  const receiptLines = items.length > 0
    ? items.map(it => ({ label: it.name, amount: it.price }))
    : [{ label: title, amount }]

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
          <p className="text-[13px] text-neutral-500">{formatNaira(amount)} sent. You're all set.</p>
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
          {receiptLines.map((line, i) => (
            <div key={i} className="flex justify-between text-[13px] py-1.5">
              <span className="text-neutral-600 truncate pr-4">{line.label}</span>
              <span className="font-bold text-neutral-900 shrink-0">{formatNaira(line.amount)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-neutral-200 my-4" />
          <div className="flex justify-between text-[15px] font-bold text-neutral-900">
            <span>Total paid</span>
            <span>{formatNaira(amount)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => paymentRef && window.open(`/r/${paymentRef}`, '_blank')}
              disabled={!paymentRef}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border border-neutral-200 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RemixIcon name="ri-download-fill" size={15} /> Save Receipt
            </button>
            <button
              onClick={copyReceiptLink}
              disabled={!paymentRef}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border border-neutral-200 text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: copied ? '#16a34a' : '#374151' }}
            >
              <RemixIcon name={copied ? 'ri-check-line' : 'ri-link'} size={15} color={copied ? '#16a34a' : undefined} />
              {copied ? 'Copied!' : 'Share Link'}
            </button>
          </div>
        </motion.div>

        {/* Right: Group progress */}
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
              {mode === 'chop-in'
                ? `${formatNaira(collected)} of ${formatNaira(goalAmount)} collected · ${pct}%`
                : `${paidCount} of ${totalCount} paid · ${pct}% complete`
              }
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

            {/* Participant status list */}
            {participants.length > 0 && (
              <div className="flex flex-col gap-2">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <div className="min-w-0">
                      <span className="font-medium text-neutral-800 truncate block">{p.name}</span>
                      {mode !== 'chop-in' && (
                        <span className="text-[11px] text-neutral-400">{formatNaira(p.amountOwed)}</span>
                      )}
                    </div>
                    {p.status === 'sent' ? (
                      <span className="flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full shrink-0"
                        style={{ background: '#dcfce7', color: '#166534' }}>
                        <RemixIcon name="ri-checkbox-circle-fill" size={12} color="#16a34a" /> Paid
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[12px] px-2.5 py-0.5 rounded-full shrink-0"
                        style={{ background: '#fee2e2', color: '#991b1b' }}>
                        <RemixIcon name="ri-close-circle-fill" size={12} color="#dc2626" /> Unpaid
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Chop-in: show total remaining */}
            {mode === 'chop-in' && goalAmount > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-between text-[13px]">
                <span className="text-neutral-500">Remaining</span>
                <span className="font-bold text-neutral-900">
                  {formatNaira(Math.max(0, goalAmount - collected))}
                </span>
              </div>
            )}
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
