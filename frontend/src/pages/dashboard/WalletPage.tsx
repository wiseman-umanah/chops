import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Seo } from '@/hooks/useSeo'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'
const CHOP_IN_GREEN = '#00C950'

const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank', 'EcoBank', 'Fidelity Bank', 'First Bank',
  'First City Monument Bank (FCMB)', 'Globus Bank', 'Guaranty Trust Bank (GTB)',
  'Heritage Bank', 'Keystone Bank', 'Kuda Bank', 'Moniepoint',
  'OPay', 'Palmpay', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC',
  'Standard Chartered', 'Sterling Bank', 'Titan Trust Bank', 'Union Bank',
  'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
]

function formatNaira(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Withdraw modal ─────────────────────────────────────────────────────────

interface WithdrawModalProps {
  session: {
    _id: Id<'sessions'>
    name: string
    payoutKobo: number
    feeKobo: number
    collectedKobo: number
  }
  onClose: () => void
}

function WithdrawModal({ session, onClose }: WithdrawModalProps) {
  const requestPayout = useMutation(api.payouts.requestPayout)

  const [recipientName,  setRecipientName]  = useState('')
  const [accountNumber,  setAccountNumber]  = useState('')
  const [bankName,       setBankName]       = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [done,           setDone]           = useState(false)

  async function handleWithdraw() {
    if (!recipientName.trim() || !accountNumber.trim() || !bankName) {
      setError('Please fill in all fields.')
      return
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError('Account number must be exactly 10 digits.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await requestPayout({
        sessionId: session._id,
        recipientName: recipientName.trim(),
        accountNumber: accountNumber.trim(),
        bankName,
      })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-3xl w-full max-w-[420px] p-7 shadow-2xl"
      >
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#dcfce7' }}>
              <RemixIcon name="ri-checkbox-circle-fill" size={28} color="#16a34a" />
            </div>
            <p className="text-[18px] font-extrabold text-neutral-900 mb-1">Withdrawal initiated!</p>
            <p className="text-[13px] text-neutral-500 mb-6">
              {formatNaira(session.payoutKobo)} will be sent to {bankName}.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-full text-[14px] font-bold text-white"
              style={{ background: BRAND }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[17px] font-extrabold text-neutral-900">Withdraw funds</h3>
                <p className="text-[13px] text-neutral-400 mt-0.5">{session.name}</p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
                <RemixIcon name="ri-close-line" size={18} color="#6b7280" />
              </button>
            </div>

            {/* Amount breakdown */}
            <div className="rounded-2xl p-4 mb-5 flex flex-col gap-2"
              style={{ background: '#f0fdf4' }}>
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-500">Collected</span>
                <span className="font-semibold text-neutral-800">{formatNaira(session.collectedKobo)}</span>
              </div>
              {session.feeKobo > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-neutral-500">Platform fee (10%)</span>
                  <span className="font-semibold text-neutral-500">−{formatNaira(session.feeKobo)}</span>
                </div>
              )}
              <div className="border-t border-neutral-200 pt-2 flex justify-between text-[14px]">
                <span className="font-bold text-neutral-800">You receive</span>
                <span className="font-extrabold" style={{ color: CHOP_IN_GREEN }}>
                  {formatNaira(session.payoutKobo)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">Account Name</label>
                <input
                  type="text"
                  placeholder="Full name on account"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">Account Number</label>
                <input
                  type="text"
                  placeholder="10-digit account number"
                  value={accountNumber}
                  maxLength={10}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">Bank</label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-full px-4 py-2.5 text-[14px] outline-none focus:border-[#FF6900] transition-colors bg-white appearance-none"
                >
                  <option value="">Select bank…</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-[12px] font-medium px-1" style={{ color: '#dc2626' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="mt-5 w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: CHOP_IN_GREEN }}
            >
              {loading ? 'Processing…' : 'Withdraw'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-neutral-100" />
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function WalletPage() {
  const navigate = useNavigate()
  const [withdrawSession, setWithdrawSession] = useState<
    NonNullable<ReturnType<typeof useQuery<typeof api.payouts.listCompletedChopIn>>>[number] | null
  >(null)

  const completedChopIns = useQuery(api.payouts.listCompletedChopIn, {})
  const payouts          = useQuery(api.payouts.listPayouts, {})

  // Total wallet balance = sum of all processed payouts
  const totalPaidOut = payouts
    ? payouts.filter(p => p.status === 'processed').reduce((s, p) => s + p.amountKobo, 0)
    : 0

  const pendingPayout = completedChopIns
    ? completedChopIns.reduce((s, s2) => s + s2.payoutKobo, 0)
    : 0

  return (
    <div className="max-w-[680px] mx-auto">
      <Seo title="Wallet" path="/dashboard/wallet" noIndex />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Back"
          className="text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <RemixIcon name="ri-arrow-left-s-line" size={26} />
        </button>
        <div>
          <h1 className="text-[22px] font-extrabold text-neutral-900 leading-tight">Wallet</h1>
          <p className="text-[13px] text-neutral-400">Manage your Chop In withdrawals</p>
        </div>
      </div>

      {/* ── Balance cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl p-5" style={{ background: '#f0fdf4' }}>
          <p className="text-[12px] text-neutral-500 mb-1">Total paid out</p>
          <p className="text-[26px] font-extrabold leading-tight" style={{ color: '#16a34a' }}>
            {formatNaira(totalPaidOut)}
          </p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#ecfdf5' }}>
          <p className="text-[12px] text-neutral-500 mb-1">Pending withdrawal</p>
          <p className="text-[26px] font-extrabold leading-tight" style={{ color: CHOP_IN_GREEN }}>
            {formatNaira(pendingPayout)}
          </p>
        </div>
      </div>

      {/* ── Completed Chop In sessions ───────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-[15px] font-bold text-neutral-900 mb-3">Ready to withdraw</h2>

        {completedChopIns === undefined ? (
          <Skeleton />
        ) : completedChopIns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center">
            <RemixIcon name="ri-hand-coin-line" size={28} color="#d1d5db" />
            <p className="text-[13px] text-neutral-400 mt-2">
              No completed Chop In sessions yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {completedChopIns.map(session => (
              <motion.div
                key={session._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-neutral-200 rounded-2xl px-5 py-4 flex items-center gap-4"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: CHOP_IN_GREEN }}
                >
                  <RemixIcon name="ri-hand-coin-fill" size={18} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-neutral-900 truncate">{session.name}</p>
                  <p className="text-[12px] text-neutral-400 mt-0.5">
                    Collected {formatNaira(session.collectedKobo)}
                    {session.feeKobo > 0 && ` · fee ${formatNaira(session.feeKobo)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-[15px] font-extrabold" style={{ color: CHOP_IN_GREEN }}>
                    {formatNaira(session.payoutKobo)}
                  </p>
                  <button
                    onClick={() => setWithdrawSession(session)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-bold text-white transition-opacity hover:opacity-85"
                    style={{ background: CHOP_IN_GREEN }}
                  >
                    <RemixIcon name="ri-arrow-down-circle-line" size={13} color="#fff" />
                    Withdraw
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transaction history ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-[15px] font-bold text-neutral-900 mb-3">Transaction history</h2>

        {payouts === undefined ? (
          <Skeleton />
        ) : payouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center">
            <p className="text-[13px] text-neutral-400">No transactions yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {payouts.map(payout => (
              <div
                key={payout._id}
                className="border border-neutral-100 rounded-2xl px-5 py-3.5 flex items-center gap-4"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#dcfce7' }}
                >
                  <RemixIcon name="ri-arrow-up-circle-fill" size={18} color="#16a34a" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-900 truncate">
                    Payout · {payout.bankName}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {payout.accountNumber} · {payout.recipientName}
                  </p>
                  <p className="text-[11px] text-neutral-300 mt-0.5">{formatDate(payout._creationTime)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-extrabold" style={{ color: '#16a34a' }}>
                    +{formatNaira(payout.amountKobo)}
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#dcfce7', color: '#166534' }}>
                    {payout.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw modal */}
      <AnimatePresence>
        {withdrawSession && (
          <WithdrawModal
            session={withdrawSession}
            onClose={() => setWithdrawSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
