import { useParams } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import Logo from '@/components/Logo'
import RemixIcon from '@/components/RemixIcon'
import { useState } from 'react'

const BRAND = '#FF6900'

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', '')
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-[540px] mx-auto mt-12 flex flex-col gap-4 animate-pulse">
      <div className="h-8 bg-neutral-100 rounded-full w-40" />
      <div className="h-72 bg-neutral-100 rounded-2xl" />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReceiptPage() {
  const { paymentRef } = useParams<{ paymentRef: string }>()
  const [copied, setCopied] = useState(false)

  const data = useQuery(
    api.participants.getByPaymentRef,
    paymentRef ? { paymentRef } : 'skip'
  )

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Skeleton />
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#fee2e2' }}>
            <RemixIcon name="ri-close-circle-line" size={24} color="#dc2626" />
          </div>
          <p className="text-[18px] font-bold text-neutral-800 mb-1">Receipt not found</p>
          <p className="text-[14px] text-neutral-400">
            This reference doesn't exist or has been removed.
          </p>
        </div>
      </div>
    )
  }

  const { participant, session, allParticipants } = data

  const paidCount  = allParticipants.filter(p => p.status === 'sent').length
  const totalCount = allParticipants.length
  const collected  = allParticipants.reduce(
    (s, p) => s + (p.status === 'sent' ? p.amountOwed : 0), 0
  )
  const goal       = session.goalAmount ?? session.totalAmount
  const isChopIn   = session.mode === 'chop-in'
  const pct        = isChopIn
    ? (goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0)
    : (totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0)

  // Line items — use participant.items for food, else single amount row
  const lineItems: { label: string; amount: number }[] =
    participant.items && participant.items.length > 0
      ? participant.items.map((it: { name: string; price: number }) => ({ label: it.name, amount: it.price }))
      : [{ label: session.name, amount: participant.amountOwed }]

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      {/* ── Print styles injected inline ───────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #chops-receipt, #chops-receipt * { visibility: visible !important; }
          #chops-receipt { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-[540px] mx-auto">

        {/* ── Top bar (hidden on print) ────────────────────────────────────── */}
        <div className="no-print flex items-center justify-between mb-6">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <RemixIcon name={copied ? 'ri-check-line' : 'ri-link'} size={14} color={copied ? '#16a34a' : undefined} />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <RemixIcon name="ri-printer-line" size={14} /> Save PDF
            </button>
        </div>

        {/* ── Receipt card ────────────────────────────────────────────────── */}
        <div
          id="chops-receipt"
          className="relative border border-neutral-200 rounded-2xl overflow-hidden"
        >
          {/* Watermark logo */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ opacity: 0.04 }}
          >
            <Logo width={240} height={240} />
          </div>

          <div className="relative z-10 p-8">

            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <Logo width={22} height={22} />
              <span className="text-[13px] font-bold" style={{ color: BRAND }}>Chops</span>
            </div>
            <p className="text-[11px] text-neutral-400 uppercase tracking-widest mb-5">
              Payment Receipt
            </p>

            {/* Success mark + title */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#dcfce7' }}
              >
                <RemixIcon name="ri-checkbox-circle-fill" size={20} color="#16a34a" />
              </div>
              <div>
                <h1 className="text-[18px] font-extrabold text-neutral-900 leading-tight">
                  {session.name}
                </h1>
                <p className="text-[12px] text-neutral-400">Payment confirmed</p>
              </div>
            </div>

            {/* Meta rows */}
            {[
              { label: 'Reference',  value: participant.paymentRef ?? paymentRef ?? '—' },
              { label: 'Paid by',    value: participant.name },
              { label: 'Date',       value: formatDate(participant._creationTime) },
              { label: 'Method',     value: 'Demo Transfer' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-[13px] py-2 border-b border-neutral-50">
                <span className="text-neutral-500">{row.label}</span>
                <span className="font-semibold text-neutral-900 text-right max-w-[60%] break-all">
                  {row.value}
                </span>
              </div>
            ))}

            {/* Line items */}
            <div className="border-t border-dashed border-neutral-200 my-4" />
            {lineItems.map((line, i) => (
              <div key={i} className="flex justify-between text-[13px] py-1.5">
                <span className="text-neutral-600 truncate pr-4">{line.label}</span>
                <span className="font-bold text-neutral-900 shrink-0">{formatNaira(line.amount)}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-neutral-200 my-4" />
            <div className="flex justify-between text-[15px] font-extrabold text-neutral-900">
              <span>Total paid</span>
              <span style={{ color: BRAND }}>{formatNaira(participant.amountOwed)}</span>
            </div>

            {/* Group progress */}
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <p className="text-[12px] font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
                Group progress
              </p>
              <div className="flex justify-between text-[13px] text-neutral-500 mb-2">
                <span>
                  {isChopIn
                    ? `${formatNaira(collected)} of ${formatNaira(goal)} collected`
                    : `${paidCount} of ${totalCount} paid`}
                </span>
                <span className="font-bold text-neutral-800">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: BRAND }}
                />
              </div>
            </div>

            {/* Footer stamp */}
            <p className="text-center text-[11px] text-neutral-300 mt-8">
              Powered by <span style={{ color: BRAND }}>Chops</span> · chops.app
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
