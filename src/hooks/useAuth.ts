import { useState, useCallback, useEffect } from 'react'
import type { AuthUser, LoginCredentials } from '../lib/auth-types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) return
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          // Token is invalid or expired
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setToken(null)
          setUser(null)
        } else {
          const data = await response.json()
          setUser(data.user)
        }
      } catch {
        // Network error — keep the token but don't force logout
      }
    }
    validateToken()
  }, [token])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Login failed')
      }

      const data = await response.json()
      const newToken = data.token
      const newUser = data.user

      setToken(newToken)
      setUser(newUser)
      localStorage.setItem(TOKEN_KEY, newToken)
      localStorage.setItem(USER_KEY, JSON.stringify(newUser))

      return { token: newToken, user: newUser }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.warn('Logout API failed:', err)
    } finally {
      // Clear every key this origin holds, not just the credentials. The
      // dashboard persists API responses to localStorage to paint instantly on
      // reload, so removing only the token would leave the previous user's
      // business data readable to whoever opens the browser next.
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        // Private-mode or blocked storage — the reload below still drops it.
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
      setToken(null)
      setUser(null)
      setIsLoading(false)
      // A full document load, rather than a client-side route change, so the
      // in-memory React Query cache is discarded along with the stored copy.
      window.location.assign('/login')
    }
  }, [])

  const isAuthenticated = Boolean(token && user)

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  }
}
