import RemixIcon from '@/components/RemixIcon'
import { Seo } from '@/hooks/useSeo'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

const BRAND = '#FF6900'

interface MenuItem {
  id: string
  name: string
  qty: number
  /** Price per unit in naira (user-entered) */
  price: number
  participant: string
}

// Shape that OverviewPage passes for edit
interface EditSession {
  _id: Id<'sessions'>
  name: string
  totalAmount: number
  taxKobo?: number
  tipKobo?: number
  participants: {
    name: string
    items?: { name: string; price: number }[]
  }[]
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

const inputCls =
  'w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FF6900] transition-colors bg-white'

function computeFeePerParticipant(totalKobo: number, n: number): number {
  if (n === 0) return 0
  let totalFee: number
  if (totalKobo < 500_000)        totalFee = 10_000
  else if (totalKobo < 1_000_000) totalFee = 15_000
  else if (totalKobo < 2_000_000) totalFee = 20_000
  else if (totalKobo < 5_000_000) totalFee = Math.round(totalKobo * 0.0075)
  else                             totalFee = Math.round(totalKobo * 0.005)
  return Math.round(totalFee / n)
}

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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-1 border rounded-full px-4 py-2.5 text-[13px] font-medium transition-all bg-white"
        style={{ borderColor: open ? BRAND : '#e5e7eb', color: value !== 'Everyone' ? BRAND : '#374151' }}
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

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-neutral-100 bg-white shadow-lg overflow-hidden py-1" style={{ minWidth: 130 }}>
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

// ── Prefill helpers for edit mode ─────────────────────────────────────────────

function prefillParticipantsRaw(es: EditSession): string {
  return es.participants.map(p => p.name).join(', ')
}

function prefillItems(es: EditSession): MenuItem[] {
  // Flatten all items from all participants; assign participant name to each
  const result: MenuItem[] = []
  for (const p of es.participants) {
    for (const item of p.items ?? []) {
      result.push({
        id: uid(),
        name: item.name,
        // items are stored as kobo total (qty already baked in) — display as naira per item
        qty: 1,
        price: item.price / 100,
        participant: p.name,
      })
    }
  }
  return result.length > 0
    ? result
    : [{ id: uid(), name: '', qty: 1, price: 0, participant: 'Everyone' }]
}

export default function ChopFoodPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const editSession   = (location.state as { editSession?: EditSession } | null)?.editSession ?? null
  const isEditMode    = editSession !== null

  const createSession = useMutation(api.sessions.createSession)
  const editMutation  = useMutation(api.sessions.editSession)

  // Prefill from editSession if in edit mode
  const [title, setTitle]                     = useState(isEditMode ? editSession.name : '')
  const [participantsRaw, setParticipantsRaw] = useState(isEditMode ? prefillParticipantsRaw(editSession) : '')
  const [items, setItems]                     = useState<MenuItem[]>(
    isEditMode ? prefillItems(editSession) : [{ id: uid(), name: '', qty: 1, price: 0, participant: 'Everyone' }]
  )
  const [taxPct, setTaxPct] = useState(
    isEditMode && editSession.taxKobo ? String(Math.round((editSession.taxKobo / editSession.totalAmount) * 100)) : ''
  )
  const [tipPct, setTipPct] = useState(
    isEditMode && editSession.tipKobo ? String(Math.round((editSession.tipKobo / editSession.totalAmount) * 100)) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const namedPeople = useMemo(
    () => participantsRaw.split(',').map(s => s.trim()).filter(Boolean),
    [participantsRaw]
  )
  const participants = useMemo(() => ['Everyone', ...namedPeople], [namedPeople])

  const subtotal      = items.reduce((s, it) => s + it.qty * it.price, 0)
  const tax           = Math.round(subtotal * (parseFloat(taxPct) || 0) / 100)
  const tip           = Math.round(subtotal * (parseFloat(tipPct) || 0) / 100)
  const total         = subtotal + tax + tip
  const totalKobo     = total * 100
  const feePerParticipantKobo = computeFeePerParticipant(totalKobo, namedPeople.length)

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
    const taxTipFactor = subtotal > 0 ? (tax + tip) / subtotal : 0
    return Object.fromEntries(
      Object.entries(totals).map(([p, v]) => [
        p,
        Math.round(v * (1 + taxTipFactor)) + Math.round(feePerParticipantKobo / 100),
      ])
    )
  }, [items, namedPeople, tax, tip, subtotal, feePerParticipantKobo])

  function addItem() {
    setItems(prev => [...prev, { id: uid(), name: '', qty: 1, price: 0, participant: 'Everyone' }])
  }
  function updateItem(id: string, patch: Partial<MenuItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }
  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Session title is required'); return }
    if (namedPeople.length === 0) { setError('Add at least one participant'); return }

    const convexParticipants: { name: string; items: { name: string; price: number }[] }[] =
      namedPeople.map(p => {
        const myItems: { name: string; price: number }[] = []
        items.forEach(it => {
          if (it.participant === p || it.participant === 'Everyone') {
            myItems.push({ name: it.name || 'Item', price: Math.round(it.price * 100) * it.qty })
          }
        })
        return { name: p, items: myItems }
      })

    const hasEmptyItems = convexParticipants.some(p => p.items.length === 0)
    if (hasEmptyItems) { setError('Every participant must have at least one item'); return }

    setError(null)
    setLoading(true)
    try {
      if (isEditMode) {
        await editMutation({
          sessionId: editSession._id,
          name: title.trim(),
          totalAmount: totalKobo,
          taxKobo: tax * 100,
          tipKobo: tip * 100,
          participants: convexParticipants,
        })
        navigate('/dashboard')
      } else {
        const result = await createSession({
          mode: 'food',
          name: title.trim(),
          totalAmount: totalKobo,
          taxKobo: tax * 100,
          tipKobo: tip * 100,
          participants: convexParticipants,
        })
        navigate('/dashboard/share', {
          state: { slug: result.slug, title: title.trim(), total: totalKobo, mode: 'food' },
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      // If payments already exist the server will say so — send user back to overview
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
      <Seo title="Chop Food — Split a food bill" path="/dashboard/chop-food" noIndex />

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

          <div className="border border-neutral-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <RemixIcon name='ri-restaurant-2-fill' size={20} color={BRAND} />
              <span className="text-[14px] font-bold text-neutral-700">
                {isEditMode ? 'Edit Chop Food' : 'Chop Food'}
              </span>
            </div>
            <label className="block text-[13px] font-bold text-neutral-800 mb-1.5">Session Title</label>
            <input
              className={inputCls}
              placeholder="e.g. Team lunch at Chicken Republic"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Participants</h3>
            <input
              className={inputCls}
              placeholder="e.g. Tunde, Amaka, Seun"
              value={participantsRaw}
              onChange={e => setParticipantsRaw(e.target.value)}
            />
            <p className="text-[12px] text-neutral-400 mt-2">Separate each participant by a comma</p>
          </div>

          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Menu</h3>

            {/* Desktop column headers — hidden on mobile */}
            <div className="hidden sm:grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 80px 100px 140px 36px' }}>
              {['Food Name', 'Amount', 'Price (₦)', 'Participant', ''].map(h => (
                <span key={h} className="text-[12px] font-semibold text-neutral-500">{h}</span>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {items.map(item => (
                <div key={item.id}>
                  {/* ── Desktop row ── */}
                  <div className="hidden sm:grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 80px 100px 140px 36px' }}>
                    <input
                      className={inputCls}
                      placeholder="Jollof rice"
                      value={item.name}
                      onChange={e => updateItem(item.id, { name: e.target.value })}
                    />
                    <div className="flex items-center justify-between border border-neutral-200 rounded-full px-3 py-2 bg-white">
                      <button onClick={() => updateItem(item.id, { qty: Math.max(1, item.qty - 1) })}
                        className="text-neutral-400 hover:text-neutral-700 text-[16px] leading-none w-4">−</button>
                      <span className="text-[13px] font-medium text-neutral-800">{item.qty}</span>
                      <button onClick={() => updateItem(item.id, { qty: item.qty + 1 })}
                        className="text-neutral-400 hover:text-neutral-700 text-[16px] leading-none w-4">+</button>
                    </div>
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
                    <ParticipantSelect
                      value={item.participant}
                      options={participants}
                      onChange={v => updateItem(item.id, { participant: v })}
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-30"
                    >
                      <RemixIcon name='ri-delete-bin-5-fill' color='#FB2C36' />
                    </button>
                  </div>

                  {/* ── Mobile card ── */}
                  <div className="sm:hidden border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3">
                    {/* Row 1: food name + delete */}
                    <div className="flex items-center gap-2">
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder="Jollof rice"
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                      />
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors disabled:opacity-30"
                      >
                        <RemixIcon name='ri-delete-bin-5-fill' color='#FB2C36' />
                      </button>
                    </div>

                    {/* Row 2: qty + price side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">Amount</p>
                        <div className="flex items-center justify-between border border-neutral-200 rounded-full px-3 py-2 bg-white">
                          <button onClick={() => updateItem(item.id, { qty: Math.max(1, item.qty - 1) })}
                            className="text-neutral-400 hover:text-neutral-700 text-[16px] leading-none w-5">−</button>
                          <span className="text-[13px] font-medium text-neutral-800">{item.qty}</span>
                          <button onClick={() => updateItem(item.id, { qty: item.qty + 1 })}
                            className="text-neutral-400 hover:text-neutral-700 text-[16px] leading-none w-5">+</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">Price (₦)</p>
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
                      </div>
                    </div>

                    {/* Row 3: participant full width */}
                    <div>
                      <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">Participant</p>
                      <ParticipantSelect
                        value={item.participant}
                        options={participants}
                        onChange={v => updateItem(item.id, { participant: v })}
                      />
                    </div>
                  </div>
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

          <div className="border border-neutral-200 rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-neutral-900 mb-4">Tax &amp; tip</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-neutral-800 mb-1.5">Tax%</label>
                <input
                  className={inputCls}
                  placeholder="e.g. 7"
                  inputMode="numeric"
                  value={taxPct}
                  onChange={e => {
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

          {error && (
            <div className="rounded-2xl px-5 py-3 text-[13px] font-medium" style={{ background: '#fff7ed', color: '#9a3412' }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[40%] min-w-0 lg:sticky lg:top-6 shrink-0">
          <div className="rounded-2xl p-7 text-white" style={{ background: BRAND }}>
            <h3 className="text-[18px] font-bold mb-5">Split breakdown</h3>

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
              {namedPeople.length > 0 && totalKobo > 0 && (
                <div className="flex justify-between text-white/70 text-[13px]">
                  <span>Platform fee / person</span>
                  <span>{formatNaira(Math.round(feePerParticipantKobo / 100))}</span>
                </div>
              )}
              <div className="flex justify-between text-[15px] font-bold mt-1">
                <span>Total</span>
                <span>{formatNaira(total)}</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!title.trim() || loading}
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
