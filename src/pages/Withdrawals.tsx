import React, { useState, useEffect } from 'react'
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Download,
  Search,
  RefreshCw,
  CreditCard,
  Building,
  Gift,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { exportToCSV } from '../lib/export'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { Modal } from '../components/common/Modal'
import { TableSkeleton } from '../components/common/Skeleton'

interface WithdrawalItem {
  id: string
  user_id: string
  amount: number
  method: string
  account_snapshot: Record<string, any>
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  created_at: string
  updated_at?: string
  paid_reference?: string
  admin_note?: string
  reject_reason?: string
  user?: {
    id: string
    display_name: string
    balance: number
    avatar_url?: string
  }
}

export const Withdrawals: React.FC = () => {
  const { admin } = useAdminAuth()
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'rejected'>('pending')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Action states
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [paidReference, setPaidReference] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    fetchWithdrawals()
  }, [statusFilter, methodFilter])

  const fetchWithdrawals = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('withdrawals')
        .select(`
          id,
          user_id,
          amount,
          method,
          account_snapshot,
          status,
          created_at,
          updated_at,
          paid_reference,
          admin_note,
          reject_reason,
          user:profiles (
            id,
            display_name,
            balance,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (methodFilter !== 'all') {
        query = query.eq('method', methodFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setWithdrawals((data as any) || [])
    } catch (err) {
      console.error('Error fetching withdrawals:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fast approve: status pending -> approved
  const handleApprove = async () => {
    if (!selectedWithdrawal) return
    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedWithdrawal.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'APPROVE_WITHDRAWAL',
        entityType: 'withdrawal',
        entityId: selectedWithdrawal.id,
        beforeVal: { status: selectedWithdrawal.status },
        afterVal: { status: 'approved' }
      })

      setApproveConfirmOpen(false)
      await fetchWithdrawals()
    } catch (err: any) {
      console.error('Approve error:', err)
      setActionError(err.message || 'Failed to approve withdrawal')
    } finally {
      setSubmittingAction(false)
    }
  }

  // Mark as Paid
  const handlePay = async () => {
    if (!selectedWithdrawal) return
    if (!paidReference.trim()) {
      setActionError('Payment reference/UTR number is required')
      return
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_pay_withdrawal', {
        p_withdrawal_id: selectedWithdrawal.id,
        p_admin_id: admin?.id,
        p_reference: paidReference.trim(),
        p_note: adminNote.trim()
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'PAY_WITHDRAWAL',
        entityType: 'withdrawal',
        entityId: selectedWithdrawal.id,
        beforeVal: { status: selectedWithdrawal.status },
        afterVal: {
          status: 'paid',
          paid_reference: paidReference.trim(),
          admin_note: adminNote.trim()
        }
      })

      setPayModalOpen(false)
      setPaidReference('')
      setAdminNote('')
      await fetchWithdrawals()
    } catch (err: any) {
      console.error('Pay error:', err)
      setActionError(err.message || 'Failed to record payout')
    } finally {
      setSubmittingAction(false)
    }
  }

  // Reject and refund
  const handleReject = async () => {
    if (!selectedWithdrawal) return
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason for rejecting the payout')
      return
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_reject_withdrawal', {
        p_withdrawal_id: selectedWithdrawal.id,
        p_admin_id: admin?.id,
        p_reason: rejectReason.trim()
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'REJECT_WITHDRAWAL',
        entityType: 'withdrawal',
        entityId: selectedWithdrawal.id,
        beforeVal: { status: selectedWithdrawal.status },
        afterVal: { status: 'rejected', reject_reason: rejectReason.trim() }
      })

      setRejectModalOpen(false)
      setRejectReason('')
      await fetchWithdrawals()
    } catch (err: any) {
      console.error('Reject error:', err)
      setActionError(err.message || 'Failed to reject withdrawal')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleExport = () => {
    const rows = filteredWithdrawals.map(w => ({
      ID: w.id,
      User: w.user?.display_name || 'User',
      UserId: w.user_id,
      Amount: w.amount,
      Method: w.method,
      AccountDetails: JSON.stringify(w.account_snapshot || {}),
      Status: w.status,
      PaidReference: w.paid_reference || '',
      RejectReason: w.reject_reason || '',
      Date: new Date(w.created_at).toLocaleString()
    }))
    exportToCSV('withdrawals_report', rows)
  }

  const filteredWithdrawals = withdrawals.filter(w => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const snapshotStr = JSON.stringify(w.account_snapshot || {}).toLowerCase()
    return (
      w.user?.display_name?.toLowerCase().includes(q) ||
      w.id.toLowerCase().includes(q) ||
      w.paid_reference?.toLowerCase().includes(q) ||
      snapshotStr.includes(q)
    )
  })

  // Summary counts
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length
  const pendingAmount = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + Number(w.amount), 0)
  const paidCount = withdrawals.filter(w => w.status === 'paid').length
  const paidAmount = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + Number(w.amount), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Withdrawal Requests</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Review user cashout requests, approve or mark as paid, and issue refunds on rejection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={filteredWithdrawals.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white hover:border-neutral-700 transition text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchWithdrawals()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white hover:border-neutral-700 transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Pending Payouts</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ₹{pendingAmount.toLocaleString()}
          </div>
          <div className="text-xs text-amber-400 mt-1">{pendingCount} requests waiting</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Total Paid Out</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ₹{paidAmount.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-400 mt-1">{paidCount} transactions completed</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>UPI Payouts</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {withdrawals.filter(w => w.method === 'upi').length}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Instant UPI transfer requests</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Bank & Codes</span>
            <Building className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {withdrawals.filter(w => w.method !== 'upi').length}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Bank NEFT/IMPS and Redeem codes</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'pending', 'approved', 'paid', 'rejected'] as const).map(tab => (
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

          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank Transfer</option>
            <option value="redeem">Redeem Code</option>
          </select>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by user, ID, or account details..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Withdrawals Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredWithdrawals.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No withdrawals found</h3>
          <p className="text-sm text-neutral-400 mt-1">
            No withdrawal records matching current filters.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Payment Method</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Date Requested</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredWithdrawals.map(item => {
                  const snap = item.account_snapshot || {}
                  return (
                    <tr key={item.id} className="hover:bg-neutral-850/60 transition">
                      {/* User */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-amber-400 text-xs">
                            {item.user?.display_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-white">{item.user?.display_name || 'User'}</div>
                            <div className="text-xs text-neutral-500">ID: {item.user_id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6">
                        <span className="text-base font-bold text-white">₹{item.amount}</span>
                      </td>

                      {/* Payment Method Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {item.method === 'upi' ? (
                            <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                          ) : item.method === 'bank' ? (
                            <Building className="w-4 h-4 text-purple-400 shrink-0" />
                          ) : (
                            <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <span className="font-semibold uppercase text-xs text-white">
                            {item.method}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-1 font-mono">
                          {item.method === 'upi' && (snap.upi_id || snap.upi || 'N/A')}
                          {item.method === 'bank' && (
                            <span>
                              {snap.account_number || snap.acc} ({snap.ifsc || 'IFSC'})
                            </span>
                          )}
                          {item.method === 'redeem' && (snap.email || 'Google Play Code')}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <div>
                          <span
                            className={`inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${
                              item.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : item.status === 'approved'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : item.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.paid_reference && (
                            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                              Ref: {item.paid_reference}
                            </div>
                          )}
                          {item.reject_reason && (
                            <div className="text-[11px] text-rose-400 mt-1 max-w-xs line-clamp-1">
                              {item.reject_reason}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-xs text-neutral-400">
                        {new Date(item.created_at).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(item)
                                  setApproveConfirmOpen(true)
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-semibold transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(item)
                                  setPayModalOpen(true)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition shadow-sm"
                              >
                                Pay Now
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(item)
                                  setRejectModalOpen(true)
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {item.status === 'approved' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(item)
                                  setPayModalOpen(true)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition shadow-sm"
                              >
                                Mark as Paid
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(item)
                                  setRejectModalOpen(true)
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {(item.status === 'paid' || item.status === 'rejected') && (
                            <span className="text-xs text-neutral-500">Processed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Confirmation */}
      <ConfirmModal
        isOpen={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={handleApprove}
        title="Approve Withdrawal?"
        message={`Mark request #${selectedWithdrawal?.id.slice(0, 8)} for ₹${selectedWithdrawal?.amount} as approved. You can release the payout next.`}
        confirmText="Approve Request"
        isDestructive={false}
        isLoading={submittingAction}
      />

      {/* Pay Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Mark Withdrawal as Paid"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            Enter the bank transfer UTR or transaction reference number. This confirms the payment has been sent to the user.
          </p>

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-400">Recipient:</span>
              <span className="text-white font-medium">{selectedWithdrawal?.user?.display_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Amount:</span>
              <span className="text-emerald-400 font-bold text-sm">₹{selectedWithdrawal?.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Method:</span>
              <span className="text-white uppercase font-mono">{selectedWithdrawal?.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Account:</span>
              <span className="text-white font-mono">
                {JSON.stringify(selectedWithdrawal?.account_snapshot || {})}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Payment Reference / UTR Number <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. UTR123456789 or TXN987654321"
              value={paidReference}
              onChange={e => setPaidReference(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Internal Admin Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via HDFC Netbanking"
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setPayModalOpen(false)}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePay}
              disabled={submittingAction}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 rounded-xl text-sm font-bold transition shadow-md shadow-emerald-500/10"
            >
              {submittingAction ? 'Processing...' : 'Confirm Paid'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Withdrawal Request"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <strong>Automatic Balance Refund:</strong> Rejecting this request will immediately refund ₹{selectedWithdrawal?.amount} back to the user's wallet.
            </div>
          </div>

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Reason for Rejection <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Incorrect UPI ID / Bank account details invalid..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={submittingAction}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-rose-600/20"
            >
              {submittingAction ? 'Rejecting...' : 'Reject & Refund'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
