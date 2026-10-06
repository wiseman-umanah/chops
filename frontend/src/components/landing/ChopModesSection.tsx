import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RemixIcon from '@/components/RemixIcon'
import FadeUp from '@/components/FadeUp'
import phoneFrame   from '../../../asset/images/phone.png'
import phoneContent from '../../../asset/images/phone-content.png'

const BRAND = '#FF6900'

const MODES = [
  {
    id: 'food',
    label: 'Chop Food',
    icon: 'ri-restaurant-2-fill',
    title: 'Chop Food',
    body: 'Group meal orders where everyone selects what they ate and pays their exact dish breakdown.',
    bestFor: 'Best for: office lunches, suya nights, birthday dinners.',
  },
  {
    id: 'chop-in',
    label: 'Chop In',
    icon: 'ri-hand-coin-fill',
    title: 'Chop In',
    body: 'Group fund pooling for birthday gifts, trips, party contributions, and target goals.',
    bestFor: 'Best for: gifts, trips, owambe contributions.',
  },
  {
    id: 'bill',
    label: 'Chop Bill',
    icon: 'ri-coupon-5-fill',
    title: 'Chop Bill',
    body: 'Automated expense splitting for household utilities, group dinners, rent, or ride shares. Split equally or by custom percentage.',
    bestFor: 'Best for: rent, electricity, shared rides.',
  },
]

const FEATURES = [
  { icon: 'ri-global-line',      iconBg: '#DBEAFE', iconColor: '#2B7FFF', title: 'Zero App Install',          body: 'Runs in any web browser on desktop or mobile.', back: '#EFF6FF' },
  { icon: 'ri-whatsapp-line',     iconBg: '#DCFCE7', iconColor: '#00A63E', title: 'WhatsApp Link Friendly',    body: 'Optimised preview cards when shared inside WhatsApp chats.', back: '#F0FDF4' },
  { icon: 'ri-bar-chart-grouped-line',    iconBg: '#FFEDD4', iconColor: '#FF6900', title: 'Real-time Status Tracking', body: 'Instant colour-coded indicators show who has paid (green) and who still owes (red).', back: '#FFF7ED' },
  { icon: 'ri-secure-payment-line', iconBg: '#FFE2E2', iconColor: '#FB2C36', title: 'Instant Settlement',        body: 'Frictionless payment processing for instant settlements.', back: '#FEF2F2' },
]

export default function ChopModesSection() {
  const [activeId, setActiveId] = useState('food')
  const active = MODES.find(m => m.id === activeId)!

  return (
    <>
      {/* ── Full-width dark green section ── */}
      <section
        id="chop-modes"
        className="relative overflow-hidden px-10"
        style={{ background: '#016630' }}
      >
        {/* SVG swoosh — bottom-left, behind content */}
        <svg
          aria-hidden="true"
          className="absolute -bottom-60 left-0 right-0 pointer-events-none select-none"
          style={{ zIndex: 0, width: '100%', minWidth: 480 }}
          viewBox="0 0 1435 420" preserveAspectRatio="xMinYMax meet" fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-340 423.5C-277.742 378.773 -107.268 265.486 76.5687 170.157C260.406 74.8276 191.635 189.516 134.271 258.777C225.886 205.204 428.248 99.9617 504.779 107.572C581.31 115.182 464.118 201.533 395.955 243.757C529.918 172.493 795.278 32.5425 813.5 75C831.722 117.458 754.315 207.875 709.773 243.757C793.796 180.671 1032.81 44.5 1089.5 44.5C1146.19 44.5 1053.07 195.691 1006.5 258.777C1042.27 195.691 1285.44 75 1372.5 75C1459.56 75 1191.97 280.139 1143.55 392.959"
            stroke="#00A63E" strokeWidth="89"
          />
        </svg>

        {/* Content grid */}
        <div
          className="relative max-w-[95%] mx-auto grid grid-cols-[3fr_2fr] md:grid-cols-2 pt-14 md:pt-20"
          style={{ zIndex: 1 }}
        >
          {/* ── Left ── */}
          <div className="pb-14 md:pb-20 flex flex-col gap-6 max-w-[520px]">
            {/* Heading */}
            <FadeUp>
              <h2 className="text-[32px] sm:text-[42px] md:text-[52px] font-creato font-extrabold text-white leading-tight tracking-tight">
                Pick the Chop that<br />fits the moment
              </h2>
            </FadeUp>

            {/* Mode tabs */}
            <FadeUp delay={0.08}>
              <div className="flex gap-2 flex-wrap mb-12">
                {MODES.map(m => {
                  const isActive = m.id === activeId
                  return (
                    <button
                      key={m.id}
                      onClick={() => setActiveId(m.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all"
                      style={
                        isActive
                          ? { background: BRAND, color: '#fff', border: `1.5px solid ${BRAND}` }
                          : { background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)' }
                      }
                    >
                      <RemixIcon name={m.icon} size={14} color={isActive ? '#fff' : 'rgba(255,255,255,0.8)'} />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </FadeUp>

            {/* Mode description card */}
            <FadeUp delay={0.14}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl p-6"
                  style={{ border: '1.5px solid #7BF1A8' }}
                >
                  <p className="font-creato font-extrabold text-[20px] mb-3" style={{ color: '#7BF1A8' }}>
                    {active.title}
                  </p>
                  <p className="text-white text-[14px] leading-relaxed mb-3">{active.body}</p>
                  <p className="text-[13px]" style={{ color: '#7BF1A8' }}>{active.bestFor}</p>
                </motion.div>
              </AnimatePresence>
            </FadeUp>
          </div>

          {/* ── Right: phone, bottom-anchored, crops at bottom ── */}
          <FadeUp delay={0.1} className="flex justify-center md:justify-end items-end self-end">
            <div className="relative" style={{ width: 320, height: 560 }}>
              <img
                src={phoneContent}
                alt="Chop session screen"
                className="absolute object-contain -bottom-5"
                // style={{ top: '1.5%', left: '5.5%', right: '5.5%', bottom: '1%', borderRadius: '9.5%', zIndex: 1 }}
              />
              <img
                src={phoneFrame}
                alt=""
                aria-hidden="true"
                className="absolute object-contain bottom-0"
                style={{ zIndex: 2 }}
              />
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Feature grid — white bg below ── */}
      <section id='features' className="bg-white px-6 sm:px-12 py-14">
        <div className="max-w-[95%] mx-auto">
          <FadeUp>
            <h3 className="text-[22px] sm:text-[28px] font-creato font-extrabold text-neutral-900 mb-8">
              Built for the group chat
            </h3>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon, iconBg, iconColor, title, body, back }, i) => (
              <FadeUp key={title} delay={i * 0.08}>
                <div
                  className="flex items-start gap-4 rounded-2xl border border-neutral-100 p-5"
                  style={{ backgroundColor: back }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: iconBg }}
                  >
                    <RemixIcon name={icon} size={20} color={iconColor} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-neutral-900 mb-0.5">{title}</p>
                    <p className="text-[13px] text-neutral-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
