'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth as authApi } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export interface UserProfile {
  id: string
  fullName: string
  role: string
  agencyId: string | null
  country: string
  preferredLanguage: string
  avatarUrl: string | null
  onboardingCompleted: boolean
  agency: {
    id: string
    name: string
    country: string
    careSettings: string[]
    subscriptionTier: string
  } | null
}

export interface CurrentUser {
  id: string
  email: string
  emailVerified: boolean
  lastLoginAt: string | null
  profile: UserProfile | null
}

interface AuthContextValue {
  user: CurrentUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const data = await authApi.me()
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password)
    await fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    router.push('/login')
  }, [router])

  const refreshUser = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
