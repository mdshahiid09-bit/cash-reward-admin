import React, { useState, useEffect } from 'react'
import {
  Gift,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  UserCheck,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { exportToCSV } from '../lib/export'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { TableSkeleton } from '../components/common/Skeleton'

interface RedeemCodeItem {
  id: string
  code: string
  amount: number
  status: string
  description?: string
  expires_at?: string
  created_at: string
  assigned_to?: string
  assigned_user?: {
    id: string
    display_name: string
  }
}

export const RedeemCodes: React.FC = () => {
  const { admin } = useAdminAuth()
  const [codes, setCodes] = useState<RedeemCodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'assigned' | 'expired'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Create code modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newAmount, setNewAmount] = useState('50')
  const [newDesc, setNewDesc] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [userOptions, setUserOptions] = useState<{ id: string; display_name: string }[]>([])

  // Assign user modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [codeToAssign, setCodeToAssign] = useState<RedeemCodeItem | null>(null)
  const [targetUserId, setTargetUserId] = useState('')

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState<RedeemCodeItem | null>(null)

  const [submittingAction, setSubmittingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    fetchCodes()
    fetchUsersList()
  }, [statusFilter])

  const fetchUsersList = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .limit(100)
      if (data) setUserOptions(data)
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const fetchCodes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('redeem_codes')
        .select(`
          id,
          code,
          amount,
          status,
          description,
          expires_at,
          created_at,
          assigned_to
        `)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error

      if (data && data.length > 0) {
        // Collect assigned_to ids
        const userIds = data.filter((d: any) => d.assigned_to).map((d: any) => d.assigned_to)
        let userMap: Record<string, { id: string; display_name: string }> = {}

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)
          usersData?.forEach((u: any) => {
            userMap[u.id] = u
          })
        }

        const mapped = data.map((d: any) => ({
          ...d,
          assigned_user: d.assigned_to ? userMap[d.assigned_to] : undefined
        }))
        setCodes(mapped)
      } else {
        setCodes([])
      }
    } catch (err) {
      console.error('Error fetching redeem codes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCode = async () => {
    if (!newCode.trim()) {
      setActionError('Code string is required')
      return
    }
    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) {
      setActionError('Valid positive amount is required')
      return
    }

    setSubmittingAction(true)
    setActionError(null)

    try {
      const insertData: any = {
        code: newCode.trim().toUpperCase(),
        amount: amt,
        description: newDesc.trim() || null,
        expires_at: newExpiry ? new Date(newExpiry).toISOString() : null,
        status: selectedAssignee ? 'assigned' : 'available',
        assigned_to: selectedAssignee || null,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase.from('redeem_codes').insert(insertData).select().single()
      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'CREATE_REDEEM_CODE',
        entityType: 'redeem_code',
        entityId: data?.id,
        afterVal: insertData
      })

      setCreateModalOpen(false)
      setNewCode('')
      setNewDesc('')
      setNewExpiry('')
      setSelectedAssignee('')
      await fetchCodes()
    } catch (err: any) {
      setActionError(err.message || 'Failed to create redeem code')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleAssignCode = async () => {
    if (!codeToAssign || !targetUserId) return
    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase
        .from('redeem_codes')
        .update({
          assigned_to: targetUserId,
          status: 'assigned'
        })
        .eq('id', codeToAssign.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'ASSIGN_REDEEM_CODE',
        entityType: 'redeem_code',
        entityId: codeToAssign.id,
        afterVal: { assigned_to: targetUserId, status: 'assigned' }
      })

      setAssignModalOpen(false)
      setCodeToAssign(null)
      setTargetUserId('')
      await fetchCodes()
    } catch (err: any) {
      setActionError(err.message || 'Failed to assign code')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleDeleteCode = async () => {
    if (!codeToDelete) return
    setSubmittingAction(true)

    try {
      const { error } = await supabase.from('redeem_codes').delete().eq('id', codeToDelete.id)
      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'DELETE_REDEEM_CODE',
        entityType: 'redeem_code',
        entityId: codeToDelete.id,
        beforeVal: { code: codeToDelete.code }
      })

      setDeleteModalOpen(false)
      setCodeToDelete(null)
      await fetchCodes()
    } catch (err: any) {
      console.error('Delete error:', err)
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let res = 'PLAY-'
    for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length))
    res += '-'
    for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length))
    setNewCode(res)
  }

  const handleExportCSV = () => {
    const rows = filteredCodes.map(c => ({
      Code: c.code,
      Amount: c.amount,
      Status: c.status,
      Description: c.description || '',
      AssignedUser: c.assigned_user?.display_name || '',
      AssignedUserId: c.assigned_to || '',
      Expires: c.expires_at ? new Date(c.expires_at).toLocaleString() : 'Never',
      Created: new Date(c.created_at).toLocaleString()
    }))
    exportToCSV('redeem_codes', rows)
  }

  const filteredCodes = codes.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.code.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.assigned_user?.display_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Redeem Codes</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage Google Play redeem codes and promo vouchers. Assign them to users who request redeem payouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredCodes.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => {
              generateRandomCode()
              setCreateModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Redeem Code
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['all', 'available', 'assigned', 'expired'] as const).map(tab => (
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
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by code, user, or note..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredCodes.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <Gift className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No redeem codes found</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Click "Add Redeem Code" to create gift cards or voucher codes.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="py-4 px-6">Voucher Code</th>
                  <th className="py-4 px-6">Value (INR)</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Assigned To</th>
                  <th className="py-4 px-6">Expires</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredCodes.map(c => (
                  <tr key={c.id} className="hover:bg-neutral-850/60 transition">
                    {/* Code */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-sm tracking-wider">
                          {c.code}
                        </span>
                        <button
                          onClick={() => handleCopy(c.code, c.id)}
                          className="p-1 text-neutral-500 hover:text-white transition"
                          title="Copy Code"
                        >
                          {copiedId === c.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {c.description && (
                        <div className="text-xs text-neutral-500 mt-0.5">{c.description}</div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-6 font-semibold text-white">₹{c.amount}</td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-semibold uppercase rounded-full ${
                          c.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'assigned'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    {/* Assigned User */}
                    <td className="py-4 px-6">
                      {c.assigned_user ? (
                        <div className="text-white text-xs font-medium">
                          {c.assigned_user.display_name}
                        </div>
                      ) : (
                        <span className="text-neutral-500 text-xs">Unassigned</span>
                      )}
                    </td>

                    {/* Expiry */}
                    <td className="py-4 px-6 text-xs text-neutral-400">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === 'available' && (
                          <button
                            onClick={() => {
                              setCodeToAssign(c)
                              setAssignModalOpen(true)
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                            title="Assign to user"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setCodeToDelete(c)
                            setDeleteModalOpen(true)
                          }}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400 transition"
                          title="Delete Code"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add Code Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Redeem Code"
      >
        <div className="p-6 space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-neutral-400">
                Code Voucher String <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={generateRandomCode}
                className="text-xs text-amber-400 hover:underline"
              >
                Generate Random
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. PLAY-XXXX-YYYY"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Value Amount (INR) <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Description / Provider
            </label>
            <input
              type="text"
              placeholder="e.g. Google Play Recharge Code"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Expiration Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={newExpiry}
              onChange={e => setNewExpiry(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Directly Assign to User (Optional)
            </label>
            <select
              value={selectedAssignee}
              onChange={e => setSelectedAssignee(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="">-- Leave available in pool --</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.display_name} ({u.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCode}
              disabled={submittingAction}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              {submittingAction ? 'Adding...' : 'Add Code'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Code to User"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            Assign code <strong className="text-white font-mono">{codeToAssign?.code}</strong> (₹{codeToAssign?.amount}) to a user.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Select User
            </label>
            <select
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none"
            >
              <option value="">-- Choose recipient --</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.display_name} ({u.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignCode}
              disabled={!targetUserId || submittingAction}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm"
            >
              {submittingAction ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteCode}
        title="Delete Redeem Code?"
        message={`Are you sure you want to delete code ${codeToDelete?.code}? This cannot be undone.`}
        confirmText="Delete Code"
        isDestructive={true}
        isLoading={submittingAction}
      />
    </div>
  )
}
