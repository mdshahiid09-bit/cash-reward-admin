import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Lock, Mail, ArrowRight, Sparkles, AlertCircle } from 'lucide-react'
import { useAdminAuth } from '../context/AdminAuthContext'

export const Login: React.FC = () => {
  const { signIn, authError, clearError, user, isAdmin } = useAdminAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If already logged in as admin, redirect to dashboard
  React.useEffect(() => {
    if (user && isAdmin) {
      navigate('/', { replace: true })
    }
  }, [user, isAdmin, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setIsSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch {
      // Error handled in context
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-7 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 mb-3">
            <Sparkles className="w-6 h-6 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black font-heading text-white">
            Admin Console
          </h1>
          <p className="text-xs text-slate-400">
            Sign in with verified administrator credentials to access Cash Reward management portal.
          </p>
        </div>

        {/* Error Notification */}
        {authError && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Authentication Failed</span>
              <span className="text-[11px] opacity-90">{authError}</span>
            </div>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cashreward.app"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Verifying credentials...</span>
              </div>
            ) : (
              <>
                <span>Enter Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security badge */}
        <div className="pt-3 border-t border-slate-800 text-center">
          <span className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3 text-emerald-400" />
            <span>Restricted area. All access attempts are audit-logged.</span>
          </span>
        </div>
      </div>
    </div>
  )
}
