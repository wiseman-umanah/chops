import RemixIcon from '@/components/RemixIcon'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const BRAND = '#FF6900'
const BILL_RED = '#FB2C36'

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

const inputCls =
  'w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FF6900] transition-colors bg-white'

type SplitType = 'equal' | 'custom' | 'percentage'

const SPLIT_TYPES: { id: SplitType; label: string }[] = [
  { id: 'equal',      label: 'Equal'      },
  { id: 'custom',     label: 'Custom'     },
  { id: 'percentage', label: 'Percentage' },
]

export default function ChopBillPage() {
  const navigate = useNavigate()

  const [title,           setTitle]           = useState('')
  const [totalAmount,     setTotalAmount]     = useState('')
  const [splitType,       setSplitType]       = useState<SplitType>('equal')
  const [participantsRaw, setParticipantsRaw] = useState('')

  // Per-person overrides for custom / percentage modes
  const [customAmounts,  setCustomAmounts]  = useState<Record<string, string>>({})
  const [percentAmounts, setPercentAmounts] = useState<Record<string, string>>({})

  const total = parseInt(totalAmount.replace(/\D/g, ''), 10) || 0

  const participants = useMemo(
    () => participantsRaw.split(',').map(s => s.trim()).filter(Boolean),
    [participantsRaw]
  )

  // ── Breakdown per person ────────────────────────────────────────────────────
  const breakdown = useMemo(() => {
    if (participants.length === 0) return []

    if (splitType === 'equal') {
      const share = participants.length > 0 ? Math.round(total / participants.length) : 0
      return participants.map(p => ({ name: p, amount: share, pct: null as null | number }))
    }

    if (splitType === 'custom') {
      return participants.map(p => ({
        name: p,
        amount: parseInt((customAmounts[p] ?? '').replace(/\D/g, ''), 10) || 0,
        pct: null,
      }))
    }

    // percentage
    return participants.map(p => {
      const pct = parseFloat(percentAmounts[p] ?? '0') || 0
      return { name: p, amount: Math.round(total * pct / 100), pct }
    })
  }, [participants, splitType, total, customAmounts, percentAmounts])

  const pctTotal = useMemo(
    () => breakdown.reduce((s, r) => s + (r.pct ?? 0), 0),
    [breakdown]
  )

  const breakdownSum = useMemo(
    () => breakdown.reduce((s, r) => s + r.amount, 0),
    [breakdown]
  )

  function handleCreate() {
    const slug = title.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100)
    navigate('/dashboard/share', { state: { slug, title, total, mode: 'bill' } })
  }

  const canCreate = title.trim() && total > 0 && participants.length > 0

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[60%] min-w-0 flex flex-col gap-4">

          {/* Session title */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <RemixIcon name="ri-coupon-5-line" size={20} color={BILL_RED} />
              <span className="text-[14px] font-bold text-neutral-700">Chop Bill</span>
            </div>
            <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">Session Title</label>
            <input
              className={inputCls}
              placeholder="Input text"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Total amount + split type */}
          <div className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-5">
            <div>
              <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">Total Amount (₦)</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="e.g. 50000"
                value={totalAmount}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                  setTotalAmount(raw)
                }}
              />
            </div>

            {/* Split type selector */}
            <div>
              <p className="text-[13px] font-bold text-neutral-800 mb-3">Split type</p>
              <div className="flex gap-2">
                {SPLIT_TYPES.map(st => {
                  const active = splitType === st.id
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSplitType(st.id)}
                      className="px-5 py-2 rounded-full text-[13px] font-semibold transition-all border"
                      style={
                        active
                          ? { background: '#18181b', color: '#fff', borderColor: '#18181b' }
                          : { background: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      {st.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Participants</h3>
            <input
              className={inputCls}
              placeholder="Input text"
              value={participantsRaw}
              onChange={e => setParticipantsRaw(e.target.value)}
            />
            <p className="text-[12px] text-neutral-400 mt-2">Separate each participant by a comma</p>
          </div>

          {/* Custom amounts per person */}
          {splitType === 'custom' && participants.length > 0 && (
            <div className="border border-neutral-200 rounded-2xl p-6">
              <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Custom amount per person (₦)</h3>
              <div className="flex flex-col gap-3">
                {participants.map(p => (
                  <div key={p} className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-neutral-700 w-28 shrink-0 truncate">{p}</span>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      placeholder="e.g. 5000"
                      value={customAmounts[p] ?? ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                        setCustomAmounts(prev => ({ ...prev, [p]: raw }))
                      }}
                    />
                  </div>
                ))}
              </div>
              {/* Custom sum vs total */}
              {total > 0 && (
                <div className="mt-4 flex justify-between text-[13px]">
                  <span className="text-neutral-500">Sum of amounts</span>
                  <span
                    className="font-bold"
                    style={{ color: breakdownSum === total ? '#16a34a' : '#dc2626' }}
                  >
                    {formatNaira(breakdownSum)}
                    {breakdownSum !== total && ` (need ${formatNaira(total)})`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Percentage per person */}
          {splitType === 'percentage' && participants.length > 0 && (
            <div className="border border-neutral-200 rounded-2xl p-6">
              <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Percentage per person</h3>
              <div className="flex flex-col gap-3">
                {participants.map(p => (
                  <div key={p} className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-neutral-700 w-28 shrink-0 truncate">{p}</span>
                    <div className="relative flex-1">
                      <input
                        className={inputCls}
                        inputMode="decimal"
                        placeholder="e.g. 25"
                        value={percentAmounts[p] ?? ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '')
                          setPercentAmounts(prev => ({ ...prev, [p]: raw }))
                        }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-neutral-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Percentage sum indicator */}
              <div className="mt-4 flex justify-between text-[13px]">
                <span className="text-neutral-500">Total percentage</span>
                <span
                  className="font-bold"
                  style={{ color: Math.abs(pctTotal - 100) < 0.01 ? '#16a34a' : '#dc2626' }}
                >
                  {pctTotal.toFixed(1)}% {Math.abs(pctTotal - 100) < 0.01 ? '✓' : '(must equal 100%)'}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ── Right column: breakdown — 40%, sticky ───────────────────────── */}
        <div className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-6 shrink-0">
          <div className="rounded-2xl p-7 text-white" style={{ background: BILL_RED }}>
            <h3 className="text-[18px] font-bold mb-5">Split breakdown</h3>

            {/* Per-person rows */}
            <div className="flex flex-col gap-2 mb-5">
              {breakdown.length > 0 ? breakdown.map(row => (
                <div key={row.name} className="flex justify-between text-[14px]">
                  <span>{row.name}</span>
                  <span className="font-semibold">
                    {formatNaira(row.amount)}
                    {row.pct !== null && (
                      <span className="text-white/60 text-[12px] ml-1">({row.pct}%)</span>
                    )}
                  </span>
                </div>
              )) : (
                <p className="text-[13px] text-white/60">Add participants to see the split.</p>
              )}
            </div>

            <div className="border-t border-white/30 my-4" />

            <div className="flex flex-col gap-2 text-[14px] mb-6">
              <div className="flex justify-between font-bold text-[15px]">
                <span>Total</span>
                <span>{total > 0 ? formatNaira(total) : '—'}</span>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[14px] font-bold bg-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ color: BRAND }}
            >
              🔗 Create and Generate Link
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
