import React from 'react'

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-800/80 border-b border-slate-800" />
      <div className="divide-y divide-slate-800/50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-800/60 rounded"
                style={{ width: `${Math.max(15, Math.floor(80 / cols))}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 animate-pulse space-y-3">
          <div className="h-4 bg-slate-800/80 rounded w-1/2" />
          <div className="h-8 bg-slate-800 rounded w-3/4" />
          <div className="h-3 bg-slate-800/60 rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

export const DetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-slate-900 border border-slate-800 rounded-2xl w-1/3" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl" />
    </div>
  )
}
