import { Seo } from '@/hooks/useSeo'
import HowItWorksStack from '@/components/howItWorks/HowItWorksStack'
import ChopModesSection from '@/components/landing/ChopModesSection'
import FaqSection from '@/components/landing/FaqSection'
import avatar1 from '../../asset/images/avatar1.png'
import avatar2 from '../../asset/images/avatar2.png'
import avatar3 from '../../asset/images/avatar3.png'
import handLeft  from '../../asset/images/hand-left.png'
import handRight from '../../asset/images/hand-right.png'
import s2Layer1  from '../../asset/images/s2-layer1.png'
import s2Layer2  from '../../asset/images/s2-layer2.png'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import FadeUp from '@/components/FadeUp'

/* ── Brand ───────────────────────────────────────────────────────────── */
const BRAND    = '#FF6900'

/* ── Avatars (social proof stack) ───────────────────────────────────── */
const AVATARS = [avatar1, avatar2, avatar3]

export default function LandingPage() {
  return (
    <>
      <Seo path="/" />
      <section id="product" className="max-w-[95%] min-h-screen mx-auto px-4 sm:px-10 flex flex-col justify-center md:justify-between gap-10 md:grid md:grid-rows-[1fr_120px]">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] items-center gap-10">
          <div className='pt-5 sm:pt-24'>
            {/* Social proof pill */}
            <motion.div
              className="flex items-center gap-2 flex-wrap"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex -space-x-3.5 shrink-0">
                {AVATARS.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="user avatar"
                    className="w-[36px] h-[36px] rounded-full border-2 border-white object-cover"
                    style={{ zIndex: AVATARS.length - i }}
                  />
                ))}
              </div>
              <span className="text-[13px] sm:text-[16px] text-[#B2B2B2] font-bold">
                Works with any group chat. Friends only need the link.
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[1.07] tracking-tight text-neutral-900"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              Split{' '}
              <span style={{ color: BRAND }}>Bills</span>{' '}& Pool<br />Funds in Seconds.<br />
              Just Send a Link.
            </motion.h1>
              <motion.p
              className='text-[17px] sm:text-[20px] text-[#B2B2B2] font-bold my-4'
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                No app downloads. No awkward money talk. Create a Chop session, <br /> share the web link on WhatsApp, and let everyone settle their share <br />directly.
              </motion.p>
            {/* CTAs */}
            <motion.div
              className="flex items-center gap-2 sm:gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2.5 sm:px-6 sm:py-3 rounded-full text-[12px] sm:text-[14px] font-bold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ background: BRAND }}
              >
                Start a Chop Session
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center px-4 py-2.5 sm:px-5 sm:py-3 rounded-full text-[12px] sm:text-[13px] font-bold transition-colors hover:bg-neutral-50 whitespace-nowrap"
                style={{ border: `1.5px solid ${BRAND}`, color: BRAND }}
              >
                See how it Works
              </a>
            </motion.div>
          </div>

          {/* ── Right: hero image ── */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="/hero.png"
              alt="Chop dashboard preview"
              className="w-[100%] max-w-none object-contain"
            />
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="relative overflow-hidden">
        <img
          src={s2Layer2}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
          style={{ zIndex: 0 }}
        />
        <img
          src={s2Layer1}
          aria-hidden="true"
          className="absolute inset-0 top-3 w-full h-full object-cover object-top pointer-events-none select-none"
          style={{ zIndex: 1 }}
        />

        {/* ── Content layer ── */}
        <div className="relative py-40" style={{ zIndex: 2 }}>

          {/* ── Header ── */}
          <FadeUp className="max-w-[500px] mx-auto text-center mb-14 px-5 sm:px-10">
            <h2 className="text-[28px] font-creato sm:text-[36px] md:text-[44px] font-extrabold text-neutral-900 leading-tight tracking-tight">
              From "who's paying?" to paid in three steps
            </h2>
          </FadeUp>

          {/* ── Cards centred, hands absolutely flanking ── */}
          <div className="relative">

            {/* Hand left — slides in from the left */}
            <motion.div
              className="absolute bottom-0 left-0 pointer-events-none select-none"
              style={{ zIndex: 3 }}
              initial={{ opacity: 0, x: -180 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={handLeft}
                alt=""
                aria-hidden="true"
                className="w-[260px] lg:w-[320px] xl:w-[380px] object-contain"
              />
            </motion.div>

            {/* Hand right — slides in from the right */}
            <motion.div
              className="absolute bottom-0 right-0 pointer-events-none select-none"
              style={{ zIndex: 3 }}
              initial={{ opacity: 0, x: 180 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={handRight}
                alt=""
                aria-hidden="true"
                className="w-[260px] lg:w-[320px] xl:w-[380px] object-contain"
              />
            </motion.div>

            {/* Step cards — fade + scale in */}
            <motion.div
              className="relative py-10 pb-16"
              style={{ zIndex: 4 }}
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <HowItWorksStack />
            </motion.div>

          </div>
        </div>
      </section>

      <ChopModesSection />
      <FaqSection />
    </>
  )
}
