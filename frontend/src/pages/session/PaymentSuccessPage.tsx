import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { motion } from 'framer-motion'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import RemixIcon from '@/components/RemixIcon'
import { Seo } from '@/hooks/useSeo'

const BRAND = '#FF6900'

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

function now() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', '')
}

function Skeleton() {
  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-6 animate-pulse">
      <div className="h-14 bg-neutral-100 rounded-2xl max-w-[70%] mx-auto" />
      <div className="flex gap-5">
        <div className="flex-1 h-80 bg-neutral-100 rounded-2xl" />
        <div className="flex-1 h-80 bg-neutral-100 rounded-2xl" />
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const [copied, setCopied]   = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bachs appends ?checkout_id= to the success_url we gave it.
  // We also embedded ?participantId= in the success_url at checkout initiation.
  // For chop-in, the ID was stored in sessionStorage (resolved server-side in the action).
  const urlParticipantId = searchParams.get('participantId')
  const [participantId, setParticipantId] = useState<string | null>(
    urlParticipantId && urlParticipantId !== '__PLACEHOLDER__' ? urlParticipantId : null
  )

  // On mount: check sessionStorage for chop-in participant ID
  useEffect(() => {
    if (!participantId) {
      const stored = sessionStorage.getItem('chops_pending_participant')
      if (stored) {
        setParticipantId(stored)
        sessionStorage.removeItem('chops_pending_participant')
      }
    }
  }, [participantId])

  // Start a 90-second timeout once we have a participantId.
  // If the webhook hasn't arrived by then, show a reassuring fallback.
  useEffect(() => {
    if (!participantId) return
    timeoutRef.current = setTimeout(() => setTimedOut(true), 90_000)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [participantId])

  // Poll status-only until the webhook marks the participant as paid.
  // getParticipantStatus returns { status, paymentRef } — no PII.
  const participantStatus = useQuery(
    api.participants.getParticipantStatus,
    participantId ? { participantId: participantId as Id<'participants'> } : 'skip'
  )

  // Once paid, fetch full receipt data via the paymentRef
  const receiptData = useQuery(
    api.participants.getByPaymentRef,
    participantStatus?.paymentRef ? { paymentRef: participantStatus.paymentRef } : 'skip'
  )

  // ── Loading state: waiting for participantId ──────────────────────────────
  if (!participantId) {
    return (
      <div className="max-w-[900px] mx-auto text-center py-24">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: '#fee2e2' }}>
          <RemixIcon name="ri-close-circle-line" size={24} color="#dc2626" />
        </div>
        <p className="text-[18px] font-bold text-neutral-800 mb-1">Something went wrong</p>
        <p className="text-[13px] text-neutral-400 mb-6">
          We couldn't identify your payment session. Please check your notifications or contact support.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 rounded-full text-[14px] font-bold text-white"
          style={{ background: BRAND }}
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  // ── Waiting for webhook to mark participant as paid ───────────────────────
  if (participantStatus === undefined || (participantStatus && participantStatus.status === 'pending')) {
    // 90-second timeout fallback — webhook may have been delayed or dropped
    if (timedOut) {
      return (
        <div className="max-w-[600px] mx-auto text-center py-24">
          <div className="text-5xl mb-5">⏳</div>
          <p className="text-[18px] font-bold text-neutral-800 mb-2">Still confirming…</p>
          <p className="text-[14px] text-neutral-500 mb-2 max-w-[420px] mx-auto leading-relaxed">
            This is taking longer than usual. Your payment may have already gone through —
            check your email or notifications for confirmation.
          </p>
          <p className="text-[13px] text-neutral-400 mb-8 max-w-[400px] mx-auto">
            If money left your account, you will <strong className="text-neutral-600">not</strong> be charged twice.
            We'll send you a confirmation once it's processed.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: BRAND }}
          >
            Go to Dashboard
          </button>
        </div>
      )
    }

    return (
      <div className="max-w-[900px] mx-auto text-center py-24">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin"
          style={{ border: '3px solid #f3f4f6', borderTopColor: BRAND, borderRadius: '50%' }}>
        </div>
        <p className="text-[18px] font-bold text-neutral-800 mb-1">Confirming your payment…</p>
        <p className="text-[13px] text-neutral-400">
          Waiting for payment confirmation. This usually takes a few seconds.
        </p>
      </div>
    )
  }

  if (participantStatus === null) return <Skeleton />
  if (receiptData === undefined || receiptData === null) return <Skeleton />

  // ── Data resolved — use full participant data from receiptData ─────────────
  const fullParticipant = receiptData.participant
  const session      = receiptData.session
  const allParticipants = receiptData.allParticipants ?? []

  const title      = session?.name ?? 'Payment'
  const mode       = session?.mode ?? 'food'
  const amount     = fullParticipant.amountOwed
  const paymentRef = fullParticipant.paymentRef
  const timestamp  = now()

  const paidCount  = allParticipants.filter((p: { status: string }) => p.status === 'sent').length
  const totalCount = allParticipants.length
  const goalAmount = session?.goalAmount ?? session?.totalAmount ?? 0
  const collected  = allParticipants.reduce((s: number, p: { status: string; amountOwed: number }) => s + (p.status === 'sent' ? p.amountOwed : 0), 0)
  const pct        = mode === 'chop-in'
    ? (goalAmount > 0 ? Math.min(100, Math.round((collected / goalAmount) * 100)) : 0)
    : (totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0)

  const lineItems = fullParticipant.items && fullParticipant.items.length > 0
    ? fullParticipant.items.map((it: { name: string; price: number }) => ({ label: it.name, amount: it.price }))
    : [{ label: title, amount }]

  function copyReceiptLink() {
    if (!paymentRef) return
    navigator.clipboard.writeText(`${window.location.origin}/r/${paymentRef}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <Seo title="Payment successful" path="/payment-success" noIndex />

      {/* ── Success banner ─────────────────────────────────────────────── */}
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

      {/* ── Two-column layout ──────────────────────────────────────────── */}
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

          {[
            { label: 'Reference', value: paymentRef ?? '—' },
            { label: 'Paid by',   value: fullParticipant.name },
            { label: 'Method',    value: 'Bank Transfer' },
            { label: 'Date',      value: timestamp },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-[13px] py-2">
              <span className="text-neutral-500">{row.label}</span>
              <span className="font-bold text-neutral-900 break-all text-right max-w-[60%]">
                {row.value}
              </span>
            </div>
          ))}

          <div className="border-t border-dashed border-neutral-200 my-4" />
          {lineItems.map((line, i) => (
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
          <div>
            <h3 className="text-[15px] font-bold text-neutral-900 mb-0.5">Group progress</h3>
            <p className="text-[13px] text-neutral-400 mb-3">
              {mode === 'chop-in'
                ? `${formatNaira(collected)} of ${formatNaira(goalAmount)} collected · ${pct}%`
                : `${paidCount} of ${totalCount} paid · ${pct}% complete`
              }
            </p>

            <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden mb-5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ background: BRAND }}
              />
            </div>

            {allParticipants.length > 0 && (
              <div className="flex flex-col gap-2">
                {allParticipants.map((p, i) => (
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

            {mode === 'chop-in' && goalAmount > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-between text-[13px]">
                <span className="text-neutral-500">Remaining</span>
                <span className="font-bold text-neutral-900">
                  {formatNaira(Math.max(0, goalAmount - collected))}
                </span>
              </div>
            )}
          </div>

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
