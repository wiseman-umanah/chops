import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FadeUp from '@/components/FadeUp'
import RemixIcon from '../RemixIcon';

const FAQS = [
  {
    q: 'Do my friends need to install an app or create an account?',
    a: 'No. Participants only need the shared link. They open it in any mobile or desktop browser, pick their share, and pay — no app download, no sign-up required.',
  },
  {
    q: 'How do I share my Chop session on WhatsApp?',
    a: 'After creating a session, tap "Copy link" and paste it into any WhatsApp chat or group. The link generates a rich preview card so your group sees the session name and total at a glance.',
  },
  {
    q: 'How fast are payments processed and confirmed?',
    a: "Payments are confirmed in real-time. The moment a participant pays, their status flips from red to green instantly — no page refresh needed.",
  },
  {
    q: 'Are there fees for creating or paying a session?',
    a: 'Creating a Chop session is free. A small processing fee may apply on individual payments depending on the payment method used.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      layout
      className="border border-black bg-white overflow-hidden py-5 px-5 sm:py-8 sm:px-10"
      style={{ borderRadius: open ? 24 : 9999 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        className="w-full flex items-center justify-between text-left gap-4"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="text-[clamp(13px,3.5vw,15px)] font-medium text-neutral-900">{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-neutral-500 text-[20px] leading-none select-none"
        >
          <RemixIcon name='ri-add-line' />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pt-4 text-[14px] text-neutral-500 leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FaqSection() {
  return (
    <section id="faqs" className="py-20 md:py-28 px-5 sm:px-10" style={{ background: '#f5f5f5' }}>
      <div className="max-w-[800px] mx-auto">
        <FadeUp>
          <h2 className="text-[32px] sm:text-[40px] md:text-[48px] font-creato font-extrabold text-neutral-900 tracking-tight mb-10">
            Questions, answered
          </h2>
        </FadeUp>

        <div className="flex flex-col gap-4">
          {FAQS.map((faq, i) => (
            <FadeUp key={i} delay={i * 0.06}>
              <FaqItem q={faq.q} a={faq.a} />
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
