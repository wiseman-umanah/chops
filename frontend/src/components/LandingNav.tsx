import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import RemixIcon from './RemixIcon'

const BRAND = '#FF6900'

const NAV_ITEMS = [
  { label: 'How it Works', sectionId: 'how-it-works' },
  { label: 'Chop Modes',   sectionId: 'chop-modes'   },
  { label: 'Features',     sectionId: 'features'     },
  { label: 'FAQs',         sectionId: 'faqs'         },
]

const SECTION_IDS = NAV_ITEMS.map(n => n.sectionId)

export default function LandingNav() {
  const location = useLocation()
  const navigate  = useNavigate()
  const isHome    = location.pathname === '/'

  const [activeId, setActiveId] = useState<string>('')

  /* Only observe sections when on the home page */
  useEffect(() => {
    if (!isHome) return

    const observers: IntersectionObserver[] = []

    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id) },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      )

      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [isHome])

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) {
    e.preventDefault()
    if (isHome) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      // Navigate to home first, then scroll once the page has mounted
      navigate('/')
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
      }, 120)
    }
  }

  return (
    <nav className="sticky top-0 z-40 bg-white py-6">
      <div className="max-w-[95%] mx-auto sm:px-10 h-[60px] flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo />
          <span style={{ fontSize: 24, letterSpacing: '2px', color: '#18181b', fontFamily: 'Godber, sans-serif' }}>
            Chop
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden lg:flex bg-black px-15 py-5 rounded-full items-center gap-10 text-[16px] font-regular text-white">
          {NAV_ITEMS.map(({ label, sectionId }) => {
            const isActive = isHome && activeId === sectionId
            return (
              <a
                key={sectionId}
                href={`/#${sectionId}`}
                onClick={e => handleNavClick(e, sectionId)}
                className="transition-colors duration-200"
                style={{
                  color: isActive ? BRAND : undefined,
                  fontWeight: isActive ? 600 : undefined,
                }}
              >
                {label}
              </a>
            )
          })}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center px-6 py-3 rounded-full text-[13px] text-white transition-opacity hover:opacity-90"
            style={{ background: BRAND }}
          >
            Create Session
          </Link>
          <Link
            to="/signup"
            className="inline-flex flex items-center px-5 py-3 rounded-full text-[13px] transition-colors hover:bg-neutral-50"
            style={{ border: `1px solid #E5E5E5`, color: 'black' }}
          >
            <RemixIcon name="ri-link" />
            Join a Session
          </Link>
        </div>

      </div>
    </nav>
  )
}
