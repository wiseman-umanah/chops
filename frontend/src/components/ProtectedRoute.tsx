import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, emailVerified } = useAuth()

  // While Convex is checking the session, render nothing to avoid flash
  if (isLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Authenticated but email not yet verified — gate the dashboard
  if (!emailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  return <>{children}</>
}
