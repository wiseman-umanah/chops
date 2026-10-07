import RemixIcon from '@/components/RemixIcon'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BRAND = '#FF6900'

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

// ── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  'w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FF6900] transition-colors bg-white'

export default function ChopInPage() {
  const navigate = useNavigate()

  const [title,      setTitle]      = useState('')
  const [goalAmount, setGoalAmount] = useState('')

  const total = parseInt(goalAmount.replace(/\D/g, ''), 10) || 0

  function handleCreate() {
    const slug = title.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100)
    navigate('/dashboard/share', { state: { slug, title, total, mode: 'chop-in' } })
  }

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left column: form — 60% ───────────────────────────────────── */}
        <div className="w-full lg:w-[60%] min-w-0 flex flex-col gap-4">

          {/* Session title card */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <RemixIcon name="ri-hand-coin-fill" size={20} color="#00C950" />
              <span className="text-[14px] font-bold text-neutral-700">Chop In</span>
            </div>
            <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">Session Title</label>
            <input
              className={inputCls}
              placeholder="Input text"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Target amount */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Target amount (₦)</h3>
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="e.g. 50000"
              value={goalAmount}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                setGoalAmount(raw)
              }}
            />
          </div>
        </div>

        {/* ── Right column: split breakdown — 40%, sticky ───────────────── */}
        <div className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-6 shrink-0">
          <div className="rounded-2xl p-7 text-white" style={{ background: '#00C950' }}>
            <h3 className="text-[18px] font-bold mb-5">Chop In</h3>

            <div className="border-t border-white/30 my-4" />

            {/* Summary */}
            <div className="flex flex-col gap-2 text-[14px] mb-6">
              <div className="flex justify-between text-[15px] font-bold">
                <span>Goal</span>
                <span>{total > 0 ? formatNaira(total) : '—'}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
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
