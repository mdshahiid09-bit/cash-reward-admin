import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  FileCheck2,
  ArrowDownCircle,
  TrendingUp,
  CreditCard,
  Plus,
  Radio,
  Send,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Clock
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { supabase } from '../lib/supabase'
import { CardSkeleton } from '../components/common/Skeleton'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersToday: 0,
    pendingProofs: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsAmount: 0,
    totalPaidAmount: 0
  })

  const [recentAlerts, setRecentAlerts] = useState<
    { id: string; title: string; time: string; type: string; amount?: number }[]
  >([])

  const [period, setPeriod] = useState<'7d' | '30d' | '1y'>('7d')
  const [chartData, setChartData] = useState<{ date: string; earnings: number; payouts: number }[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    try {
      // 1. Total users
      const { count: uCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_demo', false)

      // 2. New users today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: newCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
        .eq('is_demo', false)

      // 3. Pending proofs
      const { count: proofCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 4. Withdrawals stats
      const { data: wList } = await supabase
        .from('withdrawals')
        .select('amount, status, created_at')

      let pendingWCount = 0
      let pendingWAmount = 0
      let paidTotal = 0

      wList?.forEach((w) => {
        if (w.status === 'pending') {
          pendingWCount++
          pendingWAmount += Number(w.amount || 0)
        } else if (w.status === 'paid') {
          paidTotal += Number(w.amount || 0)
        }
      })

      setStats({
        totalUsers: uCount || 0,
        newUsersToday: newCount || 0,
        pendingProofs: proofCount || 0,
        pendingWithdrawalsCount: pendingWCount,
        pendingWithdrawalsAmount: pendingWAmount,
        totalPaidAmount: paidTotal
      })

      // 5. Recent Alerts
      const alerts: { id: string; title: string; time: string; type: string; amount?: number }[] = []
      
      const { data: recentSubs } = await supabase
        .from('submissions')
        .select('id, created_at, status, task:tasks(title), user:profiles(display_name)')
        .order('created_at', { ascending: false })
        .limit(4)

      recentSubs?.forEach((s: any) => {
        alerts.push({
          id: s.id,
          title: `New task proof submitted by ${s.user?.display_name || 'User'} for "${s.task?.title || 'Task'}"`,
          time: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'proof'
        })
      })

      const { data: recentW } = await supabase
        .from('withdrawals')
        .select('id, amount, created_at, user:profiles(display_name)')
        .order('created_at', { ascending: false })
        .limit(3)

      recentW?.forEach((w: any) => {
        alerts.push({
          id: w.id,
          title: `Withdrawal request of ₹${w.amount} from ${w.user?.display_name || 'User'}`,
          time: new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'withdrawal',
          amount: w.amount
        })
      })

      setRecentAlerts(alerts)

      // 6. Build chart data (mock past days or real transactions)
      const { data: txList } = await supabase
        .from('transactions')
        .select('amount, type, created_at')
        .order('created_at', { ascending: true })

      const daysCount = period === '7d' ? 7 : period === '30d' ? 30 : 12
      const map: Record<string, { earnings: number; payouts: number }> = {}

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date()
        if (period === '1y') {
          d.setMonth(d.getMonth() - i)
          const key = d.toLocaleString('default', { month: 'short' })
          map[key] = { earnings: 0, payouts: 0 }
        } else {
          d.setDate(d.getDate() - i)
          const key = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
          map[key] = { earnings: 0, payouts: 0 }
        }
      }

      txList?.forEach((tx) => {
        const txDate = new Date(tx.created_at)
        const key =
          period === '1y'
            ? txDate.toLocaleString('default', { month: 'short' })
            : txDate.toLocaleDateString([], { month: 'short', day: 'numeric' })

        if (map[key]) {
          if (tx.amount > 0) {
            map[key].earnings += Number(tx.amount)
          } else {
            map[key].payouts += Math.abs(Number(tx.amount))
          }
        }
      })

      setChartData(
        Object.keys(map).map((k) => ({
          date: k,
          earnings: map[k].earnings,
          payouts: map[k].payouts
        }))
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()

    // Realtime subscriptions
    const subChannel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        loadDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => {
        loadDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subChannel)
    }
  }, [period])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
            System Overview
          </h2>
          <p className="text-xs text-slate-400">
            Realtime metrics across tasks, users, proof submissions, and wallet payouts.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/tasks/create')}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Task</span>
          </button>
          <button
            onClick={() => navigate('/proof-review')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Review Proofs</span>
          </button>
          <button
            onClick={() => navigate('/withdrawals')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-teal-400" />
            <span>Payouts</span>
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-cyan-400" />
            <span>Broadcast</span>
          </button>
        </div>
      </div>

      {/* 1. Stat Cards Grid */}
      {loading ? (
        <CardSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Total Users */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800/90 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Users
              </span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-heading">
              {stats.totalUsers}
            </div>
            <span className="text-[10px] text-emerald-400 mt-1 block font-medium">
              +{stats.newUsersToday} registered today
            </span>
          </div>

          {/* Pending Proofs */}
          <div
            onClick={() => navigate('/proof-review')}
            className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800/90 shadow-lg hover:border-amber-500/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Pending Proofs
              </span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-heading">
              {stats.pendingProofs}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Requires admin review
            </span>
          </div>

          {/* Pending Withdrawals */}
          <div
            onClick={() => navigate('/withdrawals')}
            className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800/90 shadow-lg hover:border-teal-500/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Pending Payouts
              </span>
              <div className="w-7 h-7 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <ArrowDownCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-teal-400 font-heading">
              ₹{stats.pendingWithdrawalsAmount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
              {stats.pendingWithdrawalsCount} requests waiting
            </span>
          </div>

          {/* Total Paid Out */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800/90 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Paid Out
              </span>
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-300 font-heading">
              ₹{stats.totalPaidAmount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Direct UPI & Bank settlements
            </span>
          </div>

          {/* System Pulse */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-950/30 border border-emerald-500/20 shadow-lg col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Live Status
              </span>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white font-heading">
              Healthy
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Postgres RLS & Storage active
            </span>
          </div>
        </div>
      )}

      {/* 2. Chart & Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Earnings & Payouts Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white font-heading">
                Earnings vs Payouts Over Time
              </h3>
              <p className="text-xs text-slate-400">
                User task credits vs cash withdrawals processed
              </p>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {(['7d', '30d', '1y'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                    period === p
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Graphic */}
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPayouts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F8FAFC'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  name="Task Earnings (₹)"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEarnings)"
                />
                <Area
                  type="monotone"
                  dataKey="payouts"
                  name="Withdrawals (₹)"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPayouts)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts Feed (1 Col) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white font-heading">
                Recent Activity
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Live Feed
              </span>
            </div>

            <div className="space-y-3">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="capitalize font-semibold text-slate-400">
                        {a.type}
                      </span>
                      <span>{a.time}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      {a.title}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  No recent activity logged yet.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/audit-log')}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors flex items-center justify-center gap-1.5 mt-2"
          >
            <span>View Complete Audit Log</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
