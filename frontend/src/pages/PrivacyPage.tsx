const LAST_UPDATED = 'June 2025'
const SUPPORT_EMAIL = 'support@usechop.co'

export default function PrivacyPage() {
  return (
    <>
      <main className="flex-1 max-w-[760px] mx-auto w-full px-5 sm:px-10 py-16 md:py-24">
        <h1 className="font-creato font-extrabold text-[36px] md:text-[48px] text-neutral-900 leading-tight mb-3">
          Privacy Policy
        </h1>
        <p className="text-[13px] text-neutral-400 mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose-chop">
          <Section title="1. Information We Collect">
            When you create a Chop session, we collect your name and email address. Participants who pay via a shared link may have their name and payment reference recorded against the session. We do not collect card or bank account numbers directly.
          </Section>

          <Section title="2. How We Use Your Information">
            We use your information to operate the Service, send session-related notifications, process payments via our payment partners, and improve the product. We do not sell your data to third parties.
          </Section>

          <Section title="3. Payment Data">
            All payment processing is handled by regulated third-party processors. Chop receives only a payment confirmation reference — not your full card or bank details. Payment processors have their own privacy policies which apply to your payment data.
          </Section>

          <Section title="4. Sharing Information">
            Session details (participant names, amounts, and statuses) are visible to anyone with the session link. Do not share session links publicly if you wish to restrict visibility. We may share data with law enforcement when legally required.
          </Section>

          <Section title="5. Data Retention">
            Session data is retained for 12 months after the session closes, after which it is anonymised or deleted. You may request earlier deletion by contacting us.
          </Section>

          <Section title="6. Cookies">
            We use minimal session cookies required to operate the Service. We do not use advertising or tracking cookies.
          </Section>

          <Section title="7. Your Rights">
            You have the right to access, correct, or delete personal data we hold about you. To exercise these rights, email us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: '#FF6900' }}>
              {SUPPORT_EMAIL}
            </a>
            .
          </Section>

          <Section title="8. Security">
            We use industry-standard encryption (TLS) for all data in transit and access controls for data at rest. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="9. Changes to This Policy">
            We may update this policy periodically. We will notify you of significant changes via email or a notice on the Service.
          </Section>

          <Section title="10. Contact">
            For privacy-related questions, contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: '#FF6900' }}>
              {SUPPORT_EMAIL}
            </a>
            .
          </Section>
        </div>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-creato font-bold text-[18px] text-neutral-900 mb-3">{title}</h2>
      <p className="text-[15px] text-neutral-600 leading-relaxed">{children}</p>
    </div>
  )
}
