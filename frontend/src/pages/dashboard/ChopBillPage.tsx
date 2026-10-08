import RemixIcon from '@/components/RemixIcon'
import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

const BRAND = '#FB2C36'

type SplitType = 'equal' | 'custom' | 'percentage'

interface Participant {
  id: string
  name: string
  customAmount: string
  percent: string
}

interface EditSession {
  _id: Id<'sessions'>
  name: string
  totalAmount: number
  splitType?: SplitType
  participants: {
    name: string
    sharePercent?: number
    amountOwed: number
  }[]
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

const inputCls =
  'w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FB2C36] transition-colors bg-white'

const SPLITS: { key: SplitType; label: string }[] = [
  { key: 'equal', label: 'Equal' },
  { key: 'custom', label: 'Custom' },
  { key: 'percentage', label: 'Percentage' },
]

function SplitToggle({
  value,
  onChange,
  disabled,
}: {
  value: SplitType
  onChange: (v: SplitType) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {SPLITS.map(s => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          disabled={disabled}
          className="px-5 py-2 rounded-full text-[13px] font-semibold transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
          style={
            value === s.key
              ? { background: BRAND, color: '#fff', borderColor: BRAND }
              : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

function ParticipantRow({
  p,
  splitType,
  totalNaira,
  onUpdate,
  onRemove,
  canRemove,
}: {
  p: Participant
  splitType: SplitType
  totalNaira: number
  onUpdate: (patch: Partial<Participant>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className={inputCls}
        placeholder="Name"
        value={p.name}
        onChange={e => onUpdate({ name: e.target.value })}
      />

      {splitType === 'custom' && (
        <div className="flex items-center border border-neutral-200 rounded-full px-3 py-2 bg-white gap-1 shrink-0 w-36">
          <span className="text-[12px] text-neutral-400">₦</span>
          <input
            type="number"
            min="0"
            className="flex-1 text-[13px] text-neutral-800 outline-none w-0 min-w-0 bg-transparent"
            placeholder="0"
            value={p.customAmount || ''}
            onChange={e => onUpdate({ customAmount: e.target.value })}
          />
        </div>
      )}

      {splitType === 'percentage' && (
        <div className="flex items-center border border-neutral-200 rounded-full px-3 py-2 bg-white gap-1 shrink-0 w-28">
          <input
            type="number"
            min="0"
            max="100"
            className="flex-1 text-[13px] text-neutral-800 outline-none w-0 min-w-0 bg-transparent"
            placeholder="0"
            value={p.percent || ''}
            onChange={e => onUpdate({ percent: e.target.value })}
          />
          <span className="text-[12px] text-neutral-400">%</span>
        </div>
      )}

      {splitType === 'equal' && totalNaira > 0 && (
        <span className="text-[13px] text-neutral-500 shrink-0 w-24 text-right" />
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-30"
      >
        <RemixIcon name="ri-delete-bin-5-fill" color="#FB2C36" />
      </button>
    </div>
  )
}

// ── Prefill helpers ───────────────────────────────────────────────────────────

function prefillParticipants(es: EditSession, splitType: SplitType): Participant[] {
  return es.participants.map(p => ({
    id: uid(),
    name: p.name,
    // custom: show naira amount minus the fee (amountOwed includes fee — approximate)
    customAmount: splitType === 'custom' ? String(Math.round(p.amountOwed / 100)) : '',
    percent: splitType === 'percentage' ? String(p.sharePercent ?? '') : '',
  }))
}

export default function ChopBillPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const editSession = (location.state as { editSession?: EditSession } | null)?.editSession ?? null
  const isEditMode  = editSession !== null

  const resolvedSplitType: SplitType = isEditMode
    ? (editSession.splitType ?? 'equal')
    : 'equal'

  const createSession = useMutation(api.sessions.createSession)
  const editMutation  = useMutation(api.sessions.editSession)

  const [title, setTitle]         = useState(isEditMode ? editSession.name : '')
  const [totalRaw, setTotalRaw]   = useState(
    isEditMode ? String(Math.round(editSession.totalAmount / 100)) : ''
  )
  // In edit mode, split type is locked to what was originally chosen
  const [splitType, setSplitType] = useState<SplitType>(resolvedSplitType)
  const [participants, setParticipants] = useState<Participant[]>(
    isEditMode
      ? prefillParticipants(editSession, resolvedSplitType)
      : [{ id: uid(), name: '', customAmount: '', percent: '' }]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const totalNaira = parseInt(totalRaw.replace(/\D/g, ''), 10) || 0
  const totalKobo  = totalNaira * 100
  const count      = participants.length

  function computeFeePerParticipant(total: number, n: number): number {
    if (n === 0) return 0
    let totalFee: number
    if (total < 500_000)        totalFee = 10_000
    else if (total < 1_000_000) totalFee = 15_000
    else if (total < 2_000_000) totalFee = 20_000
    else if (total < 5_000_000) totalFee = Math.round(total * 0.0075)
    else                        totalFee = Math.round(total * 0.005)
    return Math.round(totalFee / n)
  }

  const feePerParticipant = computeFeePerParticipant(totalKobo, count)

  const breakdown = useMemo(() => {
    if (splitType === 'equal') {
      const base = count > 0 ? Math.round(totalKobo / count) : 0
      return participants.map(p => ({ name: p.name || '—', base, fee: feePerParticipant, total: base + feePerParticipant }))
    }
    if (splitType === 'percentage') {
      const pctTotal = participants.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0)
      return participants.map(p => {
        const pct  = parseFloat(p.percent) || 0
        const base = Math.round(totalKobo * (pct / 100))
        return { name: p.name || '—', base, fee: feePerParticipant, total: base + feePerParticipant, pct, pctTotal }
      })
    }
    return participants.map(p => {
      const base = Math.round((parseFloat(p.customAmount) || 0) * 100)
      return { name: p.name || '—', base, fee: feePerParticipant, total: base + feePerParticipant }
    })
  }, [participants, splitType, totalKobo, feePerParticipant, count])

  const pctSum    = useMemo(() => participants.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0), [participants])
  const customSum = useMemo(() => participants.reduce((s, p) => s + (parseFloat(p.customAmount) || 0) * 100, 0), [participants])

  function addParticipant() {
    setParticipants(prev => [...prev, { id: uid(), name: '', customAmount: '', percent: '' }])
  }
  function updateParticipant(id: string, patch: Partial<Participant>) {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }
  function removeParticipant(id: string) {
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  function validate(): string | null {
    if (!title.trim()) return 'Session title is required'
    if (totalNaira <= 0) return 'Total amount must be greater than 0'
    if (participants.some(p => !p.name.trim())) return 'All participants must have a name'
    if (splitType === 'percentage' && Math.abs(pctSum - 100) > 0.01)
      return `Percentages must sum to 100 (currently ${pctSum.toFixed(1)}%)`
    if (splitType === 'custom' && Math.abs(customSum - totalKobo) > 1)
      return `Custom amounts must sum to ₦${totalNaira.toLocaleString()} (currently ₦${Math.round(customSum / 100).toLocaleString()})`
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setLoading(true)
    try {
      const convexParticipants = participants.map(p => {
        if (splitType === 'equal') return { name: p.name.trim() }
        if (splitType === 'percentage') return { name: p.name.trim(), sharePercent: parseFloat(p.percent) || 0 }
        return { name: p.name.trim(), amountOwed: Math.round((parseFloat(p.customAmount) || 0) * 100) }
      })

      if (isEditMode) {
        await editMutation({
          sessionId: editSession._id,
          name: title.trim(),
          totalAmount: totalKobo,
          participants: convexParticipants,
        })
        navigate('/dashboard')
      } else {
        const result = await createSession({
          mode: 'bill',
          name: title.trim(),
          totalAmount: totalKobo,
          splitType,
          participants: convexParticipants,
        })
        navigate('/dashboard/share', {
          state: { slug: result.slug, title: title.trim(), total: totalKobo, mode: 'bill' },
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

      {/* ── Back navigation ──────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500 hover:text-neutral-800 transition-colors mb-6"
      >
        <RemixIcon name="ri-arrow-left-line" size={16} />
        Back to overview
      </button>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[60%] min-w-0 flex flex-col gap-4">

          <div className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <RemixIcon name="ri-coupon-5-line" size={20} color={BRAND} />
              <span className="text-[14px] font-bold text-neutral-700">
                {isEditMode ? 'Edit Chop Bill' : 'Chop Bill'}
              </span>
            </div>
            <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">Session Title</label>
            <input
              className={inputCls}
              placeholder="e.g. Lagos trip expenses"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Total Bill Amount (₦)</h3>
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="e.g. 120000"
              value={totalRaw}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                setTotalRaw(raw)
              }}
            />
          </div>

          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Split Type</h3>
            {/* Lock split type in edit mode — changing it would invalidate stored participant data */}
            <SplitToggle
              value={splitType}
              onChange={t => { setSplitType(t); setError(null) }}
              disabled={isEditMode}
            />
            {isEditMode && (
              <p className="text-[11px] text-neutral-400 mt-2">Split type cannot be changed when editing.</p>
            )}
            {!isEditMode && (
              <p className="text-[12px] text-neutral-400 mt-3">
                {splitType === 'equal'      && 'Total is divided equally among all participants.'}
                {splitType === 'custom'     && 'Enter a specific naira amount for each participant.'}
                {splitType === 'percentage' && 'Set a percentage share for each participant. Must add up to 100%.'}
              </p>
            )}
          </div>

          <div className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-neutral-900">Participants</h3>
              {splitType === 'percentage' && (
                <span
                  className="text-[12px] font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: Math.abs(pctSum - 100) < 0.01 ? '#dcfce7' : '#fef9c3',
                    color: Math.abs(pctSum - 100) < 0.01 ? '#166534' : '#854d0e',
                  }}
                >
                  {pctSum.toFixed(0)}% / 100%
                </span>
              )}
              {splitType === 'custom' && totalNaira > 0 && (
                <span
                  className="text-[12px] font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: Math.abs(customSum - totalKobo) < 1 ? '#dcfce7' : '#fef9c3',
                    color: Math.abs(customSum - totalKobo) < 1 ? '#166534' : '#854d0e',
                  }}
                >
                  ₦{Math.round(customSum / 100).toLocaleString()} / ₦{totalNaira.toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {participants.map(p => (
                <ParticipantRow
                  key={p.id}
                  p={p}
                  splitType={splitType}
                  totalNaira={totalNaira}
                  onUpdate={patch => updateParticipant(p.id, patch)}
                  onRemove={() => removeParticipant(p.id)}
                  canRemove={participants.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addParticipant}
              className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
              style={{ color: BRAND }}
            >
              + Add Participant
            </button>
          </div>

          {error && (
            <div className="rounded-2xl px-5 py-3 text-[13px] font-medium" style={{ background: '#fff1f2', color: '#be123c' }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Right column: summary ─────────────────────────────────────── */}
        <div className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-6 shrink-0">
          <div className="rounded-2xl p-7 text-white" style={{ background: BRAND }}>
            <h3 className="text-[18px] font-bold mb-5">Split Breakdown</h3>

            <div className="flex flex-col gap-2 mb-5">
              {breakdown.length > 0 && totalKobo > 0 ? (
                breakdown.map((row, i) => (
                  <div key={i} className="flex justify-between text-[14px]">
                    <span>{row.name}</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatNaira(Math.round(row.total / 100))}</span>
                      {splitType === 'percentage' && 'pct' in row && (
                        <span className="text-white/60 text-[11px] ml-1.5">({(row as { pct: number }).pct}%)</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-white/60">Add participants and a total to see the split.</p>
              )}
            </div>

            <div className="border-t border-white/30 my-4" />

            <div className="flex flex-col gap-2 text-[14px] mb-6">
              <div className="flex justify-between">
                <span className="font-semibold">Total Bill</span>
                <span className="font-semibold">{formatNaira(totalNaira)}</span>
              </div>
              {totalKobo > 0 && (
                <div className="flex justify-between text-white/70 text-[13px]">
                  <span>Platform fee / person</span>
                  <span>{formatNaira(Math.round(feePerParticipant / 100))}</span>
                </div>
              )}
              <div className="flex justify-between text-[15px] font-bold mt-1">
                <span>Participants</span>
                <span>{count}</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!title.trim() || totalNaira === 0 || loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[14px] font-bold bg-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ color: BRAND }}
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
