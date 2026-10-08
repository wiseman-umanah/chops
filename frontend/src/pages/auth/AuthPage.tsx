import { useState, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { useAuthActions } from '@convex-dev/auth/react'
import handLeft from '../../../asset/images/hand-left1.png'
import handRight from '../../../asset/images/hand-right.png'

const BRAND = '#FF6900'

// ── Password rule helpers ─────────────────────────────────────────────────────
const PW_RULES = [
  { key: 'length',  label: '8+ characters',          test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',    test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',    test: (p: string) => /[a-z]/.test(p) },
  { key: 'symbol',  label: 'One symbol (!@#$…)',      test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function pwStrength(p: string) {
  return PW_RULES.filter(r => r.test(p)).length
}

// ── Email validator ───────────────────────────────────────────────────────────
function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// ── Password strength checklist ───────────────────────────────────────────────
function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null
  return (
    <ul className="flex flex-col gap-1 pt-0.5">
      {PW_RULES.map(rule => {
        const pass = rule.test(password)
        return (
          <li key={rule.key} className="flex items-center gap-1.5 text-[12px]"
            style={{ color: pass ? '#16a34a' : '#9ca3af' }}>
            <span className="text-[11px]">{pass ? '✓' : '○'}</span>
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

// ── Branded scrollbar style injected once ────────────────────────────────────
const SCROLLBAR_CSS = `
.auth-scroll::-webkit-scrollbar { width: 4px; }
.auth-scroll::-webkit-scrollbar-track { background: transparent; }
.auth-scroll::-webkit-scrollbar-thumb { background: #FF690055; border-radius: 99px; }
.auth-scroll::-webkit-scrollbar-thumb:hover { background: #FF6900; }
.auth-scroll { scrollbar-width: thin; scrollbar-color: #FF690055 transparent; }
`

// ── Shared field ─────────────────────────────────────────────────────────────
function Field({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  suffix,
}: {
  label: string
  id: string
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  suffix?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-neutral-800">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-[#FF6900] transition-colors"
        />
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
            {suffix}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Google icon ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  )
}

// ── Or divider ────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-neutral-400">
      <div className="flex-1 h-px bg-neutral-200" />
      or
      <div className="flex-1 h-px bg-neutral-200" />
    </div>
  )
}

// ── Bottom actions ────────────────────────────────────────────────────────────
function BottomActions({
  loading,
  disabled,
  label,
  onGoogle,
}: {
  loading: boolean
  disabled?: boolean
  label: string
  onGoogle: () => void
}) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <button
        type="submit"
        disabled={loading || disabled}
        className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: BRAND }}
      >
        {loading ? 'Please wait…' : label}
      </button>
      <OrDivider />
      <button
        type="button"
        onClick={onGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-full border border-neutral-200 text-[14px] font-medium text-neutral-800 hover:bg-neutral-50 transition-colors disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </div>
  )
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm() {
  const { signIn } = useAuthActions()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn('password', { email, password, flow: 'signIn' })
    } catch (err) {
      console.error('Login error:', err)
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signIn('google', { redirectTo: window.location.origin + '/dashboard' })
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        label="Email"
        id="login-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={setEmail}
        required
      />
      <div className="flex flex-col gap-1">
        <Field
          label="Password"
          id="login-password"
          type={showPw ? 'text' : 'password'}
          placeholder="••••••"
          value={password}
          onChange={setPassword}
          required
          suffix={
            <button type="button" onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}>
              <i className={`ri-${showPw ? 'eye-off' : 'eye'}-line text-[18px]`} />
            </button>
          }
        />
        <div className="flex justify-end pr-1 pt-0.5">
          <Link to="/forgot-password" className="text-[12px] text-neutral-400 hover:text-[#FF6900] transition-colors">
            Forgot password?
          </Link>
        </div>
      </div>
      {error && <p className="text-[13px] text-red-500">{error}</p>}
      <BottomActions loading={loading} label="Enter Chop" onGoogle={handleGoogle} />
    </form>
  )
}

// ── Signup form ───────────────────────────────────────────────────────────────
function SignupForm() {
  const { signIn } = useAuthActions()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [agreed, setAgreed]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const emailValid = isValidEmail(email)
  const pwPassed   = useMemo(() => pwStrength(password) === PW_RULES.length, [password])
  const canSubmit  = firstName.trim().length > 0 && emailValid && pwPassed && agreed

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      await signIn('password', {
        email,
        password,
        flow: 'signUp',
        firstName,
        lastName: lastName.trim() || '',
        phone: phone || '',
      })
    } catch (err) {
      console.error('Signup error:', err)
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already exists') || msg.includes('exists')) {
        setError('An account with this email already exists. Try logging in.')
      } else {
        setError(msg || 'Something went wrong. Please try again.')
      }
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signIn('google', { redirectTo: window.location.origin + '/dashboard' })
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" id="signup-fname" placeholder="Jane"
          value={firstName} onChange={setFirstName} required />
        <Field label="Last Name" id="signup-lname" placeholder="Doe (optional)"
          value={lastName} onChange={setLastName} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" id="signup-phone" type="tel"
          placeholder="+234 812 345 6789" value={phone} onChange={setPhone} />
        <div className="flex flex-col gap-1.5">
          <Field label="Email" id="signup-email" type="email"
            placeholder="you@example.com" value={email} onChange={setEmail} required />
          {email && !emailValid && (
            <p className="text-[11px] text-red-400 pl-1">Enter a valid email address</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Field
          label="Password"
          id="signup-password"
          type={showPw ? 'text' : 'password'}
          placeholder="••••••"
          value={password}
          onChange={setPassword}
          required
          suffix={
            <button type="button" onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}>
              <i className={`ri-${showPw ? 'eye-off' : 'eye'}-line text-[18px]`} />
            </button>
          }
        />
        <PasswordChecklist password={password} />
      </div>

      {/* Terms & privacy checkbox */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5 shrink-0 accent-[#FF6900]"
        />
        <span className="text-[12px] text-neutral-500 leading-relaxed">
          I agree to Chop's{' '}
          <Link to="/terms" target="_blank" className="underline text-neutral-700 hover:text-[#FF6900]">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" target="_blank" className="underline text-neutral-700 hover:text-[#FF6900]">Privacy Policy</Link>
        </span>
      </label>

      {error && <p className="text-[13px] text-red-500">{error}</p>}
      <BottomActions loading={loading} disabled={!canSubmit} label="Enter Chop" onGoogle={handleGoogle} />
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const tab: 'login' | 'signup' =
    pathname === '/signup' ? 'signup' : 'login'

  function setTab(t: 'login' | 'signup') {
    navigate(t === 'login' ? '/login' : '/signup', { replace: true })
  }

  return (
    <>
      <style>{SCROLLBAR_CSS}</style>
      <div className="relative h-screen overflow-hidden" style={{ background: '#009933' }}>

        <img src={handRight} alt="" aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{ top: 0, right: 0, width: 'clamp(220px, 30vw, 520px)', objectFit: 'contain', objectPosition: 'top right' }}
        />
        <img src={handLeft} alt="" aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{ top: 0, right: '20vw', width: 'clamp(240px, 38vw, 500px)', objectFit: 'contain', objectPosition: 'bottom right' }}
        />

        <div className="relative z-10 flex h-full">
          <div className="flex items-center justify-center w-full md:w-[52%] p-5 sm:p-8 shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-3xl w-full max-w-[500px] shadow-xl overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 40px)' }}
            >
              {/* Logo + title + tabs */}
              <div className="px-8 sm:px-10 pt-8 sm:pt-10 pb-5">
                <Link to="/" className="inline-flex items-center gap-2 mb-7">
                  <Logo width={32} height={32} />
                  <span style={{ fontSize: 20, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
                    Chop
                  </span>
                </Link>

                <h1 className="text-[24px] sm:text-[28px] font-extrabold text-neutral-900 leading-tight mb-1">
                  Welcome to Chop
                </h1>
                <p className="text-[13px] text-neutral-400 mb-6">
                  Split bills and pool funds with a link.
                </p>

                {/* Tab switcher */}
                <div className="flex p-1 rounded-full border" style={{ borderColor: BRAND }}>
                  {(['login', 'signup'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className="flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200"
                      style={tab === t ? { background: BRAND, color: '#fff' } : { color: '#a3a3a3' }}
                    >
                      {t === 'login' ? 'LogIn' : 'Create Account'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form region */}
              <div className="px-8 sm:px-10 pb-8 sm:pb-10">
                {tab === 'login' ? <LoginForm /> : <SignupForm />}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}
