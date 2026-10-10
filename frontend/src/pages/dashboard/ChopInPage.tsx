import RemixIcon from '@/components/RemixIcon'
import { Seo } from '@/hooks/useSeo'
import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

const BRAND = '#00C950'

interface EditSession {
  _id: Id<'sessions'>
  name: string
  goalAmount?: number
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

const inputCls =
  'w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#00C950] transition-colors bg-white'

const inputErrCls =
  'w-full border border-red-400 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#00C950] transition-colors bg-white'

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-[12px] text-red-500 mt-1.5 px-1">{msg}</p>
}

export default function ChopInPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const editSession = (location.state as { editSession?: EditSession } | null)?.editSession ?? null
  const isEditMode  = editSession !== null

  const createSession = useMutation(api.sessions.createSession)
  const editMutation  = useMutation(api.sessions.editSession)

  const [title, setTitle]           = useState(isEditMode ? editSession.name : '')
  const [goalAmount, setGoalAmount] = useState(
    isEditMode && editSession.goalAmount ? String(Math.round(editSession.goalAmount / 100)) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Refs for scroll-to-error
  const titleRef = useRef<HTMLDivElement>(null)
  const goalRef  = useRef<HTMLDivElement>(null)

  const totalNaira = parseInt(goalAmount.replace(/\D/g, ''), 10) || 0
  const totalKobo  = totalNaira * 100

  // Derived field errors — only visible after first submit attempt
  const titleErr = submitted && !title.trim() ? 'Session title is required' : undefined
  const goalErr  = submitted && totalNaira <= 0 ? 'Target amount is required' : undefined

  const canSubmit = title.trim() && totalNaira > 0

  async function handleSubmit() {
    setSubmitted(true)

    if (!title.trim()) {
      titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (totalNaira <= 0) {
      goalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setError(null)
    setLoading(true)
    try {
      if (isEditMode) {
        await editMutation({
          sessionId: editSession._id,
          name: title.trim(),
          goalAmount: totalKobo,
          totalAmount: totalKobo,
        })
        navigate('/dashboard')
      } else {
        const result = await createSession({
          mode: 'chop-in',
          name: title.trim(),
          totalAmount: totalKobo,
          goalAmount: totalKobo,
          participants: [],
        })
        navigate('/dashboard/share', {
          state: { slug: result.slug, title: title.trim(), total: totalKobo, mode: 'chop-in' },
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      if (msg.toLowerCase().includes('payment')) {
        navigate('/dashboard', { state: { notice: msg } })
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <Seo title="Chop In — Pool funds together" path="/dashboard/chop-in" noIndex />

      {/* ── Back navigation ──────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors mb-6"
      >
        <RemixIcon name="ri-arrow-left-line" size={16} />
        Back to overview
      </button>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[60%] min-w-0 flex flex-col gap-4">

          {/* Session title */}
          <div ref={titleRef} className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <RemixIcon name="ri-hand-coin-fill" size={20} color={BRAND} />
              <span className="text-[14px] font-bold text-neutral-700">
                {isEditMode ? 'Edit Chop In' : 'Chop In'}
              </span>
            </div>
            <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">
              Session Title <span className="text-red-500">*</span>
            </label>
            <input
              className={titleErr ? inputErrCls : inputCls}
              placeholder="e.g. Ada's birthday gift"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <FieldError msg={titleErr} />
          </div>

          {/* Target amount */}
          <div ref={goalRef} className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">
              Target Amount (₦) <span className="text-red-500">*</span>
            </h3>
            <input
              className={goalErr ? inputErrCls : inputCls}
              inputMode="numeric"
              placeholder="e.g. 50000"
              value={goalAmount}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                setGoalAmount(raw)
              }}
            />
            <FieldError msg={goalErr} />
            <p className="text-[12px] text-neutral-400 mt-2">
              A 1.5% platform fee + ₦50 transfer fee is applied when you withdraw funds.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl px-5 py-3 text-[13px] font-medium" style={{ background: '#fff1f2', color: '#be123c' }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-6 shrink-0">
          <div className="rounded-2xl p-7 text-white" style={{ background: BRAND }}>
            <h3 className="text-[18px] font-bold mb-5">Chop In</h3>

            <div className="border-t border-white/30 my-4" />

            <div className="flex flex-col gap-2 text-[14px] mb-6">
              <div className="flex justify-between text-[15px] font-bold">
                <span>Goal</span>
                <span>{totalNaira > 0 ? formatNaira(totalNaira) : '—'}</span>
              </div>
              {totalNaira > 0 && (
                <div className="flex justify-between text-white/70 text-[13px]">
                  <span>Platform fee (1.5%)</span>
                  <span>-{formatNaira(Math.round(totalNaira * 0.015))}</span>
                </div>
              )}
              {totalNaira > 0 && (
                <div className="flex justify-between text-white/70 text-[13px]">
                  <span>Transfer fee (Bachs)</span>
                  <span>-{formatNaira(50)}</span>
                </div>
              )}
              {totalNaira > 0 && (
                <div className="flex justify-between text-[14px] font-semibold border-t border-white/20 pt-2 mt-1">
                  <span>You receive</span>
                  <span>{formatNaira(Math.round(totalNaira * 0.985) - 50)}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={(!canSubmit && !submitted) || loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[14px] font-bold bg-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ color: '#FF6900' }}
            >
              {loading
                ? (isEditMode ? 'Saving…' : 'Creating…')
                : (isEditMode ? '💾 Save Edit' : '🔗 Create and Generate Link')}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
