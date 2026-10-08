import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import RemixIcon from '@/components/RemixIcon'

const BRAND = '#FF6900'

interface JoinSessionModalProps {
  onClose: () => void
}

export default function JoinSessionModal({ onClose }: JoinSessionModalProps) {
  const navigate = useNavigate()
  const [code, setCode]   = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleChange(raw: string) {
    // Strip everything except alphanumeric, work in uppercase
    const digits = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Always format as CH-XXXXXXXX
    // First 2 chars = "CH", next up to 8 = the identifier
    let formatted = ''
    if (digits.length <= 2) {
      formatted = digits
    } else {
      // Enforce leading "CH" prefix regardless of what user typed
      const prefix = digits.slice(0, 2)
      const rest   = digits.slice(2, 10) // max 8 chars after prefix
      formatted = prefix === 'CH' ? `CH-${rest}` : `CH-${digits.slice(0, 8)}`
    }

    setCode(formatted)
    setError(null)
  }

  function handleJoin() {
    const slug  = code.trim().toUpperCase()
    const valid = /^CH-[A-Z0-9]{8}$/.test(slug)

    if (!valid) {
      setError('Enter a valid 8-character session code — e.g. CH-AB12CD34')
      return
    }

    onClose()
    navigate(`/s/${slug}`)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="bg-white rounded-3xl w-full max-w-[400px] p-7 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[17px] font-extrabold text-neutral-900">Join a Session</h3>
            <p className="text-[13px] text-neutral-400 mt-0.5">Enter the session code shared with you</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
          >
            <RemixIcon name="ri-close-line" size={18} color="#6b7280" />
          </button>
        </div>

        {/* Input */}
        <label className="text-[12px] font-semibold text-neutral-500 mb-1.5 block">
          Session code
        </label>
        <input
          autoFocus
          type="text"
          value={code}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="CH-AB12CD34"
          maxLength={11}
          spellCheck={false}
          autoComplete="off"
          className="w-full border border-neutral-200 rounded-full px-4 py-3 text-[15px] font-mono text-neutral-800 placeholder:text-neutral-300 outline-none focus:border-[#FF6900] transition-colors bg-white text-center uppercase"
          style={{ letterSpacing: '0.12em' }}
        />

        {error && (
          <p className="mt-2 text-[12px] font-medium text-red-500 text-center">{error}</p>
        )}

        <p className="mt-2 text-[11px] text-neutral-400 text-center">
          The session code looks like <span className="font-mono font-semibold">CH-XXXXXXXX</span>
        </p>

        <button
          onClick={handleJoin}
          disabled={!code.trim()}
          className="mt-5 w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: BRAND }}
        >
          Go to Session →
        </button>
      </motion.div>
    </div>
  )
}
