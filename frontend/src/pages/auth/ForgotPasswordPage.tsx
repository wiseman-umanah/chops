import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthActions } from '@convex-dev/auth/react'
import Logo from '@/components/Logo'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

export default function ForgotPasswordPage() {
  const { signIn }   = useAuthActions()
  const navigate     = useNavigate()
  const [email,      setEmail]    = useState('')
  const [loading,    setLoading]  = useState(false)
  const [error,      setError]    = useState('')
  const [sent,       setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn('password', { email, flow: 'reset' })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px]"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Logo width={32} height={32} />
          <span style={{ fontSize: 20, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
            Chop
          </span>
        </Link>

        {sent ? (
          /* ── Success state ─────────────────────────────────────────── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: '#fff7ed' }}>
              <RemixIcon name="ri-mail-send-line" size={28} color={BRAND} />
            </div>
            <h1 className="text-[24px] font-extrabold text-neutral-900 mb-2">Check your email</h1>
            <p className="text-[14px] text-neutral-500 mb-6 leading-relaxed">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it on the next page to set your new password.
            </p>
            <button
              onClick={() => navigate('/reset-password', { state: { email } })}
              className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              Enter code
            </button>
            <p className="text-[13px] text-neutral-400 mt-4">
              Didn't receive it?{' '}
              <button onClick={() => setSent(false)} className="underline text-neutral-600 hover:text-[#FF6900]">
                Resend
              </button>
            </p>
          </div>
        ) : (
          /* ── Email form ────────────────────────────────────────────── */
          <>
            <h1 className="text-[28px] font-extrabold text-neutral-900 mb-1">Forgot password?</h1>
            <p className="text-[14px] text-neutral-400 mb-8">
              Enter your email and we'll send you a reset code.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fp-email" className="text-[13px] font-semibold text-neutral-800">
                  Email address
                </label>
                <input
                  id="fp-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FF6900] transition-colors"
                />
              </div>

              {error && (
                <p className="text-[13px] text-red-500 px-1">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: BRAND }}
              >
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-[13px] text-neutral-400 mt-8">
          <Link to="/login" className="text-neutral-600 hover:text-[#FF6900] transition-colors">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
