import { motion } from 'framer-motion'

const LAST_UPDATED = 'June 2025'
const SUPPORT_EMAIL = 'support@usechop.co'

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'When you create a Chop session, we collect your name and email address. Participants who pay via a shared link may have their name and payment reference recorded against the session. We do not collect card or bank account numbers directly.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to operate the Service, send session-related notifications, process payments via our payment partners, and improve the product. We do not sell your data to third parties.',
  },
  {
    title: '3. Payment Data',
    body: 'All payment processing is handled by regulated third-party processors. Chop receives only a payment confirmation reference — not your full card or bank details. Payment processors have their own privacy policies which apply to your payment data.',
  },
  {
    title: '4. Sharing Information',
    body: 'Session details (participant names, amounts, and statuses) are visible to anyone with the session link. Do not share session links publicly if you wish to restrict visibility. We may share data with law enforcement when legally required.',
  },
  {
    title: '5. Data Retention',
    body: 'Session data is retained for 12 months after the session closes, after which it is anonymised or deleted. You may request earlier deletion by contacting us.',
  },
  {
    title: '6. Cookies',
    body: 'We use minimal session cookies required to operate the Service. We do not use advertising or tracking cookies.',
  },
  {
    title: '8. Security',
    body: 'We use industry-standard encryption (TLS) for all data in transit and access controls for data at rest. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.',
  },
  {
    title: '9. Changes to This Policy',
    body: 'We may update this policy periodically. We will notify you of significant changes via email or a notice on the Service.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-[760px] mx-auto w-full px-5 sm:px-10 py-16 md:py-24">
      {/* Page header — slides down on mount */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="font-creato font-extrabold text-[36px] md:text-[48px] text-neutral-900 leading-tight mb-3">
          Privacy Policy
        </h1>
        <p className="text-[13px] text-neutral-400 mb-12">Last updated: {LAST_UPDATED}</p>
      </motion.div>

      {/* Sections — staggered fade-up */}
      <div>
        {SECTIONS.map(({ title, body }, i) => (
          <motion.div
            key={title}
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="font-creato font-bold text-[18px] text-neutral-900 mb-3">{title}</h2>
            <p className="text-[15px] text-neutral-600 leading-relaxed">{body}</p>
          </motion.div>
        ))}

        {/* Your rights section — has inline link */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: SECTIONS.length * 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-creato font-bold text-[18px] text-neutral-900 mb-3">7. Your Rights</h2>
          <p className="text-[15px] text-neutral-600 leading-relaxed">
            You have the right to access, correct, or delete personal data we hold about you. To exercise these rights, email us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: '#FF6900' }}>
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </motion.div>

        {/* Contact section */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: (SECTIONS.length + 1) * 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-creato font-bold text-[18px] text-neutral-900 mb-3">10. Contact</h2>
          <p className="text-[15px] text-neutral-600 leading-relaxed">
            For privacy-related questions, contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: '#FF6900' }}>
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </motion.div>
      </div>
    </main>
  )
}
