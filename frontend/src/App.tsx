import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import LandingNav from './components/LandingNav'
import LandingFooter from './components/landing/LandingFooter'
import LandingPage from './pages/LandingPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

import AuthPage from './pages/auth/AuthPage'

import DashboardLayout from './layouts/DashboardLayout'
import OverviewPage from './pages/dashboard/OverviewPage'
import ChopFoodPage from './pages/dashboard/ChopFoodPage'
import ShareLinkPage from './pages/dashboard/ShareLinkPage'

import PublicLayout from './layouts/PublicLayout'
import SessionPayPage from './pages/session/SessionPayPage'
import PaymentSuccessPage from './pages/session/PaymentSuccessPage'
import ChopInPage from './pages/dashboard/ChopInPage'
import ChopBillPage from './pages/dashboard/ChopBillPage'

// Landing shell — nav + footer wrapping public pages
function LandingShell() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingNav />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </AnimatePresence>
      <LandingFooter />
    </div>
  )
}

// Redirect authenticated users away from auth pages
function AuthRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth — no nav/footer */}
        <Route path="/login"  element={<AuthRoute />} />
        <Route path="/signup" element={<AuthRoute />} />

        {/* Dashboard — protected */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index             element={<OverviewPage />} />
          <Route path="chop-food" element={<ChopFoodPage />} />
          <Route path="chop-in" element={<ChopInPage />} />
          <Route path="chop-bill" element={<ChopBillPage />} />
          <Route path="share"     element={<ShareLinkPage />} />
        </Route>

        {/* Public session pages — Topbar only, no auth required */}
        <Route element={<PublicLayout />}>
          <Route path="/s/:slug"        element={<SessionPayPage />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
        </Route>

        {/* Landing + public pages */}
        <Route path="/*" element={<LandingShell />} />
      </Routes>
    </AuthProvider>
  )
}
