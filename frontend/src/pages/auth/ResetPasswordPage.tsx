import { useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Seo } from '@/hooks/useSeo'
import { motion } from 'framer-motion'
import { useAuthActions } from '@convex-dev/auth/react'
import Logo from '@/components/Logo'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

const PW_RULES = [
  { key: 'length',  label: '8+ characters',        test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { key: 'symbol',  label: 'One symbol (!@#$…)',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

// 6 separate OTP digit boxes
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').split('').slice(0, 6)

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = digits.map((c, idx) => idx === i ? d : c).join('').replace(/ /g, '')
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

export default function ResetPasswordPage() {
  const { signIn } = useAuthActions()
  const navigate   = useNavigate()
  const location   = useLocation()

  // Email is passed from ForgotPasswordPage via navigation state
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? ''

  const [email,    setEmail]    = useState(prefillEmail)
  const [code,     setCode]     = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  const pwOk = PW_RULES.every(r => r.test(newPw))
  const canSubmit = code.length === 6 && email && pwOk

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      await signIn('password', {
        flow: 'reset-verification',
        email,
        code,
        newPassword: newPw,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="Reset Password" description="Enter your OTP code and set a new Chop account password." path="/reset-password" noIndex />
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
          /* ── Success ─────────────────────────────────────────────── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: '#dcfce7' }}>
              <RemixIcon name="ri-checkbox-circle-fill" size={28} color="#16a34a" />
            </div>
            <h1 className="text-[24px] font-extrabold text-neutral-900 mb-2">Password reset!</h1>
            <p className="text-[14px] text-neutral-500 mb-6">
              Your password has been updated. You're now signed in.
            </p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          /* ── Reset form ──────────────────────────────────────────── */
          <>
            <h1 className="text-[28px] font-extrabold text-neutral-900 mb-1">Set new password</h1>
            <p className="text-[14px] text-neutral-400 mb-8">
              Enter the code we sent to your email and choose a new password.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email — editable in case user navigated here directly */}
              {!prefillEmail && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-semibold text-neutral-800">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-[#FF6900] transition-colors"
                  />
                </div>
              )}

              {/* 6-digit OTP */}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-neutral-800">Reset code</label>
                <OTPInput value={code} onChange={setCode} />
              </div>

              {/* New password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-800">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required
                    className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-[#FF6900] transition-colors pr-12"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                    <i className={`ri-${showPw ? 'eye-off' : 'eye'}-line text-[18px]`} />
                  </button>
                </div>
                {/* Password rules */}
                {newPw && (
                  <ul className="flex flex-col gap-1 pt-1">
                    {PW_RULES.map(rule => (
                      <li key={rule.key}
                        className="flex items-center gap-1.5 text-[12px]"
                        style={{ color: rule.test(newPw) ? '#16a34a' : '#9ca3af' }}>
                        <span className="text-[11px]">{rule.test(newPw) ? '✓' : '○'}</span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && <p className="text-[13px] text-red-500 px-1">{error}</p>}

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: BRAND }}
              >
                {loading ? 'Updating…' : 'Reset password'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-[13px] text-neutral-400 mt-8">
          <Link to="/forgot-password" className="text-neutral-600 hover:text-[#FF6900] transition-colors">
            ← Back
          </Link>
        </p>
      </motion.div>
      </div>
    </>
  )
}
