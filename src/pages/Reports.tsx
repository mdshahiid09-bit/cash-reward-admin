import React, { useState, useEffect } from 'react'
import {
  FileBarChart,
  Download,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  Layers,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  FileCode
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { exportToCSV, exportToJSON } from '../lib/export'
import { TableSkeleton } from '../components/common/Skeleton'

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTasks: 0,
    totalSubs: 0,
    approvedSubs: 0,
    rejectedSubs: 0,
    totalPayoutsAmount: 0,
    pendingPayoutsAmount: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // 1. Users count
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      // 2. Tasks count
      const { count: tasksCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
      // 3. Submissions
      const { data: subsData } = await supabase.from('submissions').select('status')
      const totalSubs = subsData?.length || 0
      const approvedSubs = subsData?.filter(s => s.status === 'approved').length || 0
      const rejectedSubs = subsData?.filter(s => s.status === 'rejected').length || 0

      // 4. Withdrawals
      const { data: wdsData } = await supabase.from('withdrawals').select('amount, status')
      const totalPayouts = wdsData?.filter(w => w.status === 'paid').reduce((sum, w) => sum + Number(w.amount), 0) || 0
      const pendingPayouts = wdsData?.filter(w => w.status === 'pending').reduce((sum, w) => sum + Number(w.amount), 0) || 0

      setStats({
        totalUsers: usersCount || 0,
        totalTasks: tasksCount || 0,
        totalSubs,
        approvedSubs,
        rejectedSubs,
        totalPayoutsAmount: totalPayouts,
        pendingPayoutsAmount: pendingPayouts
      })
    } catch (err) {
      console.error('Fetch stats error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportTable = async (tableName: string, format: 'csv' | 'json') => {
    setExporting(`${tableName}_${format}`)
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(2000)
      if (error) throw error

      if (format === 'csv') {
        exportToCSV(`${tableName}_export`, data || [])
      } else {
        exportToJSON(`${tableName}_export`, data || [])
      }
    } catch (err) {
      console.error(`Export ${tableName} error:`, err)
    } finally {
      setExporting(null)
    }
  }

  const approvalRate = stats.totalSubs > 0
    ? Math.round((stats.approvedSubs / stats.totalSubs) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reports & Data Exports</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Generate analytical platform audits and export database collections directly into CSV or JSON spreadsheets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Total Registered Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2">
            {stats.totalUsers.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Unique member accounts</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Submission Approval Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">
            {approvalRate}%
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {stats.approvedSubs} approved / {stats.rejectedSubs} rejected
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Total Payouts Disbursed</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2">
            ₹{stats.totalPayoutsAmount.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Successfully paid out</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Pending Payout Requests</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400 mt-2">
            ₹{stats.pendingPayoutsAmount.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Awaiting bank/UPI transfer</div>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">Full Table Data Exports</h3>
          <p className="text-xs text-neutral-400 mt-1">
            Download raw database tables in CSV format for Excel/Google Sheets, or JSON format for backups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 'tasks', name: 'Task Catalog', desc: 'All campaigns, prizes, steps, and rules' },
            { id: 'profiles', name: 'User Profiles', desc: 'User balances, referral codes, and activity' },
            { id: 'submissions', name: 'Task Proofs', desc: 'Submitted proofs, approvals, and reject logs' },
            { id: 'withdrawals', name: 'Payout Requests', desc: 'Cashout amounts, payment IDs, and UTRs' },
            { id: 'referrals', name: 'Referral Network', desc: 'Inviter, friend associations, and rewards' },
            { id: 'audit_log', name: 'System Audit Log', desc: 'Detailed history of all admin modifications' }
          ].map(item => {
            const isCsvLoading = exporting === `${item.id}_csv`
            const isJsonLoading = exporting === `${item.id}_json`

            return (
              <div
                key={item.id}
                className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-semibold text-white text-sm">{item.name}</h4>
                  <p className="text-xs text-neutral-400 mt-1">{item.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center gap-2">
                  <button
                    onClick={() => handleExportTable(item.id, 'csv')}
                    disabled={!!exporting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isCsvLoading ? 'Exporting...' : 'CSV'}</span>
                  </button>
                  <button
                    onClick={() => handleExportTable(item.id, 'json')}
                    disabled={!!exporting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isJsonLoading ? 'Exporting...' : 'JSON'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
