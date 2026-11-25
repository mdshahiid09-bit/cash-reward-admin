import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  FileCheck2,
  ArrowDownCircle,
  Ticket,
  Users,
  Trophy,
  GitBranch,
  Image,
  Settings,
  Bell,
  MessageSquare,
  FileSpreadsheet,
  ShieldAlert,
  LogOut,
  Sparkles,
  X
} from 'lucide-react'
import { useAdminAuth } from '../../context/AdminAuthContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Proof Review', path: '/proof-review', icon: FileCheck2 },
  { label: 'Withdrawals', path: '/withdrawals', icon: ArrowDownCircle },
  { label: 'Redeem Codes', path: '/redeem-codes', icon: Ticket },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  { label: 'Referrals', path: '/referrals', icon: GitBranch },
  { label: 'Banners', path: '/banners', icon: Image },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Contact Messages', path: '/contact', icon: MessageSquare },
  { label: 'Reports & Export', path: '/reports', icon: FileSpreadsheet },
  { label: 'Audit Log', path: '/audit-log', icon: ShieldAlert }
]

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { admin, signOut } = useAdminAuth()

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-heading font-black text-sm text-white tracking-tight block">
                Cash Reward
              </span>
              <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase block">
                Admin Console
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>

        {/* Admin User Footer */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 bg-slate-900/30">
          <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                Logged in as
              </span>
              <span className="text-xs font-bold text-slate-200 truncate block font-mono">
                {admin?.email || 'admin@cashreward.app'}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
