import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation } from 'convex/react'
import { useAuth } from '@/contexts/AuthContext'
import RemixIcon from '@/components/RemixIcon'
import { api } from '../../../../convex/_generated/api'

const BRAND = '#FF6900'
const CROP_SIZE = 280

const PW_RULES = [
  { key: 'length',  label: '8+ characters',        test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { key: 'symbol',  label: 'One symbol (!@#$…)',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

// ─── Circle Crop Modal ────────────────────────────────────────────────────────

interface CropModalProps {
  src: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const [scale, setScale]   = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging  = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })
  const imgRef    = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Natural image size
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    imgRef.current = img
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    // Initial scale: fit the shorter side to CROP_SIZE
    const fit = CROP_SIZE / Math.min(img.naturalWidth, img.naturalHeight)
    setScale(fit)
  }

  // Drag handlers
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    setOffset(o => ({ x: o.x + e.clientX - lastPos.current.x, y: o.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  function onMouseUp() { dragging.current = false }

  // Touch handlers
  function onTouchStart(e: React.TouchEvent) {
    dragging.current = true
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return
    setOffset(o => ({
      x: o.x + e.touches[0].clientX - lastPos.current.x,
      y: o.y + e.touches[0].clientY - lastPos.current.y,
    }))
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd() { dragging.current = false }

  function handleConfirm() {
    const canvas = document.createElement('canvas')
    canvas.width  = CROP_SIZE
    canvas.height = CROP_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    const img = imgRef.current!
    const drawW = naturalSize.w * scale
    const drawH = naturalSize.h * scale
    const x = (CROP_SIZE - drawW) / 2 + offset.x
    const y = (CROP_SIZE - drawH) / 2 + offset.y
    ctx.drawImage(img, x, y, drawW, drawH)
    canvas.toBlob(blob => {
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center gap-5">
        <h3 className="text-[16px] font-bold text-neutral-900">Crop your photo</h3>

        {/* Circular viewport */}
        <div
          ref={containerRef}
          className="relative select-none"
          style={{
            width: CROP_SIZE, height: CROP_SIZE,
            borderRadius: '50%',
            overflow: 'hidden',
            cursor: 'grab',
            background: '#f3f4f6',
            border: `3px solid ${BRAND}`,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {naturalSize.w > 0 && (
            <img
              src={src}
              alt="crop preview"
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                width:  naturalSize.w * scale,
                height: naturalSize.h * scale,
                left: (CROP_SIZE - naturalSize.w * scale) / 2 + offset.x,
                top:  (CROP_SIZE - naturalSize.h * scale) / 2 + offset.y,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Load trigger (hidden but needed for onLoad) */}
          {naturalSize.w === 0 && (
            <img src={src} alt="" onLoad={onImgLoad} className="opacity-0 absolute" />
          )}
        </div>

        {/* Zoom slider */}
        <div className="w-full flex items-center gap-3">
          <RemixIcon name="ri-zoom-out-line" size={16} color="#9ca3af" />
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.01}
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="flex-1 accent-[#FF6900]"
          />
          <RemixIcon name="ri-zoom-in-line" size={16} color="#9ca3af" />
        </div>

        <p className="text-[12px] text-neutral-400 -mt-2">Drag to reposition • Scroll to zoom</p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-full border border-neutral-200 text-[14px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: BRAND }}
          >
            Use this photo
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user }        = useAuth()
  const { signIn }      = useAuthActions()
  const navigate        = useNavigate()
  const generateUploadUrl = useMutation(api.users.generateUploadUrl)
  const updateProfile     = useMutation(api.users.updateProfile)

  // ── Profile picture state ──
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const [cropSrc,       setCropSrc]       = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [avatarSuccess, setAvatarSuccess] = useState(false)
  const [avatarError,   setAvatarError]   = useState('')

  // ── Name state ──
  const [firstName,     setFirstName]     = useState(user?.firstName ?? '')
  const [lastName,      setLastName]      = useState(user?.lastName ?? '')
  const [nameSaving,    setNameSaving]    = useState(false)
  const [nameSuccess,   setNameSuccess]   = useState(false)
  const [nameError,     setNameError]     = useState('')

  // Sync name fields when user loads
  useEffect(() => {
    if (user) {
      setFirstName(prev => prev || user.firstName)
      setLastName(prev  => prev || (user.lastName ?? ''))
    }
  }, [user?.firstName, user?.lastName])

  // ── Password state ──
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showCur,    setShowCur]    = useState(false)
  const [showNew,    setShowNew]    = useState(false)
  const [pwLoading,  setPwLoading]  = useState(false)
  const [pwError,    setPwError]    = useState('')
  const [pwSuccess,  setPwSuccess]  = useState(false)

  const pwOk      = PW_RULES.every(r => r.test(newPw))
  const match     = newPw === confirmPw
  const canSubmit = currentPw && pwOk && match

  // ── Avatar: file picked → open crop modal ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    e.target.value = ''
  }

  // ── Avatar: crop confirmed → upload ──
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropSrc(null)
    setAvatarError('')
    setAvatarSuccess(false)
    setUploading(true)
    const preview = URL.createObjectURL(blob)
    setAvatarPreview(preview)
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { storageId } = await res.json() as { storageId: string }
      await updateProfile({ imageStorageId: storageId })
      setAvatarSuccess(true)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
      setAvatarPreview(null)
    } finally {
      setUploading(false)
    }
  }, [generateUploadUrl, updateProfile])

  // ── Name: save ──
  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return
    setNameError('')
    setNameSuccess(false)
    setNameSaving(true)
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() || undefined })
      setNameSuccess(true)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save name')
    } finally {
      setNameSaving(false)
    }
  }

  // ── Password: change ──
  async function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !user?.email) return
    setPwError('')
    setPwLoading(true)
    try {
      await signIn('password', { email: user.email, password: currentPw, flow: 'signIn' })
      await signIn('password', { email: user.email, password: newPw,     flow: 'signUp'  })
      setPwSuccess(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('exists') || msg.toLowerCase().includes('already')) {
        setPwSuccess(true)
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect')) {
        setPwError('Current password is incorrect.')
      } else {
        setPwError(msg || 'Could not update password. Please try again.')
      }
    } finally {
      setPwLoading(false)
    }
  }

  const displayImageUrl = avatarPreview ?? user?.imageUrl ?? null
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  return (
    <>
      {/* Circle crop modal */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => { setCropSrc(null); URL.revokeObjectURL(cropSrc) }}
        />
      )}

      <div className="max-w-[520px] mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Back"
            className="text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <RemixIcon name="ri-arrow-left-s-line" size={26} />
          </button>
          <div>
            <h1 className="text-[22px] font-extrabold text-neutral-900 leading-tight">Settings</h1>
            <p className="text-[13px] text-neutral-400">Manage your account</p>
          </div>
        </div>

        {/* ── Section 1: Profile picture ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-neutral-200 rounded-2xl p-6 mb-5"
        >
          <h2 className="text-[16px] font-bold text-neutral-900 mb-1">Profile photo</h2>
          <p className="text-[13px] text-neutral-400 mb-5">This photo appears on your profile and receipts.</p>

          <div className="flex items-center gap-5">
            {/* Avatar preview */}
            <div
              className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2"
              style={{ borderColor: BRAND }}
            >
              {displayImageUrl ? (
                <img src={displayImageUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-[22px] font-bold text-white"
                  style={{ background: BRAND }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-5 py-2.5 rounded-full border border-[#FF6900] text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ color: BRAND }}
              >
                {uploading ? 'Uploading…' : 'Change photo'}
              </button>
              {avatarSuccess && !uploading && (
                <p className="text-[12px] text-green-600 flex items-center gap-1">
                  <RemixIcon name="ri-checkbox-circle-fill" size={13} color="#16a34a" /> Photo updated
                </p>
              )}
              {avatarError && (
                <p className="text-[12px] text-red-400">{avatarError}</p>
              )}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </motion.div>

        {/* ── Section 2: Name ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="border border-neutral-200 rounded-2xl p-6 mb-5"
        >
          <h2 className="text-[16px] font-bold text-neutral-900 mb-1">Your name</h2>
          <p className="text-[13px] text-neutral-400 mb-5">This is how you appear to other participants.</p>

          <form onSubmit={handleNameSave} className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-800">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setNameSuccess(false) }}
                  required
                  placeholder="First name"
                  className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-[#FF6900] transition-colors"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-800">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); setNameSuccess(false) }}
                  placeholder="Last name"
                  className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-[#FF6900] transition-colors"
                />
              </div>
            </div>

            {nameError   && <p className="text-[13px] text-red-500 px-1">{nameError}</p>}
            {nameSuccess && (
              <p className="text-[13px] text-green-600 flex items-center gap-1.5 px-1">
                <RemixIcon name="ri-checkbox-circle-fill" size={14} color="#16a34a" /> Name saved!
              </p>
            )}

            <button
              type="submit"
              disabled={nameSaving || !firstName.trim()}
              className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: BRAND }}
            >
              {nameSaving ? 'Saving…' : 'Save name'}
            </button>
          </form>
        </motion.div>

        {/* ── Section 3: Change password ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="border border-neutral-200 rounded-2xl p-6"
        >
          <h2 className="text-[16px] font-bold text-neutral-900 mb-1">Change password</h2>
          <p className="text-[13px] text-neutral-400 mb-6">
            Enter your current password, then choose a new one.
          </p>

          {pwSuccess ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#dcfce7' }}>
                <RemixIcon name="ri-checkbox-circle-fill" size={26} color="#16a34a" />
              </div>
              <p className="text-[16px] font-bold text-neutral-900 mb-1">Password updated!</p>
              <p className="text-[13px] text-neutral-500">Your password has been changed successfully.</p>
            </div>
          ) : (
            <form onSubmit={handlePwSubmit} className="flex flex-col gap-4">

              {/* Current password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-800">Current password</label>
                <div className="relative">
                  <input
                    type={showCur ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    required
                    className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-[#FF6900] transition-colors pr-12"
                  />
                  <button type="button" onClick={() => setShowCur(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                    <i className={`ri-${showCur ? 'eye-off' : 'eye'}-line text-[18px]`} />
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-800">New password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required
                    className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none focus:border-[#FF6900] transition-colors pr-12"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                    <i className={`ri-${showNew ? 'eye-off' : 'eye'}-line text-[18px]`} />
                  </button>
                </div>
                {newPw && (
                  <ul className="flex flex-col gap-1 pt-0.5">
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

              {/* Confirm new password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-800">Confirm new password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none transition-colors"
                  style={{ borderColor: confirmPw && !match ? '#f87171' : '' }}
                />
                {confirmPw && !match && (
                  <p className="text-[12px] text-red-400 px-1">Passwords don't match</p>
                )}
              </div>

              {pwError && <p className="text-[13px] text-red-500 px-1">{pwError}</p>}

              <button
                type="submit"
                disabled={pwLoading || !canSubmit}
                className="w-full py-3.5 rounded-full text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 mt-2"
                style={{ background: BRAND }}
              >
                {pwLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </>
  )
}
