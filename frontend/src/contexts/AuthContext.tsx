import { createContext, useContext, useState, type ReactNode } from 'react'

interface User {
  firstName: string
  lastName: string
  phone: string
  email: string
}

interface AuthContextValue {
  isAuthenticated: boolean
  user: User | null
  login: (phone: string, password: string) => Promise<void>
  signup: (data: { firstName: string; lastName: string; phone: string; email: string; password: string }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('chop_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const isAuthenticated = user !== null

  async function login(phone: string, _password: string) {
    // Demo: always succeeds — replace with real API call
    const mockUser: User = { firstName: 'Alex', lastName: 'Chop', phone, email: '' }
    localStorage.setItem('chop_user', JSON.stringify(mockUser))
    setUser(mockUser)
  }

  async function signup(data: { firstName: string; lastName: string; phone: string; email: string; password: string }) {
    // Demo: always succeeds — replace with real API call
    const mockUser: User = {
      firstName: data.firstName || 'Alex',
      lastName:  data.lastName  || 'Chop',
      phone:     data.phone,
      email:     data.email,
    }
    localStorage.setItem('chop_user', JSON.stringify(mockUser))
    setUser(mockUser)
  }

  function logout() {
    localStorage.removeItem('chop_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
