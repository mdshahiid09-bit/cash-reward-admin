import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users as UsersIcon,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  ShieldBan,
  ShieldCheck,
  DollarSign,
  PlusCircle,
  Clock,
  Sparkles,
  ArrowUpDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { exportToCSV, exportToJSON } from '../lib/export'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { TableSkeleton } from '../components/common/Skeleton'

interface UserItem {
  id: string
  display_name: string
  avatar_url?: string
  referral_code: string
  referred_by?: string
  total_earned: number
  balance: number
  blocked: boolean
  is_demo?: boolean
  block_reason?: string
  admin_note?: string
  created_at: string
}

export const Users: React.FC = () => {
  const navigate = useNavigate()
  const { admin } = useAdminAuth()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'demo'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'balance' | 'total_earned'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Quick adjust balance
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Block/Unblock toggle
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [blockReasonInput, setBlockReasonInput] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [statusFilter, sortBy, sortOrder])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })

      if (statusFilter === 'active') {
        query = query.eq('blocked', false)
      } else if (statusFilter === 'blocked') {
        query = query.eq('blocked', true)
      } else if (statusFilter === 'demo') {
        query = query.eq('is_demo', true)
      }

      const { data, error } = await query
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustBalance = async () => {
    if (!selectedUser) return
    const amt = parseFloat(adjustAmount)
    if (isNaN(amt) || amt === 0) {
      setActionError('Please enter a valid non-zero amount')
      return
    }
    if (!adjustReason.trim()) {
      setActionError('Reason is required for manual balance adjustments')
      return
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_adjust_balance', {
        p_user_id: selectedUser.id,
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
        entityId: selectedUser.id,
        beforeVal: { balance: selectedUser.balance },
        afterVal: {
          balance: selectedUser.balance + amt,
          adjustment: amt,
          reason: adjustReason.trim()
        }
      })

      setAdjustModalOpen(false)
      setAdjustAmount('')
      setAdjustReason('')
      await fetchUsers()
    } catch (err: any) {
      console.error('Adjust error:', err)
      setActionError(err.message || 'Failed to adjust balance')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleToggleBlock = async () => {
    if (!selectedUser) return
    setSubmittingAction(true)
    setActionError(null)

    const nextBlocked = !selectedUser.blocked

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          blocked: nextBlocked,
          block_reason: nextBlocked ? blockReasonInput.trim() || 'Blocked by administrator' : null
        })
        .eq('id', selectedUser.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: nextBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
        entityType: 'user',
        entityId: selectedUser.id,
        beforeVal: { blocked: selectedUser.blocked },
        afterVal: { blocked: nextBlocked, block_reason: blockReasonInput.trim() }
      })

      setBlockModalOpen(false)
      setBlockReasonInput('')
      await fetchUsers()
    } catch (err: any) {
      console.error('Block toggle error:', err)
      setActionError(err.message || 'Failed to update user block status')
    } finally {
      setSubmittingAction(false)
    }
  }

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.referral_code?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  })

  const handleExportCSV = () => {
    const rows = filteredUsers.map(u => ({
      ID: u.id,
      Name: u.display_name,
      ReferralCode: u.referral_code,
      Balance: u.balance,
      TotalEarned: u.total_earned,
      Status: u.blocked ? 'Blocked' : 'Active',
      IsDemo: u.is_demo ? 'Yes' : 'No',
      Joined: new Date(u.created_at).toLocaleString()
    }))
    exportToCSV('users_list', rows)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Browse all registered platform users, inspect wallets, adjust balances, and handle security blocks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredUsers.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white hover:border-neutral-700 transition text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchUsers()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white hover:border-neutral-700 transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'active', 'blocked', 'demo'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === tab
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}

          <span className="text-neutral-700 mx-1">|</span>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none"
            >
              <option value="created_at">Joined Date</option>
              <option value="balance">Wallet Balance</option>
              <option value="total_earned">Total Earned</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name, referral, or user ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <UsersIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No users found</h3>
          <p className="text-sm text-neutral-400 mt-1">
            No user records matched your current query.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Referral Code</th>
                  <th className="py-4 px-6">Balance</th>
                  <th className="py-4 px-6">Total Earned</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Joined</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredUsers.map(u => (
                  <tr
                    key={u.id}
                    className="hover:bg-neutral-850/60 transition cursor-pointer"
                    onClick={() => navigate(`/users/${u.id}`)}
                  >
                    {/* User */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-amber-400 text-xs overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.display_name?.charAt(0) || 'U'
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{u.display_name || 'Anonymous User'}</span>
                            {u.is_demo && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                Demo
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono">
                            {u.id.slice(0, 12)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Referral Code */}
                    <td className="py-4 px-6">
                      <span className="font-mono text-xs px-2 py-1 bg-neutral-950 rounded-lg border border-neutral-800 text-neutral-300">
                        {u.referral_code || 'None'}
                      </span>
                    </td>

                    {/* Balance */}
                    <td className="py-4 px-6">
                      <span className="font-bold text-emerald-400">₹{u.balance}</span>
                    </td>

                    {/* Total Earned */}
                    <td className="py-4 px-6">
                      <span className="font-medium text-white">₹{u.total_earned}</span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {u.blocked ? (
                        <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Blocked
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="py-4 px-6 text-xs text-neutral-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u)
                            setActionError(null)
                            setAdjustModalOpen(true)
                          }}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-emerald-400 transition"
                          title="Adjust Balance"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(u)
                            setActionError(null)
                            setBlockModalOpen(true)
                          }}
                          className={`p-1.5 rounded-lg transition ${
                            u.blocked
                              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400'
                          }`}
                          title={u.blocked ? 'Unblock User' : 'Block User'}
                        >
                          <ShieldBan className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/users/${u.id}`)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Adjust User Balance"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            Manually credit or debit funds from <strong className="text-white">{selectedUser?.display_name}</strong>'s balance. Use positive numbers for credit (e.g. 50) and negative for debit (e.g. -20).
          </p>

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs flex justify-between">
            <span className="text-neutral-400">Current Balance:</span>
            <span className="font-bold text-emerald-400 text-sm">₹{selectedUser?.balance}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Adjustment Amount (INR) <span className="text-rose-400">*</span>
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
              Reason / Admin Note <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Bonus compensation or correction"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setAdjustModalOpen(false)}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjustBalance}
              disabled={submittingAction}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 rounded-xl text-sm font-bold transition shadow-md shadow-amber-500/10"
            >
              {submittingAction ? 'Updating...' : 'Save Adjustment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Block/Unblock Modal */}
      <ConfirmModal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onConfirm={handleToggleBlock}
        title={selectedUser?.blocked ? 'Unblock User?' : 'Block User from App?'}
        message={
          selectedUser?.blocked
            ? `Are you sure you want to restore access for ${selectedUser?.display_name}? They will be able to log in and submit tasks again.`
            : `Are you sure you want to block ${selectedUser?.display_name}? They will be locked out and unable to complete tasks or withdraw.`
        }
        confirmText={selectedUser?.blocked ? 'Unblock Account' : 'Block User'}
        isDestructive={!selectedUser?.blocked}
        isLoading={submittingAction}
      />
    </div>
  )
}
