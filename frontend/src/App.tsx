import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './pages/LandingPage.tsx'
import TermsPage from './pages/TermsPage.tsx'
import PrivacyPage from './pages/PrivacyPage.tsx'
import LandingNav from './components/LandingNav.tsx'
import LandingFooter from './components/landing/LandingFooter.tsx'

export default function App() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <div
        className="min-h-screen bg-white flex flex-col"
      >
        <LandingNav />
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
        <LandingFooter />
      </div>
    </AnimatePresence>
  )
}
