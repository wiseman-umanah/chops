import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import LandingNav from './components/LandingNav'
import LandingFooter from './components/landing/LandingFooter'

// Eagerly loaded — tiny, needed on first paint
import DashboardLayout from './layouts/DashboardLayout'
import PublicLayout from './layouts/PublicLayout'

// Lazily loaded — each becomes its own JS chunk
const LandingPage          = lazy(() => import('./pages/LandingPage'))
const TermsPage            = lazy(() => import('./pages/TermsPage'))
const PrivacyPage          = lazy(() => import('./pages/PrivacyPage'))

const AuthPage             = lazy(() => import('./pages/auth/AuthPage'))
const ForgotPasswordPage   = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage    = lazy(() => import('./pages/auth/ResetPasswordPage'))

const OverviewPage         = lazy(() => import('./pages/dashboard/OverviewPage'))
const ChopFoodPage         = lazy(() => import('./pages/dashboard/ChopFoodPage'))
const ChopInPage           = lazy(() => import('./pages/dashboard/ChopInPage'))
const ChopBillPage         = lazy(() => import('./pages/dashboard/ChopBillPage'))
const ShareLinkPage        = lazy(() => import('./pages/dashboard/ShareLinkPage'))
const NotificationsPage    = lazy(() => import('./pages/dashboard/NotificationsPage'))
const WalletPage           = lazy(() => import('./pages/dashboard/WalletPage'))
const SettingsPage         = lazy(() => import('./pages/dashboard/SettingsPage'))

const SessionPayPage       = lazy(() => import('./pages/session/SessionPayPage'))
const PaymentSuccessPage   = lazy(() => import('./pages/session/PaymentSuccessPage'))
const ReceiptPage          = lazy(() => import('./pages/session/ReceiptPage'))

// Minimal fallback — no spinner, just keeps the existing background visible
function PageFallback() {
  return <div className="w-full" />
}

// Landing shell — nav + footer wrapping public pages
function LandingShell() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingNav />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Suspense fallback={<PageFallback />}><LandingPage /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={<PageFallback />}><TermsPage /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<PageFallback />}><PrivacyPage /></Suspense>} />
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
  return (
    <Suspense fallback={<PageFallback />}>
      <AuthPage />
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth — no nav/footer */}
        <Route path="/login"           element={<AuthRoute />} />
        <Route path="/signup"          element={<AuthRoute />} />
        <Route path="/forgot-password" element={<Suspense fallback={<PageFallback />}><ForgotPasswordPage /></Suspense>} />
        <Route path="/reset-password"  element={<Suspense fallback={<PageFallback />}><ResetPasswordPage /></Suspense>} />

        {/* Dashboard — protected */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index                   element={<Suspense fallback={<PageFallback />}><OverviewPage /></Suspense>} />
          <Route path="chop-food"        element={<Suspense fallback={<PageFallback />}><ChopFoodPage /></Suspense>} />
          <Route path="chop-in"          element={<Suspense fallback={<PageFallback />}><ChopInPage /></Suspense>} />
          <Route path="chop-bill"        element={<Suspense fallback={<PageFallback />}><ChopBillPage /></Suspense>} />
          <Route path="share"            element={<Suspense fallback={<PageFallback />}><ShareLinkPage /></Suspense>} />
          <Route path="notifications"    element={<Suspense fallback={<PageFallback />}><NotificationsPage /></Suspense>} />
          <Route path="wallet"           element={<Suspense fallback={<PageFallback />}><WalletPage /></Suspense>} />
          <Route path="settings"         element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>} />
        </Route>

        {/* Public session pages — Topbar only, no auth required */}
        <Route element={<PublicLayout />}>
          <Route path="/s/:slug"         element={<Suspense fallback={<PageFallback />}><SessionPayPage /></Suspense>} />
          <Route path="/payment-success" element={<Suspense fallback={<PageFallback />}><PaymentSuccessPage /></Suspense>} />
        </Route>

        {/* Receipt — bare page, no topbar, no nav */}
        <Route path="/r/:paymentRef" element={<Suspense fallback={<PageFallback />}><ReceiptPage /></Suspense>} />

        {/* Landing + public pages */}
        <Route path="/*" element={<LandingShell />} />
      </Routes>
    </AuthProvider>
  )
}
