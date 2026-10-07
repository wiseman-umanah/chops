import RemixIcon from '@/components/RemixIcon'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BRAND = '#FF6900'

interface MenuItem {
  id: string
  name: string
  qty: number
  price: number
  participant: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

// ── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  'w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FF6900] transition-colors bg-white'

// ── Custom participant dropdown ───────────────────────────────────────────────
function ParticipantSelect({
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

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-1 border rounded-full px-4 py-2.5 text-[13px] font-medium transition-all bg-white"
        style={{
          borderColor: open ? BRAND : '#e5e7eb',
          color: value !== 'Everyone' ? BRAND : '#374151',
        }}
      >
        <span className="truncate">{value}</span>
        <RemixIcon
          name="ri-arrow-down-s-line"
          size={16}
          color={open ? BRAND : '#9ca3af'}
          className="shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-2xl border border-neutral-100 bg-white shadow-lg overflow-hidden py-1"
          style={{ minWidth: 130 }}
        >
          {options.map(opt => {
            const selected = opt === value
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-neutral-50"
                style={{ color: selected ? BRAND : '#374151', fontWeight: selected ? 600 : 400 }}
              >
                {opt}
                {selected && <RemixIcon name="ri-check-line" size={14} color={BRAND} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ChopFoodPage() {
  const navigate = useNavigate()

  const [title, setTitle]           = useState('')
  const [participantsRaw, setParticipantsRaw] = useState('')
  const [items, setItems]           = useState<MenuItem[]>([
    { id: uid(), name: '', qty: 1, price: 0, participant: 'Everyone' },
  ])
  const [taxPct, setTaxPct]         = useState('')
  const [tipPct, setTipPct]         = useState('')

  const participants = useMemo(
    () => ['Everyone', ...participantsRaw.split(',').map(s => s.trim()).filter(Boolean)],
    [participantsRaw]
  )

  // ── Derived breakdown ──────────────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0)
  const tax      = Math.round(subtotal * (parseFloat(taxPct) || 0) / 100)
  const tip      = Math.round(subtotal * (parseFloat(tipPct) || 0) / 100)
  const total    = subtotal + tax + tip

  // per-person split (Everyone = divide equally; named = only their items)
  const namedPeople = participants.filter(p => p !== 'Everyone')

  const perPerson = useMemo(() => {
    const totals: Record<string, number> = {}
    namedPeople.forEach(p => { totals[p] = 0 })

    items.forEach(it => {
      const lineTotal = it.qty * it.price
      if (it.participant === 'Everyone') {
        const share = namedPeople.length > 0 ? lineTotal / namedPeople.length : lineTotal
        namedPeople.forEach(p => { totals[p] = (totals[p] ?? 0) + share })
      } else {
        totals[it.participant] = (totals[it.participant] ?? 0) + lineTotal
      }
    })

    // apply tax + tip proportionally
    const taxTipFactor = subtotal > 0 ? (tax + tip) / subtotal : 0
    return Object.fromEntries(
      Object.entries(totals).map(([p, v]) => [p, Math.round(v * (1 + taxTipFactor))])
    )
  }, [items, namedPeople, tax, tip, subtotal])

  // ── Item helpers ───────────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, { id: uid(), name: '', qty: 1, price: 0, participant: 'Everyone' }])
  }

  function updateItem(id: string, patch: Partial<MenuItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  function handleCreate() {
    // Store a mock session slug and navigate to share page
    const slug = title.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 100)
    navigate('/dashboard/share', { state: { slug, title, total, mode: 'food' } })
  }

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left column: form — 60% ───────────────────────────────────── */}
        <div className="w-full lg:w-[60%] min-w-0 flex flex-col gap-4">

          {/* Session title card */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[16px]"><RemixIcon name='ri-restaurant-2-fill' size={20} color="#FF6900" /></span>
              <span className="text-[14px] font-bold text-neutral-700">Chop Food</span>
            </div>
            <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">Session Title</label>
            <input
              className={inputCls}
              placeholder="Input text"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
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

          {/* Menu */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Menu</h3>

            {/* Column headers */}
            <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 80px 100px 140px 36px' }}>
              {['Food Name', 'Amount', 'Price', 'Participant', ''].map(h => (
                <span key={h} className="text-[12px] font-semibold text-neutral-500">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <div key={item.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 80px 100px 140px 36px' }}>
                  <input
                    className={inputCls}
                    placeholder="Jollof rice"
                    value={item.name}
                    onChange={e => updateItem(item.id, { name: e.target.value })}
                  />
                  {/* Qty stepper */}
                  <div className="flex items-center justify-between border border-neutral-200 rounded-full px-3 py-2 bg-white">
                    <button onClick={() => updateItem(item.id, { qty: Math.max(1, item.qty - 1) })}
                      className="text-neutral-400 hover:text-neutral-700 text-[16px] leading-none w-4">−</button>
                    <span className="text-[13px] font-medium text-neutral-800">{item.qty}</span>
                    <button onClick={() => updateItem(item.id, { qty: item.qty + 1 })}
                      className="text-neutral-400 hover:text-neutral-700 text-[16px] leading-none w-4">+</button>
                  </div>
                  {/* Price */}
                  <div className="flex items-center border border-neutral-200 rounded-full px-3 py-2 bg-white gap-1">
                    <input
                      type="number" min="0"
                      className="flex-1 text-[13px] text-neutral-800 outline-none w-0 min-w-0 bg-transparent"
                      placeholder="0"
                      value={item.price || ''}
                      onChange={e => updateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                    />
                    <button onClick={() => updateItem(item.id, { price: Math.max(0, item.price - 100) })}
                      className="text-neutral-400 hover:text-neutral-700 text-[14px] leading-none">−</button>
                  </div>
                  {/* Participant dropdown */}
                  <ParticipantSelect
                    value={item.participant}
                    options={participants}
                    onChange={v => updateItem(item.id, { participant: v })}
                  />
                  {/* Delete */}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-30"
                  >
                    <RemixIcon name='ri-delete-bin-5-fill' color='#FB2C36' />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addItem}
              className="mt-4 ml-auto flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
              style={{ color: BRAND }}
            >
              + Add Item
            </button>
          </div>

          {/* Tax & tip */}
          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Tax &amp; tip</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-neutral-800 mb-1.5">Tax%</label>
                <input
                  className={inputCls}
                  placeholder="e.g. 7"
                  inputMode="numeric"
                  min="1"
                  max="100"
                  value={taxPct}
                  onChange={e => {
                    // strip non-digits, remove leading zeros, clamp 1–100
                    const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
                    const n = parseInt(raw, 10)
                    if (raw === '') { setTaxPct(''); return }
                    if (!isNaN(n) && n >= 1 && n <= 100) setTaxPct(String(n))
                  }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-neutral-800 mb-1.5">Tip%</label>
                <input
                  className={inputCls}
                  placeholder="e.g. 10"
                  inputMode="numeric"
                  min="1"
                  max="100"
                  value={tipPct}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '')
                    const n = parseInt(raw, 10)
                    if (raw === '') { setTipPct(''); return }
                    if (!isNaN(n) && n >= 1 && n <= 100) setTipPct(String(n))
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: split breakdown — 40%, sticky ───────────────── */}
        <div className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-6 shrink-0">
          <div className="rounded-2xl p-7 text-white" style={{ background: BRAND }}>
            <h3 className="text-[18px] font-bold mb-5">Split breakdown</h3>

            {/* Per-person rows */}
            <div className="flex flex-col gap-2 mb-5">
              {namedPeople.length > 0 ? namedPeople.map(p => (
                <div key={p} className="flex justify-between text-[14px]">
                  <span>{p}</span>
                  <span className="font-semibold">{formatNaira(perPerson[p] ?? 0)}</span>
                </div>
              )) : (
                <p className="text-[13px] text-white/60">Add participants above to see the split.</p>
              )}
            </div>

            <div className="border-t border-white/30 my-4" />

            {/* Totals */}
            <div className="flex flex-col gap-2 text-[14px] mb-6">
              <div className="flex justify-between">
                <span className="font-semibold">Subtotal</span>
                <span className="font-semibold">{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Tax</span>
                <span className="font-semibold">{formatNaira(tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Tip</span>
                <span className="font-semibold">{formatNaira(tip)}</span>
              </div>
              <div className="flex justify-between text-[15px] font-bold mt-1">
                <span>Total</span>
                <span>{formatNaira(total)}</span>
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
