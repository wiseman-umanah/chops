import { createContext, useContext, type ReactNode } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../../convex/_generated/api'

interface User {
  firstName: string
  lastName?: string
  phone?: string
  email?: string
  imageUrl?: string | null
}

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signOut } = useAuthActions()

  const profile = useQuery(
    api.users.getMyProfile,
    isAuthenticated ? {} : 'skip'
  )

  const user: User | null = profile
    ? {
        firstName: profile.firstName ?? profile.name ?? 'User',
        lastName: profile.lastName,
        phone: profile.phone,
        email: profile.email,
        imageUrl: profile.imageUrl,
      }
    : null

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, logout: signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
