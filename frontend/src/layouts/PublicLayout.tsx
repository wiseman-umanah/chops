import { Outlet, useLocation, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Logo from '@/components/Logo'

/**
 * Used for public session pages (/s/:slug, /payment-success).
 * Shows only the Chop logo — no auth widgets, no notifications, no profile.
 * Visitors paying into a session should not see the organiser's account info.
 */
export default function PublicLayout() {
  const location = useLocation()
  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Minimal public header — logo only */}
      <header className="shrink-0 sticky top-0 z-50 py-3 sm:py-5 border-b border-neutral-100 bg-white">
        <div className="flex max-w-[90%] mx-auto items-center">
          <Link to="/" className="flex items-center gap-2">
            <Logo width={28} height={28} />
            <span style={{ fontSize: 18, letterSpacing: '2px', fontFamily: 'Godber, sans-serif', color: '#18181b' }}>
              Chop
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto py-8 md:py-10 w-[90%] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
