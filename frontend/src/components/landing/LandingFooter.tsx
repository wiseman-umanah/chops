import { Link, useLocation } from 'react-router-dom'
import Logo from '../Logo'

const BRAND = '#FF6900'

const FOOTER_LINKS = [
  { label: 'Terms',   to: '/terms'   },
  { label: 'Privacy', to: '/privacy' },
]

export default function LandingFooter() {
  const { pathname } = useLocation()
  return (
    <>
      {/* ── CTA Section — cream bg, orange card with chat bubbles ── */}
      <section className="py-16 px-5 sm:px-10" style={{ background: '#f5f0e8' }}>
        {/* Extra horizontal room for the bubbles only on md+ */}
        <div className="max-w-[860px] mx-auto relative md:px-10">
          {/* Orange card */}
          <div
            className="relative rounded-3xl px-6 sm:px-8 py-12 sm:py-14 flex flex-col items-center justify-center text-center overflow-hidden sm:overflow-visible"
            style={{ background: '#FF6900', minHeight: 220 }}
          >
            <h2 className="font-creato font-extrabold text-white text-[clamp(20px,5.5vw,38px)] leading-tight tracking-tight mb-6 sm:mb-8 max-w-[420px]">
              Ready to stop chasing money in group chats?
            </h2>

            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full text-[clamp(12px,3.5vw,14px)] font-bold bg-white transition-opacity hover:opacity-90"
              style={{ color: '#1a1a1a' }}
            >
              Create your first CHOP
              <span className="text-[16px] leading-none">›</span>
            </Link>

            {/* Chat bubble — top right (hidden on small, visible sm+) */}
            <div
              className="hidden sm:block absolute"
              style={{
                top: 20, right: -24,
                background: '#66B36F',
                border: '1px solid black',
                borderRadius: '999px 999px 0px 999px',
                padding: '10px 20px',
              }}
            >
              <p className='text-left' style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.35, margin: 0 }}>Hello, Moyo! Do you have<br />the money now? :)</p>
              <p className='absolute right-2 bottom-0' style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, margin: '2px 0 0 0', textAlign: 'right' }}>08:00 PM</p>
            </div>

            {/* Chat bubble — bottom left (hidden on small, visible sm+) */}
            <div
              className="hidden sm:flex absolute items-center"
              style={{
                bottom: 20, left: -24,
                background: '#66B36F',
                border: '1px solid black',
                borderRadius: '999px 0px 999px 999px',
                transform: 'rotate(-180deg)',
                padding: '20px',
              }}
            >
              {/* counter-rotate text so it reads normally */}
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0, transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>Give me a few mins.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer bar — dark, Chop logo + links + copyright ── */}
      <footer className="px-5 sm:px-10 py-6" style={{ background: '#1a1a1a', color: 'white' }}>
        <div className="max-w-[95%] mx-auto sm:px-10 flex flex-wrap items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo />
          <span
            style={{ fontSize: 24, letterSpacing: '2px', fontFamily: 'Godber, sans-serif' }}
          >
            Chop
          </span>
        </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-8">
            {FOOTER_LINKS.map(({ label, to }) => {
              const isActive = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-[14px] transition-colors hover:text-white"
                  style={{ color: isActive ? BRAND : undefined, fontWeight: isActive ? 600 : undefined }}
                >
                  {label}
                </Link>
              )
            })}
            <a href="mailto:support@usechop.co" className="text-[14px] transition-colors hover:text-white">Support</a>
          </nav>

          {/* Copyright */}
          <p className="text-[13px] font-semibold">
            © {new Date().getFullYear()} CHOP. Powered by Macedon Labs
          </p>

        </div>
      </footer>
    </>
  )
}
