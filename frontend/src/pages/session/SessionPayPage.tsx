import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import RemixIcon from '@/components/RemixIcon'
import { Seo } from '@/hooks/useSeo'

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND = '#FF6900'

const MODE_COLOR: Record<string, string> = {
  food:     '#FF6900',
  'chop-in': '#00C950',
  bill:     '#FB2C36',
}

// Minimum contribution for chop-in (₦100 = 10,000 kobo)
const MIN_CONTRIBUTION_KOBO = 10_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

// ── Participant dropdown ──────────────────────────────────────────────────────

function ParticipantDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] bg-white text-neutral-800 hover:border-neutral-300 transition-colors"
      >
        <span>{value}</span>
        <RemixIcon
          name="ri-arrow-down-s-line"
          size={16}
          color="#9ca3af"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-neutral-100 rounded-2xl shadow-lg overflow-hidden py-1">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-neutral-50 transition-colors"
              style={{ color: opt === value ? BRAND : '#374151', fontWeight: opt === value ? 600 : 400 }}
            >
              {opt}
              {opt === value && <RemixIcon name="ri-check-line" size={14} color={BRAND} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-4 animate-pulse">
      <div className="h-12 bg-neutral-100 rounded-full" />
      <div className="h-64 bg-neutral-100 rounded-2xl" />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SessionPayPage() {
  const { slug } = useParams<{ slug: string }>()

  // Live Convex query — re-runs automatically when participant statuses change
  const session = useQuery(
    api.sessions.getSessionBySlug,
    slug ? { slug } : 'skip'
  )

  const [viewingAs,    setViewingAs]   = useState<string | null>(null)
  const [paying,       setPaying]      = useState(false)
  const [payError,     setPayError]    = useState<string | null>(null)
  const [payerEmail,   setPayerEmail]  = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  // chop-in only: contributor name + amount in naira
  const [contribution, setContribution] = useState('')
  const [chopInName,   setChopInName]  = useState('')

  const initiateCheckout = useAction(api.payments.initiateCheckout)
  const navigate  = useNavigate()


  // ── Loading / not found states ────────────────────────────────────────────

  if (session === undefined) return <Skeleton />

  if (session === null) {
    return (
      <div className="max-w-[640px] mx-auto text-center py-20">
        <p className="text-[18px] font-bold text-neutral-700 mb-2">Session not found</p>
        <p className="text-[14px] text-neutral-400">This link may have expired or doesn't exist.</p>
      </div>
    )
  }

  const { mode, name, participants, totalAmount, goalAmount } = session
  const accentColor = MODE_COLOR[mode] ?? BRAND

  // For chop-in, participants are added dynamically. Show a contribution form.
  // For food/bill, participants are predefined — show a "who are you?" picker.
  const isChopIn = mode === 'chop-in'

  // The participant the user is viewing as (food/bill only)
  const currentParticipant = !isChopIn
    ? participants.find(p => p.name === (viewingAs ?? participants[0]?.name))
    : null

  const viewingName  = viewingAs ?? participants[0]?.name ?? ''
  const alreadyPaid  = currentParticipant?.status === 'sent'

  // chop-in contribution in kobo
  const contributionKobo = Math.round((parseInt(contribution.replace(/\D/g, ''), 10) || 0) * 100)

  // Only confirmed (paid) contributors — pending rows are pre-reservations and must be hidden
  const paidParticipants = participants.filter(p => p.status === 'sent')
  const paidCount = paidParticipants.length

  // Progress for chop-in
  const collected   = paidParticipants.reduce((s, p) => s + p.amountOwed, 0)
  const goal        = goalAmount ?? totalAmount
  const progressPct = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0

  // For the final gap: if remaining < global min, lower the effective min to
  // the remaining amount so it can still be filled exactly.
  const remaining = Math.max(0, goal - collected)
  const effectiveMin = isChopIn && remaining > 0 && remaining < MIN_CONTRIBUTION_KOBO
    ? remaining
    : MIN_CONTRIBUTION_KOBO

  const sessionId = session._id

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail.trim())

  async function handlePay() {
    if (isChopIn && contributionKobo < effectiveMin) return
    if (!isChopIn && !currentParticipant) return
    if (!emailValid) { setEmailTouched(true); return }

    setPayError(null)
    setPaying(true)

    const displayName = isChopIn ? (chopInName.trim() || 'Anonymous') : viewingName

    const origin = import.meta.env.VITE_PUBLIC_URL || window.location.origin
    const cancelUrl = `${origin}/s/${slug}`

    try {
      const { checkoutUrl, participantId: resolvedId } = await initiateCheckout({
        sessionId,
        participantId:   isChopIn ? undefined : currentParticipant!._id,
        contributorName: isChopIn ? displayName : undefined,
        amountKobo:      isChopIn ? contributionKobo : undefined,
        // For chop-in: the action pre-inserts the participant row and returns its ID.
        // The ID isn't known until the action completes, so the action itself builds
        // the final successUrl server-side using the resolved participantId.
        // For food/bill: the ID is known up-front so we embed it directly here.
        successUrl: `${origin}/payment-success?participantId=${
          isChopIn ? '__RESOLVED_BY_ACTION__' : currentParticipant!._id
        }`,
        cancelUrl,
        payerName:  displayName,
        payerEmail: payerEmail.trim() || undefined,
      })

      // sessionStorage: same-device fallback so PaymentSuccessPage can find the
      // participant ID even if Bachs strips or truncates the success URL query params.
      sessionStorage.setItem('chops_pending_participant', resolvedId)

      // Redirect to Bachs-hosted checkout page
      window.location.href = checkoutUrl
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Payment failed. Please try again.')
      setPaying(false)
    }
  }

  const modeLabel = mode === 'chop-in' ? 'Chop In' : mode === 'food' ? 'Chop Food' : 'Chop Bill'
  const seoDesc   = `${modeLabel} · Pay your share for "${name}" on Chop — no app download needed.`

  return (
    <div className="max-w-[640px] mx-auto">
      <Seo
        title={`Pay your share — ${name}`}
        description={seoDesc}
        path={`/s/${slug}`}
      />
		{/* ── Back navigation ──────────────────────────────────────────────────── */}
		<button
		onClick={() => navigate(-1)}
		className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors mb-6"
		>
		<RemixIcon name="ri-arrow-left-line" size={16} />
		Back
		</button>

      {/* ── Mode header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: accentColor }}
        >
          <RemixIcon
            name={mode === 'food' ? 'ri-restaurant-2-fill' : mode === 'chop-in' ? 'ri-hand-coin-fill' : 'ri-coupon-5-line'}
            size={14}
            color="#fff"
          />
        </div>
        <span className="text-[13px] font-semibold text-neutral-500 capitalize">
          {mode === 'chop-in' ? 'Chop In' : mode === 'food' ? 'Chop Food' : 'Chop Bill'}
        </span>
        <span className="text-[12px] text-neutral-300 font-mono ml-auto">{slug}</span>
      </div>

      {/* ── Who are you? (food / bill only) ─────────────────────────────────── */}
      {!isChopIn && participants.length > 0 && (
        <div className="mb-5">
          <p className="text-[13px] text-neutral-500 mb-1.5">Who are you?</p>
          <ParticipantDropdown
            value={viewingName}
            options={participants.map(p => p.name)}
            onChange={setViewingAs}
          />
        </div>
      )}

      {/* ── Session card ─────────────────────────────────────────────────────── */}
      <div className="border border-neutral-200 rounded-2xl p-6">

        {/* Header */}
        <h1 className="text-[24px] font-extrabold text-neutral-900 mb-0.5">{name}</h1>
        <p className="text-[13px] text-neutral-400 mb-5">
          {isChopIn
            ? `Goal: ${formatNaira(goal)} · ${paidCount} contributor${paidCount !== 1 ? 's' : ''} so far`
            : `${formatNaira(totalAmount)} total · ${participants.length} participant${participants.length !== 1 ? 's' : ''}`
          }
        </p>

        {/* ── CHOP IN ── progress + contribution form ───────────────────────── */}
        {isChopIn && (
          <>
            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-[12px] text-neutral-500 mb-1.5">
                <span>{formatNaira(collected)} collected</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%`, background: accentColor }}
                />
              </div>
              <p className="text-[12px] text-neutral-400 mt-1.5 text-right">{formatNaira(goal)} goal</p>
            </div>

            {/* Contributor list — only confirmed (paid) contributors */}
            {paidParticipants.length > 0 && (
              <div className="flex flex-col gap-2 mb-5">
                {paidParticipants.map(p => (
                  <div key={p._id} className="flex items-center justify-between px-4 py-3 rounded-full border border-neutral-100 bg-neutral-50">
                    <span className="text-[13px] font-medium text-neutral-800">{p.name}</span>
                    <span className="text-[13px] font-semibold" style={{ color: accentColor }}>
                      {formatNaira(p.amountOwed)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Contribution form */}
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <p className="text-[13px] font-semibold text-neutral-700 mb-1.5">Your name</p>
                <input
                  type="text"
                  placeholder="e.g. Tunde"
                  value={chopInName}
                  onChange={e => setChopInName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#00C950] transition-colors bg-white"
                />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-neutral-700 mb-1.5">Your contribution (₦)</p>
                <div className="flex items-center border border-neutral-200 rounded-full px-4 py-2.5 gap-2 bg-white focus-within:border-[#00C950]">
                  <span className="text-[13px] text-neutral-400 shrink-0">₦</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder="Enter amount"
                    value={contribution}
                    onChange={e => setContribution(e.target.value)}
                    className="flex-1 text-[14px] text-neutral-800 outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Your share card */}
            {contributionKobo > 0 && (
              <div
                className="rounded-2xl px-6 py-5 text-white text-center mb-5"
                style={{ background: accentColor }}
              >
                <p className="text-[13px] opacity-80 mb-1">Your Contribution</p>
                <p className="text-[32px] font-bold">{formatNaira(contributionKobo)}</p>
              </div>
            )}
          </>
        )}

        {/* ── FOOD / BILL ── participant rows + your share ──────────────────── */}
        {!isChopIn && (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {participants.map(p => {
                const isMe   = p.name === viewingName
                const isPaid = p.status === 'sent'
                return (
                  <div
                    key={p._id}
                    className="flex items-center justify-between px-4 py-3.5 rounded-full border transition-colors"
                    style={{
                      borderColor: isMe ? accentColor : '#e5e7eb',
                      borderWidth:  isMe ? 1.5 : 1,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] text-neutral-900 truncate">
                        {p.name}{isMe ? ' (you)' : ''}
                      </p>
                      {/* Food mode: show items list */}
                      {mode === 'food' && isMe && p.items && p.items.length > 0 && (
                        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                          {p.items.map(it => it.name).join(', ')}
                        </p>
                      )}
                      <p className="text-[12px] text-neutral-400">{formatNaira(p.amountOwed)}</p>
                    </div>
                    {isPaid ? (
                      <span className="flex items-center gap-1 text-[12px] px-3 py-1 rounded-full shrink-0"
                        style={{ background: '#dcfce7', color: '#166534' }}>
                        <RemixIcon name="ri-checkbox-circle-fill" size={13} color="#16a34a" /> Paid
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[12px] px-3 py-1 rounded-full shrink-0"
                        style={{ background: '#fee2e2', color: '#991b1b' }}>
                        <RemixIcon name="ri-close-circle-fill" size={13} color="#dc2626" /> Unpaid
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Your share card */}
            {currentParticipant && (
              <div
                className="rounded-2xl px-6 py-5 text-white text-center mb-5"
                style={{ background: accentColor }}
              >
                <p className="text-[13px] opacity-80 mb-1">Your Share</p>
                <p className="text-[32px] font-bold">{formatNaira(currentParticipant.amountOwed)}</p>
                {currentParticipant.sharePercent !== undefined && (
                  <p className="text-[12px] opacity-70 mt-0.5">{currentParticipant.sharePercent}% of total</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Payment method + CTA ─────────────────────────────────────────── */}
        {(isChopIn ? contributionKobo > 0 : !alreadyPaid) && (
          <>
            {/* Email — required by Bachs to identify the payer */}
            <div className="mb-5">
              <p className="text-[13px] font-semibold text-neutral-700 mb-1.5">Your email</p>
              <input
                type="email"
                placeholder="you@example.com"
                value={payerEmail}
                onChange={e => { setPayerEmail(e.target.value); setEmailTouched(false) }}
                className="w-full border rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none transition-colors bg-white"
                style={{
                  borderColor: emailTouched && !emailValid ? '#dc2626' : undefined,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = emailTouched && !emailValid ? '#dc2626' : accentColor }}
                onBlur={e => {
                  setEmailTouched(true)
                  e.currentTarget.style.borderColor = payerEmail.trim() && !emailValid ? '#dc2626' : ''
                }}
              />
              {emailTouched && !emailValid && payerEmail.trim() && (
                <p className="text-[12px] text-red-600 mt-1.5 px-1">Please enter a valid email address</p>
              )}
            </div>

            {/* Payment info */}
            <div className="flex items-center gap-2 mb-5 px-1">
              <RemixIcon name="ri-secure-payment-line" size={15} color="#9ca3af" />
              <p className="text-[12px] text-neutral-400">Payments are processed securely via Bachs</p>
            </div>

            {/* Minimum contribution error (chop-in only) */}
            {isChopIn && contributionKobo > 0 && contributionKobo < effectiveMin && (
              <div className="mb-3 px-4 py-2.5 rounded-2xl text-[13px] font-medium"
                style={{ background: '#fff7ed', color: '#9a3412' }}>
                Minimum contribution is {formatNaira(effectiveMin)}
              </div>
            )}

            {payError && (
              <div className="mb-3 px-4 py-2.5 rounded-2xl text-[13px] font-medium"
                style={{ background: '#fff1f2', color: '#be123c' }}>
                {payError}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={paying || !emailValid || (isChopIn && contributionKobo < effectiveMin)}
              className="w-full py-4 rounded-full text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: accentColor }}
            >
              {paying
                ? 'Processing…'
                : `Pay ${formatNaira(isChopIn ? contributionKobo : (currentParticipant?.amountOwed ?? 0))}`}
            </button>
          </>
        )}

        {/* Already paid banner (food/bill) */}
        {!isChopIn && alreadyPaid && (
          <div
            className="flex items-center justify-center gap-2 py-4 rounded-full text-[14px] font-bold"
            style={{ background: '#dcfce7', color: '#166534' }}
          >
            <RemixIcon name="ri-checkbox-circle-fill" size={18} color="#16a34a" />
            You've already paid
          </div>
        )}

        {/* Closed session notice */}
        {session.status === 'closed' && (
          <p className="text-center text-[13px] text-neutral-400 mt-4">
            This session has been closed by the organizer.
          </p>
        )}
      </div>
    </div>
  )
}
