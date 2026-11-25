import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Bell,
  Download,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Users as UsersIcon,
  Award,
  Layers,
  FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { exportToJSON } from '../lib/export'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { DetailSkeleton } from '../components/common/Skeleton'

export const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { admin } = useAdminAuth()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'submissions' | 'withdrawals' | 'transactions' | 'referrals' | 'notes'>('submissions')

  // Tab Data
  const [submissions, setSubmissions] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [referrals, setReferrals] = useState<any[]>([])

  // Actions
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const [notifyModalOpen, setNotifyModalOpen] = useState(false)
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')

  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [adminNoteText, setAdminNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchUserData()
    }
  }, [id])

  const fetchUserData = async () => {
    setLoading(true)
    try {
      // 1. Fetch user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setUser(profile)
      setAdminNoteText(profile.admin_note || '')

      // 2. Fetch submissions
      const { data: subs } = await supabase
        .from('submissions')
        .select('*, task:tasks(name, prize_inr)')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
      setSubmissions(subs || [])

      // 3. Fetch withdrawals
      const { data: wds } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
      setWithdrawals(wds || [])

      // 4. Fetch transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
      setTransactions(txs || [])

      // 5. Fetch referrals
      if (profile.referral_code) {
        const { data: refs } = await supabase
          .from('profiles')
          .select('id, display_name, created_at, balance, total_earned')
          .eq('referred_by', profile.referral_code)
          .order('created_at', { ascending: false })
        setReferrals(refs || [])
      }
    } catch (err) {
      console.error('Error fetching user details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustBalance = async () => {
    const amt = parseFloat(adjustAmount)
    if (isNaN(amt) || amt === 0) {
      setActionError('Please enter a valid non-zero amount')
      return
    }
    if (!adjustReason.trim()) {
      setActionError('Reason is required')
      return
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_adjust_balance', {
        p_user_id: user.id,
        p_admin_id: admin?.id,
        p_amount: amt,
        p_reason: adjustReason.trim()
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'ADJUST_BALANCE',
        entityType: 'user',
        entityId: user.id,
        beforeVal: { balance: user.balance },
        afterVal: {
          balance: user.balance + amt,
          adjustment: amt,
          reason: adjustReason.trim()
        }
      })

      setAdjustModalOpen(false)
      setAdjustAmount('')
      setAdjustReason('')
      await fetchUserData()
    } catch (err: any) {
      setActionError(err.message || 'Failed to adjust balance')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleToggleBlock = async () => {
    setSubmittingAction(true)
    const nextBlocked = !user.blocked

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          blocked: nextBlocked,
          block_reason: nextBlocked ? 'Blocked by admin' : null
        })
        .eq('id', user.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: nextBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
        entityType: 'user',
        entityId: user.id,
        beforeVal: { blocked: user.blocked },
        afterVal: { blocked: nextBlocked }
      })

      setBlockModalOpen(false)
      await fetchUserData()
    } catch (err: any) {
      console.error('Block error:', err)
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleSendNotification = async () => {
    if (!notifyTitle.trim() || !notifyMessage.trim()) {
      setActionError('Both title and message are required')
      return
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: notifyTitle.trim(),
        message: notifyMessage.trim(),
        read: false,
        created_at: new Date().toISOString()
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'SEND_NOTIFICATION',
        entityType: 'notification',
        entityId: user.id,
        afterVal: { title: notifyTitle, message: notifyMessage }
      })

      setNotifyModalOpen(false)
      setNotifyTitle('')
      setNotifyMessage('')
    } catch (err: any) {
      setActionError(err.message || 'Failed to send notification')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ admin_note: adminNoteText.trim() })
        .eq('id', user.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'UPDATE_ADMIN_NOTE',
        entityType: 'user',
        entityId: user.id,
        afterVal: { admin_note: adminNoteText.trim() }
      })
    } catch (err) {
      console.error('Note error:', err)
    } finally {
      setSavingNote(false)
    }
  }

  const handleExportJSON = () => {
    const fullUserData = {
      profile: user,
      submissions,
      withdrawals,
      transactions,
      referrals
    }
    exportToJSON(`user_${user.id}`, fullUserData)
  }

  if (loading) return <DetailSkeleton />

  if (!user) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
        <h3 className="text-lg font-bold text-white">User not found</h3>
        <p className="text-sm text-neutral-400 mt-1">
          The requested user profile does not exist.
        </p>
        <button
          onClick={() => navigate('/users')}
          className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-sm"
        >
          Back to Users
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/users')}
            className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <span>{user.display_name || 'Anonymous User'}</span>
              {user.is_demo && (
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  Demo Account
                </span>
              )}
              {user.blocked ? (
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Blocked
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">User ID: {user.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button
            onClick={() => setNotifyModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-xs font-medium"
          >
            <Bell className="w-4 h-4" />
            Send Message
          </button>
          <button
            onClick={() => setAdjustModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <DollarSign className="w-4 h-4" />
            Adjust Balance
          </button>
          <button
            onClick={() => setBlockModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              user.blocked
                ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30'
            }`}
          >
            {user.blocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {user.blocked ? 'Unblock User' : 'Block User'}
          </button>
        </div>
      </div>

      {/* Wallet Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="text-xs text-neutral-400 font-medium">Available Balance</div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">₹{user.balance}</div>
          <div className="text-xs text-neutral-500 mt-1">Current withdrawable balance</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="text-xs text-neutral-400 font-medium">Lifetime Earned</div>
          <div className="text-3xl font-bold text-white mt-2">₹{user.total_earned}</div>
          <div className="text-xs text-neutral-500 mt-1">Cumulative verified rewards</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="text-xs text-neutral-400 font-medium">Referral Code</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {user.referral_code || 'None'}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Referred by: {user.referred_by || 'Organic signup'}
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="text-xs text-neutral-400 font-medium">Account Created</div>
          <div className="text-xl font-bold text-white mt-2">
            {new Date(user.created_at).toLocaleDateString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {new Date(user.created_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-neutral-800 flex items-center gap-6 text-sm font-medium">
        {[
          { key: 'submissions', label: `Submissions (${submissions.length})`, icon: Layers },
          { key: 'withdrawals', label: `Withdrawals (${withdrawals.length})`, icon: CreditCard },
          { key: 'transactions', label: `Ledger (${transactions.length})`, icon: DollarSign },
          { key: 'referrals', label: `Referrals (${referrals.length})`, icon: UsersIcon },
          { key: 'notes', label: 'Admin Notes', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition ${
                isActive
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
        {/* 1. Submissions Tab */}
        {activeTab === 'submissions' && (
          <div>
            {submissions.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">No task submissions recorded.</p>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {submissions.map(s => (
                  <div key={s.id} className="py-3.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-white">{s.task?.name || 'Task'}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">₹{s.task?.prize_inr || 0}</div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          s.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : s.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div>
            {withdrawals.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">No cashout requests found.</p>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {withdrawals.map(w => (
                  <div key={w.id} className="py-3.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-white uppercase">{w.method}</div>
                      <div className="text-xs text-neutral-400 mt-0.5 font-mono">
                        {JSON.stringify(w.account_snapshot || {})}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {new Date(w.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">₹{w.amount}</div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          w.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : w.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {w.status}
                      </span>
                      {w.paid_reference && (
                        <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                          Ref: {w.paid_reference}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            {transactions.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">No transaction records found.</p>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {transactions.map(t => (
                  <div key={t.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-white">{t.note || t.type}</div>
                      <div className="text-xs text-neutral-500">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold ${
                          t.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.amount >= 0 ? `+₹${t.amount}` : `-₹${Math.abs(t.amount)}`}
                      </span>
                      <div className="text-[10px] uppercase text-neutral-500 font-mono">{t.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Referrals Tab */}
        {activeTab === 'referrals' && (
          <div>
            {referrals.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">
                This user has not referred any other users yet.
              </p>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {referrals.map(r => (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/users/${r.id}`)}
                    className="py-3 flex items-center justify-between text-sm hover:bg-neutral-850 cursor-pointer rounded-lg px-2"
                  >
                    <div>
                      <div className="font-semibold text-white">{r.display_name || 'User'}</div>
                      <div className="text-xs text-neutral-500">
                        Joined: {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-neutral-400">Balance: ₹{r.balance}</div>
                      <div className="text-xs text-emerald-400 font-bold">Earned: ₹{r.total_earned}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Admin Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400">
              Internal notes visible only to administrators. Keep track of user behavior, phone verification notes, or suspicious activity.
            </p>
            <textarea
              rows={5}
              value={adminNoteText}
              onChange={e => setAdminNoteText(e.target.value)}
              placeholder="Enter internal notes about this user..."
              className="w-full p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-sm font-bold transition"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Adjust Balance Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Adjust User Balance"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            Credit or debit funds from <strong className="text-white">{user.display_name}</strong>'s balance.
          </p>

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Amount (INR) <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 100 or -50"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Reason <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Reason for adjustment"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setAdjustModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjustBalance}
              disabled={submittingAction}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              {submittingAction ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Send Notification Modal */}
      <Modal
        isOpen={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
        title="Send Direct In-App Message"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            This message will appear directly in {user.display_name}'s notification bell feed.
          </p>

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Account Update or Special Bonus"
              value={notifyTitle}
              onChange={e => setNotifyTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Message Body <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Write your message here..."
              value={notifyMessage}
              onChange={e => setNotifyMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setNotifyModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSendNotification}
              disabled={submittingAction}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              {submittingAction ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Block Confirm Modal */}
      <ConfirmModal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onConfirm={handleToggleBlock}
        title={user.blocked ? 'Unblock User?' : 'Block User?'}
        message={
          user.blocked
            ? `Restore access for ${user.display_name}?`
            : `Lock ${user.display_name} out from completing tasks and withdrawing?`
        }
        confirmText={user.blocked ? 'Unblock' : 'Block User'}
        isDestructive={!user.blocked}
        isLoading={submittingAction}
      />
    </div>
  )
}
