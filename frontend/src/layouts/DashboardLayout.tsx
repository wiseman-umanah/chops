import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Topbar from '@/components/dashboard/Topbar'

export default function DashboardLayout() {
  const location = useLocation()

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <Topbar />
      <main className="flex-1 overflow-y-auto py-8 md:py-10 w-[90%] mx-auto">
        <AnimatePresence mode="sync">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
