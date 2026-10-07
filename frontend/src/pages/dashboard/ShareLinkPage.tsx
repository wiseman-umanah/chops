import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import RemixIcon from '@/components/RemixIcon'
import { QRCodeSVG } from 'qrcode.react'

interface ShareState {
  slug: string
  title: string
  total: number
  mode: string
}

const WHATSAPP_GREEN = '#25D366'

export default function ShareLinkPage() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const state      = (location.state as ShareState | null)
  const slug       = state?.slug ?? 'dinner-party-99'
  const title      = state?.title || 'Dinner Party'
  const shareUrl   = `https://chop.app/s/${slug}`
  const waMessage  = `Hey guys! Settle your share for ${title} on Chop here: ${shareUrl}`

  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(waMessage)}`, '_blank')
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="flex flex-col gap-4">

        {/* ── Session created + share link ─────────────────────────────── */}
        <div className="border border-neutral-200 rounded-2xl p-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold mb-5"
            style={{ background: '#dcfce7', color: '#166534' }}>
            <RemixIcon name="ri-checkbox-circle-fill" />
            Session created
          </div>

          <h2 className="text-[20px] font-bold text-neutral-900 mb-5">Share your Chop link</h2>

          {/* URL + copy button */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border border-neutral-200 rounded-full px-4 py-2.5">
              <p className="text-[13px] text-neutral-400 truncate underline">{shareUrl}</p>
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] text-white transition-opacity hover:opacity-90"
              style={{ background: copied ? '#16a34a' : '#FF6900' }}
            >
              <RemixIcon name={copied ? 'ri-check-line' : 'ri-checkbox-multiple-blank-fill'} />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* WhatsApp button */}
          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[14px] text-white transition-opacity hover:opacity-90"
            style={{ background: WHATSAPP_GREEN }}
          >
            <RemixIcon name="ri-whatsapp-line" />
            Share directly on WhatsApp
          </button>
        </div>

        {/* ── WhatsApp preview ──────────────────────────────────────────── */}
        <div className="border border-neutral-200 rounded-2xl p-7">
          <p className="text-[13px] font-semibold text-neutral-600 mb-4">WhatsApp Preview</p>
          {/* Chat bubble preview */}
          <div className="rounded-xl p-4" style={{ background: '#e9e5c8' }}>
            <div className="ml-auto max-w-[80%] w-fit rounded-2xl rounded-br-sm px-4 py-3"
              style={{ background: WHATSAPP_GREEN }}>
              <p className="text-[13px] text-white leading-snug">
                Hey guys! Settle your share for {title} on Chop here:{' '}
                <a
                  href={shareUrl}
                  className="underline text-white/90"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shareUrl}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* ── QR code ──────────────────────────────────────────────────── */}
        <div className="border border-neutral-200 rounded-2xl p-7 flex items-center gap-5">
          <div className="shrink-0 rounded-xl overflow-hidden border border-neutral-100 p-2 bg-white">
            <QRCodeSVG
              value={shareUrl}
              size={80}
              bgColor="#ffffff"
              fgColor="#18181b"
              level="M"
            />
          </div>
          <div>
            <p className="text-[15px] font-bold text-neutral-900">Scan in person</p>
            <p className="text-[13px] text-neutral-400 mt-0.5">Friends beside you can scan this code to open the same link.</p>
          </div>
        </div>

        {/* ── Preview as a friend ───────────────────────────────────────── */}
        <button
          onClick={() => navigate(`/s/${slug}`)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-neutral-200 text-[14px] font-bold text-neutral-800 hover:bg-neutral-50 transition-colors"
        >
          Preview as a friend →
        </button>

      </div>
    </div>
  )
}

