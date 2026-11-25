import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Admin } from '../types'

interface AdminAuthContextType {
  user: User | null
  admin: Admin | null
  loading: boolean
  isAdmin: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const clearError = () => setAuthError(null)

  const verifyAdminRole = useCallback(async (authUser: User) => {
    try {
      // Check in admins table by auth_user_id or email
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .or(`auth_user_id.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle()

      if (error || !data) {
        await supabase.auth.signOut()
        setUser(null)
        setAdmin(null)
        setAuthError('Access Denied: You do not have administrator permissions.')
        return null
      }

      setAdmin(data as Admin)
      return data as Admin
    } catch {
      await supabase.auth.signOut()
      setUser(null)
      setAdmin(null)
      setAuthError('Failed to verify admin status.')
      return null
    }
  }, [])

  // Listen to session & user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        verifyAdminRole(authUser).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        await verifyAdminRole(authUser)
      } else {
        setAdmin(null)
      }
      setLoading(false)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [verifyAdminRole])

  // Inactivity timeout listener
  useEffect(() => {
    if (!user) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        alert('Session expired due to 30 minutes of inactivity. Please log in again.')
        await signOut()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(evt => window.addEventListener(evt, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach(evt => window.removeEventListener(evt, resetTimer))
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    setAuthError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (error) throw error
      if (!data.user) throw new Error('Authentication failed.')

      const adminRecord = await verifyAdminRole(data.user)
      if (!adminRecord) {
        throw new Error('Access Denied: This account is not an administrator.')
      }

      setUser(data.user)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials'
      setAuthError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAdmin(null)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        admin,
        loading,
        isAdmin: !!admin,
        authError,
        signIn,
        signOut,
        clearError
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return context
}
