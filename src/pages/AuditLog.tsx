import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Clock,
  User,
  Activity,
  FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { exportToCSV } from '../lib/export'
import { Modal } from '../components/common/Modal'
import { TableSkeleton } from '../components/common/Skeleton'

interface AuditLogItem {
  id: string
  admin_id?: string
  admin_email?: string
  action: string
  entity_type: string
  entity_id?: string
  before_val?: Record<string, any>
  after_val?: Record<string, any>
  created_at: string
}

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')

  // Selected Log for JSON view
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [actionFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Fetch audit log error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    const rows = filteredLogs.map(l => ({
      ID: l.id,
      AdminEmail: l.admin_email || 'admin@cashreward.app',
      Action: l.action,
      EntityType: l.entity_type,
      EntityID: l.entity_id || '',
      BeforeState: JSON.stringify(l.before_val || {}),
      AfterState: JSON.stringify(l.after_val || {}),
      Timestamp: new Date(l.created_at).toLocaleString()
    }))
    exportToCSV('audit_trail', rows)
  }

  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.action.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q) ||
      l.admin_email?.toLowerCase().includes(q) ||
      l.entity_id?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security & Audit Log</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Immutable tamper-evident record of all administrative modifications, balance adjustments, and approvals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Actions</option>
            <option value="APPROVE">Approvals</option>
            <option value="REJECT">Rejections</option>
            <option value="BALANCE">Balance Adjustments</option>
            <option value="BLOCK">User Blocks</option>
            <option value="TASK">Task Modifications</option>
            <option value="PAY">Payouts</option>
          </select>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by action, admin, or entity ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredLogs.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <Activity className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No audit records found</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Admin actions will automatically be recorded here.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Admin</th>
                  <th className="py-4 px-6">Action</th>
                  <th className="py-4 px-6">Entity</th>
                  <th className="py-4 px-6 text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-neutral-850/60 transition">
                    {/* Timestamp */}
                    <td className="py-4 px-6 text-xs text-neutral-400 font-mono">
                      {new Date(l.created_at).toLocaleString()}
                    </td>

                    {/* Admin */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="text-xs text-white font-medium">
                          {l.admin_email || 'admin@cashreward.app'}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-6">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {l.action}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="py-4 px-6">
                      <div className="text-xs text-white uppercase font-semibold">
                        {l.entity_type}
                      </div>
                      {l.entity_id && (
                        <div className="text-[11px] text-neutral-500 font-mono">
                          ID: {l.entity_id.slice(0, 8)}...
                        </div>
                      )}
                    </td>

                    {/* State Diff / View details */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          setSelectedLog(l)
                          setModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* JSON State Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Audit Event: ${selectedLog.action}`}
          size="xl"
        >
          <div className="p-6 space-y-4">
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs space-y-1.5 font-mono">
              <div><strong className="text-neutral-400">Action:</strong> <span className="text-amber-400">{selectedLog.action}</span></div>
              <div><strong className="text-neutral-400">Entity:</strong> {selectedLog.entity_type} ({selectedLog.entity_id || 'N/A'})</div>
              <div><strong className="text-neutral-400">Admin:</strong> {selectedLog.admin_email}</div>
              <div><strong className="text-neutral-400">Timestamp:</strong> {new Date(selectedLog.created_at).toLocaleString()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                  State Before:
                </label>
                <pre className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-300 overflow-auto max-h-60">
                  {selectedLog.before_val ? JSON.stringify(selectedLog.before_val, null, 2) : 'null (Created or Initial)'}
                </pre>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                  State After:
                </label>
                <pre className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-emerald-400 overflow-auto max-h-60">
                  {selectedLog.after_val ? JSON.stringify(selectedLog.after_val, null, 2) : 'null (Deleted)'}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
