import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Seo } from '@/hooks/useSeo'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import Logo from '@/components/Logo'
import { Link } from 'react-router-dom'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

// ── 6-digit OTP input ─────────────────────────────────────────────────────────
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').split('').slice(0, 6)

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = digits.map((c, idx) => (idx === i ? d : c)).join('').replace(/ /g, '')
    onChange(next)
    if (d && i < 5) inputs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i]?.trim() && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-between" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-12 h-14 text-center text-[22px] font-bold border rounded-2xl outline-none transition-colors"
          style={{ borderColor: d.trim() ? BRAND : '#e5e7eb', background: d.trim() ? '#fff7ed' : '#fff' }}
        />
      ))}
    </div>
  )
}

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const sendCode    = useMutation(api.emailVerification.sendVerificationCode)
  const verifyCode  = useMutation(api.emailVerification.verifyEmailCode)
  const status      = useQuery(api.emailVerification.getVerificationStatus)

  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)
  const [resent,  setResent]  = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Auto-send code on mount (first visit after signup)
  useEffect(() => {
    if (status === undefined) return // still loading
    if (status.verified) { navigate('/dashboard', { replace: true }); return }
    void triggerSend()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.verified])

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function triggerSend() {
    setSending(true)
    try {
      await sendCode()
      setCountdown(60)
    } catch {
      // non-fatal
    } finally {
      setSending(false)
    }
  }

  async function handleResend() {
    setError('')
    setResent(false)
    await triggerSend()
    setResent(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    setError('')
    setLoading(true)
    try {
      await verifyCode({ code })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect or expired code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="Verify your email" description="Confirm your Chop account email address." path="/verify-email" noIndex />
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <Logo width={32} height={32} />
            <span style={{ fontSize: 20, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
              Chop
            </span>
          </Link>

          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: '#dcfce7' }}>
                <RemixIcon name="ri-checkbox-circle-fill" size={28} color="#16a34a" />
              </div>
              <h1 className="text-[24px] font-extrabold text-neutral-900 mb-2">Email verified!</h1>
              <p className="text-[14px] text-neutral-500 mb-6">
                Your account is fully set up. Welcome to Chop.
              </p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full py-3.5 rounded-full text-[14px] font-bold text-white"
                style={{ background: BRAND }}
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-[28px] font-extrabold text-neutral-900 mb-1">Verify your email</h1>
              <p className="text-[14px] text-neutral-400 mb-2">
                We sent a 6-digit code to{' '}
                <strong className="text-neutral-700">{status?.email ?? 'your email'}</strong>.
              </p>
              {sending && (
                <p className="text-[13px] text-neutral-400 mb-6">Sending code…</p>
              )}
              {resent && !sending && (
                <p className="text-[13px] text-green-600 mb-6">New code sent ✓</p>
              )}
              {!sending && !resent && <div className="mb-6" />}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-semibold text-neutral-800">Verification code</label>
                  <OTPInput value={code} onChange={setCode} />
                </div>

                {error && <p className="text-[13px] text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: BRAND }}
                >
                  {loading ? 'Verifying…' : 'Verify email'}
                </button>
              </form>

              <p className="text-[13px] text-neutral-400 mt-5 text-center">
                Didn't receive it?{' '}
                {countdown > 0 ? (
                  <span className="text-neutral-400">Resend in {countdown}s</span>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={sending}
                    className="underline text-neutral-600 hover:text-[#FF6900] disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </p>

              <p className="text-center text-[13px] text-neutral-400 mt-4">
                <button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="text-neutral-400 hover:text-[#FF6900] transition-colors"
                >
                  Skip for now →
                </button>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </>
  )
}
