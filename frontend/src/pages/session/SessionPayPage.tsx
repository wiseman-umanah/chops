import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

// ── Mock session data (replace with real API fetch by slug) ───────────────────
const MOCK_SESSION = {
  title: 'Dinner party',
  organizer: 'Alex',
  total: 28200,
  participants: [
    { name: 'Alex',  amount: 5640, status: 'sent'    as const },
    { name: 'Tunde', amount: 5640, status: 'sent'    as const },
    { name: 'Amaka', amount: 5640, status: 'pending' as const },
    { name: 'Deji',  amount: 5640, status: 'pending' as const },
    { name: 'Bisi',  amount: 5640, status: 'pending' as const },
  ],
}

const PAYMENT_METHODS = [
  { id: 'debit',    label: 'Debit Card',  icon: 'ri-bank-card-line'   },
  { id: 'transfer', label: 'Bank Transfer', icon: 'ri-exchange-dollar-line' },
]

export default function SessionPayPage() {
  const { slug }    = useParams<{ slug: string }>()
  const navigate    = useNavigate()
  const session     = MOCK_SESSION

  const [viewingAs, setViewingAs]   = useState(session.participants[2].name) // default: Amaka
  const [dropOpen,  setDropOpen]    = useState(false)
  const [method,    setMethod]      = useState('debit')
  const [paying,    setPaying]      = useState(false)

  const me = session.participants.find(p => p.name === viewingAs) ?? session.participants[2]
  const alreadyPaid = me.status === 'sent'

  async function handlePay() {
    setPaying(true)
    // Simulate payment delay
    await new Promise(r => setTimeout(r, 900))
    navigate('/payment-success', {
      state: {
        slug,
        title:     session.title,
        organizer: session.organizer,
        paidBy:    viewingAs,
        amount:    me.amount,
        method:    PAYMENT_METHODS.find(m => m.id === method)?.label ?? 'Direct Transfer',
        participants: session.participants.map(p =>
          p.name === viewingAs ? { ...p, status: 'sent' } : p
        ),
      },
    })
  }

  return (
    <div className="max-w-[640px] mx-auto">

      {/* Viewing as */}
      <div className="mb-5">
        <p className="text-[13px] text-neutral-500 mb-1.5">Viewing as</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropOpen(v => !v)}
            className="w-full flex items-center justify-between border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] bg-white text-neutral-800 hover:border-neutral-300 transition-colors"
          >
            {viewingAs}
            <RemixIcon name="ri-arrow-down-s-line" size={16} color="#9ca3af"
              style={{ transform: dropOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
          </button>
          {dropOpen && (
            <div className="absolute z-40 mt-1 w-full bg-white border border-neutral-100 rounded-2xl shadow-lg overflow-hidden py-1">
              {session.participants.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => { setViewingAs(p.name); setDropOpen(false) }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-neutral-50 transition-colors"
                  style={{ color: p.name === viewingAs ? BRAND : '#374151', fontWeight: p.name === viewingAs ? 600 : 400 }}
                >
                  {p.name}
                  {p.name === viewingAs && <RemixIcon name="ri-check-line" size={14} color={BRAND} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session card */}
      <div className="border border-neutral-200 rounded-2xl p-6">
        {/* Header */}
        <p className="text-[13px] text-neutral-500 mb-1">{session.organizer} is collecting for</p>
        <h1 className="text-[26px] font-extrabold text-neutral-900 mb-0.5">{session.title}</h1>
        <p className="text-[13px] text-neutral-400 mb-5">
          Total {formatNaira(session.total)} · {session.participants.length} people
        </p>

        {/* Participant rows */}
        <div className="flex flex-col gap-2 mb-4">
          {session.participants.map(p => {
            const isMe = p.name === viewingAs
            const paid = p.name === viewingAs
              ? alreadyPaid
              : p.status === 'sent'
            return (
              <div
                key={p.name}
                className="flex items-center justify-between px-4 py-3.5 rounded-full border transition-colors"
                style={{
                  borderColor: isMe ? BRAND : '#e5e7eb',
                  borderWidth: isMe ? 1.5 : 1,
                }}
              >
                <div>
                  <p className="text-[14px] text-neutral-900">
                    {p.name}{isMe ? ' (you)' : ''}
                  </p>
                  <p className="text-[12px] text-neutral-400">{formatNaira(p.amount)}</p>
                </div>
                {paid ? (
                  <span className="flex items-center gap-1 text-[12px]  px-3 py-1 rounded-full"
                    style={{ background: '#dcfce7', color: '#166534' }}>
                    <RemixIcon name="ri-checkbox-circle-fill" size={13} color="#16a34a" /> Paid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[12px] px-3 py-1 rounded-full"
                    style={{ background: '#fee2e2', color: '#991b1b' }}>
                    <RemixIcon name="ri-close-circle-fill" size={13} color="#dc2626" /> Unpaid
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Your share card */}
        <div className="rounded-2xl px-6 py-5 text-white text-center mb-5"
          style={{ background: '#7c1c04' }}>
          <p className="text-[13px] opacity-80 mb-1">Your Share</p>
          <p className="text-[32px] font-bold">{formatNaira(me.amount)}</p>
        </div>

        {/* Payment method */}
        {!alreadyPaid && (
          <>
            <p className="text-[13px] text-neutral-600 mb-3">Payment method</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all"
                  style={{
                    borderColor: method === m.id ? BRAND : '#e5e7eb',
                    background: method === m.id ? '#fff8f3' : '#fff',
                  }}
                >
                  <RemixIcon name={m.icon} size={22} color={method === m.id ? BRAND : '#6b7280'} />
                  <span className="text-[13px] font-medium"
                    style={{ color: method === m.id ? BRAND : '#374151' }}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full py-4 rounded-full text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: BRAND }}
            >
              {paying ? 'Processing…' : `Pay ${formatNaira(me.amount)}`}
            </button>
          </>
        )}

        {alreadyPaid && (
          <div className="flex items-center justify-center gap-2 py-4 rounded-full text-[14px] font-bold"
            style={{ background: '#dcfce7', color: '#166534' }}>
            <RemixIcon name="ri-checkbox-circle-fill" size={18} color="#16a34a" />
            You've already paid
          </div>
        )}
      </div>
    </div>
  )
}
