const LAST_UPDATED = 'June 2025'
const SUPPORT_EMAIL = 'support@usechop.co'

export default function TermsPage() {
  return (
      <main className="flex-1 max-w-[760px] mx-auto w-full px-5 sm:px-10 py-16 md:py-24">
        <h1 className="font-creato font-extrabold text-[36px] md:text-[48px] text-neutral-900 leading-tight mb-3">
          Terms of Service
        </h1>
        <p className="text-[13px] text-neutral-400 mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose-chop">
          <Section title="1. Acceptance of Terms">
            By accessing or using Chop ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
          </Section>

          <Section title="2. What Chop Does">
            Chop is a group payment coordination tool that allows an organiser to create a payment session and share a link with participants. Participants pay their individual share directly — Chop does not hold, transfer, or custody funds on behalf of any party.
          </Section>

          <Section title="3. Eligibility">
            You must be at least 18 years old and resident in a supported country to create a Chop session. Participants accessing a session via shared link are not required to create an account.
          </Section>

          <Section title="4. Organiser Responsibilities">
            As the session organiser, you are responsible for ensuring the accuracy of the payment details, amounts, and participant information you provide. Chop is not liable for errors introduced by organisers.
          </Section>

          <Section title="5. Payments">
            Payments are processed by third-party payment providers. By initiating or completing a payment through Chop, you also agree to the terms of the applicable payment processor. Chop does not store card or bank account details.
          </Section>

          <Section title="6. Prohibited Use">
            You may not use Chop for fraudulent transactions, money laundering, or any activity that violates applicable Nigerian or international law. We reserve the right to suspend accounts found in violation without notice.
          </Section>

          <Section title="7. Intellectual Property">
            All content, branding, and software on Chop are the property of Macedon Labs. You may not reproduce or distribute any part of the Service without written permission.
          </Section>

          <Section title="8. Limitation of Liability">
            To the extent permitted by law, Macedon Labs is not liable for any indirect, incidental, or consequential damages arising from your use of the Service.
          </Section>

          <Section title="9. Changes to Terms">
            We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.
          </Section>

          <Section title="10. Contact">
            Questions about these terms? Email us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: '#FF6900' }}>
              {SUPPORT_EMAIL}
            </a>
          </Section>
        </div>
      </main>
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
