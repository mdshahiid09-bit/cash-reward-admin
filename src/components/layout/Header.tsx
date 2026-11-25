import React from 'react'
import { Menu, Radio, ExternalLink } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './Sidebar'

interface HeaderProps {
  onOpenSidebar: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const location = useLocation()

  const currentNav = NAV_ITEMS.find((n) => n.path === location.pathname) || {
    label: 'Console'
  }

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-black font-heading text-white tracking-tight">
          {currentNav.label}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Realtime Live Sync Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">Supabase Realtime</span>
          <span className="sm:hidden">Live</span>
        </div>

        {/* User Panel Link */}
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
        >
          <span>Open User App</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>
    </header>
  )
}
